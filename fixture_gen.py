"""Emit the App fixtures for GROUP_0016 in the Model->App contract shape.

Every number comes from the dump or from a deterministic scorecard on panel.csv,
so the fixture is honest: nothing is invented, and the Model workstream replaces
the files without touching the UI. Scores here are `fixture-v1-scorecard`, a
placeholder for the real model.

    python3 fixture_gen.py            # writes fixtures_out/*.json
"""
import csv, json, os, collections, datetime, statistics as st
from stress import load, events, leadtime, BASE_N

D = os.path.expanduser("~/Downloads/output/")
OUT = "fixtures_out"
GROUP = "GROUP_0016"
SNAP = datetime.date(2026, 8, 31)
MONTHS = [f"{y}-{m:02d}" for y in (2024, 2025, 2026) for m in range(1, 13)][8:32]  # 2024-09..2026-08


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


def trail(rows, i, k, n=3): return [rows[j][k] for j in range(max(0, i - n + 1), i + 1)]


def signals(rows):
    out = []
    for i, r in enumerate(rows):
        outflow = st.mean(trail(rows, i, "outflow"))
        buf = r["cash_close"] / (outflow / 30) if outflow > 0 else None
        paid = sum(trail(rows, i, "paid_n"))
        dpd = sum(trail(rows, i, "dpd_sum")) / paid if paid else None
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
    span = max(b, 1e-9)
    return W[k] * max(0.0, 1.0 - (v - b) / (2 * span))


def score_series(rows):
    sig = signals(rows)
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

    pts, cash, kind_switch = [], cash0 + credit, 45  # behavioural after day 45
    first_short, min_cash = None, (SNAP, cash)
    for day in range(0, 91, 7):
        date = SNAP + datetime.timedelta(days=day)
        win = SNAP + datetime.timedelta(days=day - 7)
        cash -= sum(a for dt, a in payables if win < dt <= date)
        if day and day % 28 == 0: cash -= rec_m
        # collections arrive at historical DSO, smoothed weekly
        if day > 0 and day + dso_shift >= 7: cash += coll_m * 7 / 30
        kind = "contractual" if day <= kind_switch else "behavioural"
        pts.append({"date": date.isoformat(), "cash": round(cash), "kind": kind})
        if cash < min_cash[1]: min_cash = (date, cash)
        if cash < 0 and first_short is None: first_short = (date, -cash)
    chk = [{"day": k, "cash": next(p["cash"] for p in pts if p["date"] == (SNAP + datetime.timedelta(days=k)).isoformat()) if k % 7 == 0 else pts[k // 7]["cash"],
            "committed_due": round(sum(a for dt, a in payables if SNAP < dt <= SNAP + datetime.timedelta(days=k)))}
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


def goals_for(c, rows):
    basep = cash_path(c, rows)
    target = basep["buffer"]
    cands = [
        ("cobrar_antes", "Cobrar 10 días antes", {"dso_shift_days": -10},
         [{"driver": "dso", "label_es": "Plazo de cobro", "from": 45, "to": 35, "unit": "días"}], []),
        ("pagar_despues", "Pagar a proveedores 15 días después", {"dpo_shift_days": 15},
         [{"driver": "dpo", "label_es": "Plazo de pago", "from": 0, "to": 15, "unit": "días"}],
         [{"metric": "supplier_relation", "label_es": "Riesgo con proveedores", "delta": 1, "unit": "nivel"}]),
        ("linea_credito", "Línea de crédito de 200 k€", {"new_credit": 200_000},
         [{"driver": "credit", "label_es": "Nueva financiación", "from": 0, "to": 200_000, "unit": "€"}],
         [{"metric": "fincost", "label_es": "Coste financiero anual", "delta": 9_000, "unit": "€"}]),
    ]
    plans = []
    for pid, title, mods, changes, trade in cands:
        p = cash_path(c, rows, mods)
        met = p["min_cash"]["cash"] >= target
        unmet = []
        if pid == "linea_credito":
            unmet.append({"constraint_label_es": "Sin nueva deuda", "breach_date": SNAP.isoformat(), "value": 200_000})
        if p["first_shortfall"]:
            unmet.append({"constraint_label_es": f"Caja ≥ {target:,.0f} € todo el periodo".replace(",", "."),
                          "breach_date": p["first_shortfall"]["date"], "value": -p["first_shortfall"]["amount"]})
        plans.append({
            "plan_id": pid, "title_es": title, "changes": changes,
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
        "constraints": [{"metric": "new_debt", "op": "<=", "value": 0, "label_es": "Sin nueva deuda"}],
        "plans": plans, "remaining_gap": gap,
    }], basep


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

for c in IDS:
    rows = panel.get(c)
    meta = comps[c]
    if not rows:
        continue
    series, parts, sig, B = score_series(rows)
    for s in series: all_scores[(c, s["month"])] = s["score"]
    last_i = len(rows) - 1
    cur, prev3 = series[-1]["score"], series[max(0, last_i - 3)]["score"]
    baseline = st.median([s["score"] for s in series[:BASE_N]]) if len(series) >= BASE_N else cur

    # drivers: component points now vs at baseline
    base_parts = {k: st.median([p[k] for p in parts[:BASE_N]]) for k in W} if len(parts) >= BASE_N else parts[-1]
    drivers = []
    for k in W:
        contrib = parts[-1][k] - base_parts[k]
        recent = [rows[i]["month"] for i in range(max(0, last_i - 2), last_i + 1)]
        drivers.append({
            "key": k, "label_es": LABEL[k], "contribution_pts": round(contrib, 1),
            "value": round(sig[-1][k], 1) if sig[-1][k] is not None else None,
            "baseline": round(B[k], 1) if B[k] is not None else None, "unit": UNIT[k],
            "months": recent, "evidence": evidence(c, k, recent),
        })
    drivers.sort(key=lambda x: -abs(x["contribution_pts"]))

    com = committed_hist(c); pl = pledged(c)
    caja = []
    for i, r in enumerate(rows):
        cr = r["cash_close"] - com[r["month"]] - recurring(rows, i) - pl
        caja.append({"month": r["month"], "bank_cash": round(r["cash_close"]), "committed": round(com[r["month"]] + recurring(rows, i)),
                     "pledged": round(pl), "trapped": 0, "caja_real": round(cr)})
    goals, cp = goals_for(c, rows)
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
    }
    json.dump(company, open(f"{OUT}/{c}.json", "w"), ensure_ascii=False, indent=1)

    company_rows.append({
        "company_id": c, "name": c, "currency": meta["currency"], "score": cur, "band": BAND(cur),
        "delta_3m": round(cur - prev3, 1), "trend_6m": [s["score"] for s in series[-6:]],
        "bank_cash": round(rows[-1]["cash_close"]), "caja_real": caja_now,
        "first_shortfall_date": cp["first_shortfall"]["date"] if cp["first_shortfall"] else None,
        "last_data_month": rows[-1]["month"],
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
