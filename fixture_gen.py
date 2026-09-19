"""Emit the App fixtures for GROUP_0016 in the Model->App contract shape.

Every number comes from the dump or from a deterministic scorecard on panel.csv,
so the fixture is honest: nothing is invented, and the Model workstream replaces
the files without touching the UI. Scores here are `fixture-v1-scorecard`, a
placeholder for the real model.

    python3 fixture_gen.py            # writes fixtures_out/*.json
"""
import csv, json, os, collections, datetime, statistics as st
from stress import load, events, leadtime, BASE_N

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output") + "/"
OUT = "fixtures_out"
GROUP = "GROUP_0016"
SNAP = datetime.date(2026, 8, 31)
MONTHS = [f"{y}-{m:02d}" for y in (2024, 2025, 2026) for m in range(1, 13)][8:32]  # 2024-09..2026-08


def companyName(cid): return cid.replace("COMP_", "Filial ")


def d(s):
    try: return datetime.date(int(s[:4]), int(s[5:7]), int(s[8:10]))
    except Exception: return None


def mo(m): return int(m[:4]) * 12 + int(m[5:7])


# ---------- raw pulls scoped to the group ----------
comps = {r["company_id"]: r for r in csv.DictReader(open(D + "companies.csv")) if r["group_id"] == GROUP}
IDS = sorted(comps)
panel = {c: rows for c, rows in load("panel.csv").items() if c in comps}
onsets, fired = events(load("panel.csv"))          # full-panel events, same as events.csv

bank_products = collections.defaultdict(list)
for r in csv.DictReader(open(D + "banking_products.csv")):
    if r["company_id"] in comps: bank_products[r["company_id"]].append(r)
debt_products = collections.defaultdict(list)
for r in csv.DictReader(open(D + "debt_products.csv")):
    if r["company_id"] in comps: debt_products[r["company_id"]].append(r)
sched = collections.defaultdict(list)
for r in csv.DictReader(open(D + "debt_schedule_config.csv")):
    if r["company_id"] in comps: sched[r["company_id"]].append(r)

inv = collections.defaultdict(list)                # only rows we trust: paid, or pending with a due date
for r in csv.DictReader(open(D + "invoices.csv")):
    c = r["company_id"]
    if c not in comps: continue
    if r["status"] not in ("paid", "pending", "payment_in_progress"): continue   # overdue stock is garbage
    inv[c].append(r)

tx = collections.defaultdict(list)
for r in csv.DictReader(open(D + "transactions.csv")):
    c = r["company_id"]
    if c in comps and r["date"][:7] in MONTHS: tx[c].append(r)


# ---------- scorecard: deterministic, own-baseline, explainable ----------
W = {"cash": 40, "pays_late": 25, "unpaid_ar": 20, "fincost": 15}
LABEL = {
    "cash": "Colchón de caja frente a su media",
    "pays_late": "Días de retraso pagando a proveedores",
    "unpaid_ar": "Facturas de clientes sin cobrar",
    "fincost": "Coste financiero sobre pagos",
}
UNIT = {"cash": "days", "pays_late": "days", "unpaid_ar": "ratio", "fincost": "ratio"}
FLOOR = {"cash": 5.0, "pays_late": 5.0, "unpaid_ar": 0.05, "fincost": 0.01}   # minimum span for the penalty ramp


def trail(rows, i, k, n=3): return [rows[j][k] for j in range(max(0, i - n + 1), i + 1)]


def signals(rows, ovd_clean=None):
    """ovd_clean: per-month pct_vencido from panel_cobro (point-in-time, excludes the sticky overdue stock).
    Without it we fall back to panel.csv's ovd_amt, which is what stress.py's events use."""
    out = []
    for i, r in enumerate(rows):
        outflow = st.mean(trail(rows, i, "outflow"))
        buf = r["cash_close"] / (outflow / 30) if outflow > 0 else None
        paid = sum(trail(rows, i, "paid_n"))
        dpd = sum(trail(rows, i, "dpd_sum")) / paid if paid else None
        if ovd_clean is not None:
            ovd = ovd_clean[i]
        else:
            billed = st.mean(trail(rows, i, "inv_ar", 12))
            ovd = st.mean(trail(rows, i, "ovd_amt")) / billed if billed > 0 else None
        fin = sum(trail(rows, i, "fincost")) / sum(trail(rows, i, "outflow")) if sum(trail(rows, i, "outflow")) > 0 else None
        out.append({"cash": buf, "pays_late": dpd, "unpaid_ar": ovd, "fincost": fin})
    return out


def base(vals):
    ok = [v for v in vals[:BASE_N] if v is not None]
    return st.median(ok) if ok else None


def comp_score(k, v, b):
    """Points earned on component k (0..W[k]); full marks at/above own baseline, missing = full marks."""
    if v is None or b is None: return W[k]
    if k == "cash":                       # more is better
        return W[k] * max(0.0, min(1.0, v / b)) if b > 0 else W[k]
    # for the rest, less is better; lose points as v exceeds baseline
    if v <= b: return W[k]
    span = max(b, FLOOR[k])                # a zero baseline must not turn any blip into a full penalty
    return W[k] * max(0.0, 1.0 - (v - b) / (2 * span))


def score_series(rows, ovd_clean=None):
    sig = signals(rows, ovd_clean)
    B = {k: base([s[k] for s in sig]) for k in W}
    series, parts = [], []
    for i, r in enumerate(rows):
        pts = {k: comp_score(k, sig[i][k], B[k]) for k in W}
        series.append({"month": r["month"], "score": round(sum(pts.values()), 1),
                       "mode": "reconstructed"})
        parts.append(pts)
    return series, parts, sig, B


BAND = lambda s: "sana" if s >= 75 else "vigilar" if s >= 55 else "riesgo" if s >= 35 else "critica"


# ---------- Caja Real monthly ----------
def committed_hist(c):
    """Payables unpaid at month end and due within 30 days, from PAID invoices with real dates."""
    out = collections.Counter()
    for r in inv[c]:
        if r["status"] != "paid" or float(r["amount"] or 0) >= 0: continue
        iss, due, pay = d(r["issuance_date"]), d(r["due_date"]), d(r["payment_date"])
        if not (iss and due and pay): continue
        for m in MONTHS:
            end = d(m + "-28")
            if iss <= end < pay and (due - end).days <= 30:
                out[m] += abs(float(r["amount"]))
    return out


def recurring(rows, i):
    return st.mean([rows[j]["salary"] + rows[j]["tax"] for j in range(max(0, i - 5), i + 1)])


def pledged(c):
    return sum(abs(float(r["outstanding"] or 0)) for r in debt_products[c] if r["type"] == "guarantee")


# ---------- cash path, 90 days from the snapshot ----------
def cash_path(c, rows, mods=None):
    mods = mods or {}
    last = rows[-1]
    cash0 = last["cash_close"]
    outflow_m = st.mean([r["outflow"] for r in rows[-6:]])
    buffer = outflow_m                              # 30 days of outflow
    rec_m = recurring(rows, len(rows) - 1)
    coll_m = st.mean([r["inflow"] for r in rows[-6:]]) * mods.get("collections_mult", 1.0)
    dso_shift = mods.get("dso_shift_days", 0)      # negative = collect earlier
    dpo_shift = mods.get("dpo_shift_days", 0)      # positive = pay later
    credit = mods.get("new_credit", 0.0)

    payables = []                                   # (date, amount) contractual
    for r in inv[c]:
        if float(r["amount"] or 0) >= 0: continue
        if r["status"] == "paid": continue          # already paid by snapshot
        due = d(r["due_date"])
        if due and 0 <= (due - SNAP).days <= 90:
            payables.append((due + datetime.timedelta(days=dpo_shift), abs(float(r["pending_amount"] or r["amount"]))))
    for r in sched[c]:
        nd = d(r["next_payment_date"])
        try: inst = abs(float(r["granted_balance"])) / int(float(r["total_periods"]))
        except Exception: inst = 0
        if nd and inst:
            while nd <= SNAP + datetime.timedelta(days=90):
                if nd > SNAP: payables.append((nd, inst))
                nd += datetime.timedelta(days=30)

    pts, cash, kind_switch = [], cash0 + credit - coll_m * dso_shift / 30, 45  # behavioural after day 45
    first_short, min_cash = None, (SNAP, cash)
    for day in range(0, 91, 7):
        date = SNAP + datetime.timedelta(days=day)
        win = SNAP + datetime.timedelta(days=day - 7)
        cash -= sum(a for dt, a in payables if win < dt <= date)
        if day and day % 28 == 0: cash -= rec_m
        # collections arrive at historical DSO, smoothed weekly
        if day > 0 and day >= 7 + dso_shift: cash += coll_m * 7 / 30
        kind = "contractual" if day <= kind_switch else "behavioural"
        pts.append({"date": date.isoformat(), "cash": round(cash), "kind": kind})
        if cash < min_cash[1]: min_cash = (date, cash)
        if cash < 0 and first_short is None: first_short = (date, -cash)
    chk = [{"day": k, "cash": next(p["cash"] for p in pts if p["date"] == (SNAP + datetime.timedelta(days=k)).isoformat()) if k % 7 == 0 else pts[k // 7]["cash"],
            "committed_due": round(sum(a for dt, a in payables if SNAP < dt <= SNAP + datetime.timedelta(days=k)) + rec_m * (k // 28))}
           for k in (28, 56, 84)]
    for x, k in zip(chk, (30, 60, 90)): x["day"] = k
    gap = max(0.0, buffer - min_cash[1])
    return {
        "horizon_days": 90, "buffer": round(buffer),
        "points": pts, "checkpoints": chk,
        "min_cash": {"date": min_cash[0].isoformat(), "cash": round(min_cash[1])},
        "first_shortfall": {"date": first_short[0].isoformat(), "amount": round(first_short[1])} if first_short else None,
        "funding_gap": {"amount": round(gap), "date": min_cash[0].isoformat()} if gap > 0 else None,
        "assumptions": [
            {"key": "dso", "label_es": "Plazo medio de cobro", "value": 45 + dso_shift, "unit": "días", "period": "12m", "source": "historical"},
            {"key": "collections", "label_es": "Cobros mensuales", "value": round(coll_m), "unit": "€", "period": "6m", "source": "historical"},
            {"key": "recurring", "label_es": "Nóminas e impuestos mensuales", "value": round(rec_m), "unit": "€", "period": "6m", "source": "historical"},
            {"key": "buffer", "label_es": "Colchón objetivo", "value": round(buffer), "unit": "€", "period": "30 días de pagos", "source": "user"},
        ],
    }


def goals_for(c, rows, siblings=None):
    """siblings: {company_id: free cash at snapshot} for the rest of the group, so the planner
    can propose moving money that already belongs to the group before borrowing outside it."""
    basep = cash_path(c, rows)
    target = basep["buffer"]
    cands = [
        ("cobrar_antes", "Cobrar 10 días antes", {"dso_shift_days": -10},
         [{"driver": "dso", "label_es": "Plazo de cobro", "from": 45, "to": 35, "unit": "días"}], []),
        ("pagar_despues", "Pagar a proveedores 15 días después", {"dpo_shift_days": 15},
         [{"driver": "dpo", "label_es": "Plazo de pago", "from": 0, "to": 15, "unit": "días"}],
         [{"metric": "supplier_relation", "label_es": "Riesgo con proveedores", "delta": 1, "unit": "nivel"}]),
        ("linea_credito", "Línea de crédito bancaria", {"new_credit": 200_000},
         [{"driver": "credit", "label_es": "Nueva financiación bancaria", "from": 0, "to": 200_000, "unit": "€"}],
         [{"metric": "fincost", "label_es": "Coste financiero anual", "delta": 9_000, "unit": "€"}]),
    ]
    # the money may already be inside the group: propose the largest surplus sibling first
    src = None
    need = max(0.0, target - basep["min_cash"]["cash"])
    if siblings and need > 0:
        cand = sorted(((k, v) for k, v in siblings.items() if v > 0), key=lambda x: -x[1])
        if cand and cand[0][1] > 0:
            src, avail = cand[0]
            move = round(min(need, avail * 0.8))       # never drain a sibling below a fifth of its own free cash
            if move > 0:
                cands.append(("intercompany", f"Aporte desde {companyName(src)}", {"new_credit": move},
                              [{"driver": "intercompany", "label_es": f"Préstamo de {companyName(src)}", "from": 0, "to": move, "unit": "€"}],
                              [{"metric": "sibling_buffer", "label_es": f"Reduce el colchón de {companyName(src)}", "delta": move, "unit": "€"}]))
    plans = []
    for pid, title, mods, changes, trade in cands:
        p = cash_path(c, rows, mods)
        met = p["min_cash"]["cash"] >= target
        unmet = []
        if pid == "linea_credito":
            unmet.append({"constraint_label_es": "Sin nueva deuda bancaria", "breach_date": SNAP.isoformat(), "value": 200_000})
        if p["first_shortfall"]:
            unmet.append({"constraint_label_es": f"Caja ≥ {target:,.0f} € todo el periodo".replace(",", "."),
                          "breach_date": p["first_shortfall"]["date"], "value": -p["first_shortfall"]["amount"]})
        plans.append({
            "plan_id": pid, "title_es": title, "source_company_id": src if pid == "intercompany" else None,
            "nota_es": ("Requiere contrato de préstamo entre vinculadas a tipo de mercado. "
                        "La deuda consolidada del grupo no cambia.") if pid == "intercompany" else None,
            "changes": changes,
            "attainment": {"value": p["min_cash"]["cash"], "target": target,
                           "pct": round(100 * min(1, max(0, p["min_cash"]["cash"]) / target)) if target else 100, "met": met},
            "cash_impact": {"min_cash": p["min_cash"]["cash"], "min_cash_date": p["min_cash"]["date"],
                            "delta_vs_base": p["min_cash"]["cash"] - basep["min_cash"]["cash"]},
            "trade_offs": trade, "unmet_constraints": unmet, "qualifies": met and not unmet,
        })
    ok = [p for p in plans if p["qualifies"]]
    gap = None if ok else {"amount": round(target - max(p["cash_impact"]["min_cash"] for p in plans)),
                           "date": basep["min_cash"]["date"]}
    return [{
        "goal_id": "colchon_90d", "metric": "min_cash",
        "label_es": f"Caja mínima ≥ {target:,.0f} € durante 90 días".replace(",", "."),
        "target": target, "unit": "€", "deadline": (SNAP + datetime.timedelta(days=90)).isoformat(),
        "constraints": [{"metric": "new_bank_debt", "op": "<=", "value": 0, "label_es": "Sin nueva deuda bancaria"}],
        "plans": plans, "remaining_gap": gap,
    }], basep



# ---------- the four panels proposed by Data (company-month key) ----------
FLUJO = {
    "cobros_operativos": {"collection", "bulk_collection", "pos_settlement", "cash_settlement", "collection_refund", "tax_refund"},
    "pagos_operativos": {"payment", "bulk_payment", "utility", "salary", "tax", "social_security", "fee", "cash_withdrawal", "pos_withdrawal", "payment_refund", "cash_settlements"},
    "financiacion": {"debt_repayment", "interest_charge"},
    "inversion": {"investment_deployment", "investment_return"},
    "transferencias": {"transfer"},
}
CAT2BUCKET = {cat: b for b, cats in FLUJO.items() for cat in cats}


def panel_flujos(c, rows):
    """Euro decomposition per month. caja_acumulada is cumulative net flow from 0: shape known, level unknown."""
    by = collections.defaultdict(lambda: collections.defaultdict(float))
    for r in tx[c]:
        by[r["date"][:7]][CAT2BUCKET.get(r["category"], "excluido")] += float(r["amount"] or 0)
    out, acc = [], 0.0
    for r in rows:
        m = r["month"]; b = by[m]
        neto = b["cobros_operativos"] + b["pagos_operativos"] + b["financiacion"] + b["inversion"]
        acc += neto
        out.append({"month": m, **{k: round(b[k]) for k in list(FLUJO) + ["excluido"]},
                    "flujo_neto": round(neto), "caja_acumulada": round(acc)})
    return out


def panel_cobro(c, rows):
    """Receivables portfolio reconstructed at each month end, from invoices (counterparty_id present on 98.7%)."""
    ar = [r for r in inv[c] if float(r["amount"] or 0) > 0]
    for r in ar:
        r["_iss"], r["_due"], r["_pay"] = d(r["issuance_date"]), d(r["due_date"]), d(r["payment_date"]) if r["status"] == "paid" else None
    out = []
    for i, r0 in enumerate(rows):
        m = r0["month"]; end = d(m + "-28")
        open_ = [r for r in ar if r["_iss"] and r["_iss"] <= end and (r["_pay"] is None or r["_pay"] > end)]
        amt = lambda r: abs(float(r["pending_amount"] or 0)) if r["_pay"] is None else float(r["amount"])
        total = sum(amt(r) for r in open_)
        aging = {"corriente": 0.0, "d1_30": 0.0, "d31_90": 0.0, "d90p": 0.0}
        for r in open_:
            if not r["_due"] or r["_due"] >= end: aging["corriente"] += amt(r)
            else:
                dd = (end - r["_due"]).days
                aging["d1_30" if dd <= 30 else "d31_90" if dd <= 90 else "d90p"] += amt(r)
        vencido = total - aging["corriente"]
        paid_now = [r for r in ar if r["_pay"] and r["_pay"].strftime("%Y-%m") == m and r["_iss"]]
        dso = st.mean([(r["_pay"] - r["_iss"]).days for r in paid_now]) if paid_now else None
        w0 = d(rows[max(0, i - 11)]["month"] + "-01")
        bycp = collections.Counter()
        for r in ar:
            if r["_pay"] and w0 <= r["_pay"] <= end and r["counterparty_id"]: bycp[r["counterparty_id"]] += float(r["amount"])
        tot = sum(bycp.values())
        shares = sorted((v / tot for v in bycp.values()), reverse=True) if tot > 0 else []
        out.append({"month": m, "dso_real": round(dso, 1) if dso is not None else None,
                    "cartera_abierta": round(total), "pct_vencido": round(vencido / total, 4) if total > 0 else None,
                    "aging": {k: round(v) for k, v in aging.items()},
                    "concentracion_hhi": round(sum(x * x for x in shares), 4) if shares else None,
                    "top3_pct": round(100 * sum(shares[:3])) if shares else None, "n_clientes": len(bycp)})
    return out


def panel_deuda(c, rows, flujos):
    """Observed debt service per month, coverage by operating flow, and the static profile."""
    by = collections.defaultdict(lambda: {"p": 0.0, "i": 0.0})
    for r in tx[c]:
        a = float(r["amount"] or 0)
        if r["category"] == "debt_repayment" and a < 0: by[r["date"][:7]]["p"] += -a
        if r["category"] == "interest_charge" and a < 0: by[r["date"][:7]]["i"] += -a
    serie = []
    for r, f in zip(rows, flujos):
        m = r["month"]; svc = by[m]["p"] + by[m]["i"]
        op = f["cobros_operativos"] + f["pagos_operativos"]
        serie.append({"month": m, "servicio_principal": round(by[m]["p"]), "servicio_intereses": round(by[m]["i"]),
                      "cobertura": round(op / svc, 2) if svc > 0 else None})
    prods = debt_products[c]
    tipos = collections.Counter(r["type"] for r in prods)
    conc = sum(abs(float(r["granted"] or 0)) for r in prods)
    disp = sum(abs(float(r["outstanding"] or 0)) for r in prods)
    perfil = {"n_productos": len(prods), "tipos": dict(tipos), "concedido": round(conc), "dispuesto": round(disp),
              "utilizacion": round(disp / conc, 2) if conc > 0 else None,
              "proxima_cuota": min((r["next_payment_date"][:10] for r in sched[c]), default=None)}
    return {"serie": serie, "perfil": perfil}


def panel_evidencia(c, rows):
    """Coverage per source, history length, uncategorised share, flags. Decides if the score is publishable."""
    ncat = collections.Counter(); ntot = collections.Counter()
    for r in tx[c]:
        m = r["date"][:7]; ntot[m] += 1
        if r["category"] in ("-", ""): ncat[m] += 1
    serie = []
    for r in rows:
        m = r["month"]
        pct = ncat[m] / ntot[m] if ntot[m] else None
        flags = []
        if r["n"] == 0: flags.append("sin_movimientos")
        if r["inv_n"] == 0: flags.append("sin_erp")
        if pct is not None and pct > 0.5: flags.append("sin_categorizar_alto")
        serie.append({"month": m, "cobertura": {"banco": r["n"] > 0, "erp": r["inv_n"] > 0, "deuda": bool(debt_products[c])},
                      "pct_sin_categorizar": round(pct, 3) if pct is not None else None, "banderas": flags})
    meses = sum(1 for r in rows if r["n"] > 0)
    uncat_all = sum(ncat.values()) / sum(ntot.values()) if sum(ntot.values()) else 1.0
    motivos = []
    if meses < 12: motivos.append(f"Solo {meses} meses de historia (mínimo 12)")
    if not any(r["n"] > 0 for r in rows[-3:]): motivos.append("Sin movimientos bancarios en los últimos 3 meses")
    if uncat_all > 0.6: motivos.append(f"{round(100 * uncat_all)} % de movimientos sin categorizar")
    resumen = {"meses_historia": meses, "publicable": not motivos, "motivos": motivos,
               "cobertura": {"banco": any(r["n"] > 0 for r in rows), "erp": any(r["inv_n"] > 0 for r in rows), "deuda": bool(debt_products[c])},
               "pct_sin_categorizar": round(uncat_all, 3)}
    return {"serie": serie, "resumen": resumen}

# ---------- evidence ids for drivers ----------
def evidence(c, key, months):
    ids = []
    if key == "pays_late":
        rows = [r for r in inv[c] if r["status"] == "paid" and float(r["amount"] or 0) < 0
                and r["payment_date"][:7] in months and d(r["payment_date"]) and d(r["due_date"])
                and (d(r["payment_date"]) - d(r["due_date"])).days > 5]
        rows.sort(key=lambda r: -(d(r["payment_date"]) - d(r["due_date"])).days)
        return [{"source": "invoices", "ids": [r["operation_id"] for r in rows[:8]]}]
    if key == "unpaid_ar":
        rows = [r for r in inv[c] if float(r["amount"] or 0) > 0 and r["status"] != "paid" and r["issuance_date"][:7] in months]
        return [{"source": "invoices", "ids": [r["operation_id"] for r in rows[:8]]}]
    if key == "fincost":
        rows = [r for r in tx[c] if r["category"] in ("interest_charge", "fee") and r["date"][:7] in months]
        rows.sort(key=lambda r: float(r["amount"]))
        return [{"source": "transactions", "ids": [r["transaction_id"] for r in rows[:8]]}]
    rows = [r for r in tx[c] if r["date"][:7] in months and float(r["amount"] or 0) < 0]
    rows.sort(key=lambda r: float(r["amount"]))
    return [{"source": "transactions", "ids": [r["transaction_id"] for r in rows[:8]]}]


# ---------- build ----------
os.makedirs(OUT, exist_ok=True)
company_rows, all_scores, alerts = [], {}, []
group_cash = collections.Counter()

# pass 1: free cash per entity at the snapshot, so pass 2 can see the rest of the group
free_at_snapshot = {}
for c in IDS:
    rows = panel.get(c)
    if not rows:
        continue
    cp0 = cash_path(c, rows)
    free_at_snapshot[c] = cp0["min_cash"]["cash"] - cp0["buffer"]

for c in IDS:
    rows = panel.get(c)
    meta = comps[c]
    if not rows:
        continue
    cobro = panel_cobro(c, rows)
    series, parts, sig, B = score_series(rows, [x["pct_vencido"] for x in cobro])
    for s in series: all_scores[(c, s["month"])] = s["score"]
    last_i = len(rows) - 1
    cur, prev3 = series[-1]["score"], series[max(0, last_i - 3)]["score"]

    # drivers: component points now vs at baseline
    base_parts = {k: st.median([p[k] for p in parts[:BASE_N]]) for k in W} if len(parts) >= BASE_N else parts[-1]
    baseline = sum(base_parts.values())
    drivers = []
    for k in W:
        contrib = parts[-1][k] - base_parts[k]
        recent = [rows[i]["month"] for i in range(max(0, last_i - 2), last_i + 1)]
        drivers.append({
            "key": k, "label_es": LABEL[k], "contribution_pts": round(contrib, 1),
            "value": round(sig[-1][k], 4 if UNIT[k] == "ratio" else 1) if sig[-1][k] is not None else None,
            "baseline": round(B[k], 4 if UNIT[k] == "ratio" else 1) if B[k] is not None else None, "unit": UNIT[k],
            "months": recent, "evidence": evidence(c, k, recent),
        })
    drivers.sort(key=lambda x: -abs(x["contribution_pts"]))

    com = committed_hist(c); pl = pledged(c)
    caja = []
    for i, r in enumerate(rows):
        cr = r["cash_close"] - com[r["month"]] - recurring(rows, i) - pl
        caja.append({"month": r["month"], "bank_cash": round(r["cash_close"]), "committed": round(com[r["month"]] + recurring(rows, i)),
                     "pledged": round(pl), "trapped": 0, "caja_real": round(cr)})
    goals, cp = goals_for(c, rows, {k: v for k, v in free_at_snapshot.items() if k != c})
    flujos = panel_flujos(c, rows); evidencia = panel_evidencia(c, rows)
    caja_now = caja[-1]["caja_real"]
    group_cash["bank"] += rows[-1]["cash_close"]; group_cash["committed"] += caja[-1]["committed"]
    group_cash["pledged"] += pl; group_cash["caja"] += caja_now

    company = {
        "company_id": c, "group_id": GROUP, "name": c, "currency": meta["currency"],
        "assessment_date": SNAP.isoformat(), "model_version": "fixture-v1-scorecard",
        "history_mode": "reconstructed", "last_data_month": rows[-1]["month"],
        "score": {"value": cur, "band": BAND(cur), "delta_3m": round(cur - prev3, 1), "baseline_12m": round(baseline, 1)},
        "score_series": series, "caja_real_series": caja, "drivers": drivers,
        "coverage": {
            "bank": {"ok": bool(bank_products[c]), "last_date": rows[-1]["month"], "n_accounts": len(bank_products[c])},
            "erp": {"ok": any(r["inv_n"] > 0 for r in rows), "last_date": max((r["month"] for r in rows if r["inv_n"] > 0), default=None),
                    "n_invoices": len(inv[c])},
            "debt": {"ok": bool(debt_products[c]), "n_products": len(debt_products[c]),
                     "next_instalment_date": min((r["next_payment_date"][:10] for r in sched[c]), default=None)},
        },
        "event": {"onset_month": onsets[c], "conditions": fired.get((c, onsets[c]), [])} if c in onsets else None,
        "cash_path": cp, "goals": goals,
        "flujos": flujos, "cobro": cobro, "deuda": panel_deuda(c, rows, flujos), "evidencia": evidencia,
    }
    json.dump(company, open(f"{OUT}/{c}.json", "w"), ensure_ascii=False, indent=1)

    company_rows.append({
        "company_id": c, "name": c, "currency": meta["currency"], "score": cur, "band": BAND(cur),
        "delta_3m": round(cur - prev3, 1), "trend_6m": [s["score"] for s in series[-6:]],
        "bank_cash": round(rows[-1]["cash_close"]), "caja_real": caja_now,
        "first_shortfall_date": cp["first_shortfall"]["date"] if cp["first_shortfall"] else None,
        "last_data_month": rows[-1]["month"], "publicable": evidencia["resumen"]["publicable"],
        "coverage": {"bank": company["coverage"]["bank"]["ok"], "erp": company["coverage"]["erp"]["ok"], "debt": company["coverage"]["debt"]["ok"]},
    })

    # alerts: sustained score drop (deterioro), or sustained rise at the end (recuperacion)
    low = [s for s in series if s["score"] <= baseline - 10]
    if c in onsets and low:
        raised = low[0]["month"]
        alerts.append({"alert_id": f"al-{c}-det", "company_id": c, "raised_month": raised, "severity": "P0",
                       "type": "deterioro", "title_es": "Deterioro persistente", "persistence_months": 2,
                       "score_from": round(baseline, 1), "score_to": low[0]["score"],
                       "lead_months": max(0, mo(onsets[c]) - mo(raised)), "status": "nueva"})
    if cur - prev3 >= 8:
        alerts.append({"alert_id": f"al-{c}-rec", "company_id": c, "raised_month": rows[-1]["month"], "severity": "info",
                       "type": "recuperacion", "title_es": "Recuperación sostenida", "persistence_months": 3,
                       "score_from": prev3, "score_to": cur, "lead_months": None, "status": "nueva"})
    if caja_now < 0:
        alerts.append({"alert_id": f"al-{c}-cr", "company_id": c, "raised_month": rows[-1]["month"], "severity": "P1",
                       "type": "caja_real_negativa", "title_es": "Caja Real negativa", "persistence_months": 1,
                       "score_from": None, "score_to": None, "lead_months": None, "status": "nueva"})

# our anticipation row, measured with the same function as the reference
leads, fa, clean = leadtime(all_scores | {k: v for k, v in all_scores.items()}, onsets)
full_scores = {}
for c, rows in load("panel.csv").items():
    s, *_ = score_series(rows);
    for x in s: full_scores[(c, x["month"])] = x["score"]
leads, fa, clean = leadtime(full_scores, onsets)
v = sorted(leads.values())
ours = {"median_lead_months": st.median(v) if v else None,
        "caught_1m_pct": round(100 * len([x for x in v if x >= 1]) / len(v)) if v else None,
        "caught_3m_pct": round(100 * len([x for x in v if x >= 3]) / len(v)) if v else None,
        "missed_pct": round(100 * len([x for x in v if x == 0]) / len(v)) if v else None,
        "false_alarms": fa, "n_clean": clean}
reference = {"median_lead_months": 0.0, "caught_1m_pct": 43, "caught_3m_pct": 24, "missed_pct": 57, "false_alarms": 368, "n_clean": 607}

short = [r for r in company_rows if r["caja_real"] < 0]
group = {
    "group_id": GROUP, "name": GROUP, "assessment_date": SNAP.isoformat(), "model_version": "fixture-v1-scorecard",
    "history_mode": "reconstructed",
    "consolidated": {"bank_cash": round(group_cash["bank"]), "committed_30d": round(group_cash["committed"]),
                     "pledged": round(group_cash["pledged"]), "trapped": round(-sum(r["caja_real"] for r in short)),
                     "caja_real": round(group_cash["caja"])},
    "short_count": len(short), "short_total": round(sum(r["caja_real"] for r in short)),
    "anticipation": {"reference": reference, "ours": ours},
    "companies": sorted(company_rows, key=lambda r: r["caja_real"]), "alerts": alerts,
}
json.dump(group, open(f"{OUT}/{GROUP}.json", "w"), ensure_ascii=False, indent=1)
print(f"{len(company_rows)} companies, {len(short)} short, consolidated caja_real {group['consolidated']['caja_real']:,}")
print("ours:", ours)
print("alerts:", collections.Counter(a['type'] for a in alerts))
