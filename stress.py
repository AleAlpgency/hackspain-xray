"""Stress events and lead-time measurement for the X-Ray score.

An event here is an observable breakdown in a company's own behaviour, defined
from the data. It is NOT a training label: nothing is fitted on it. It exists
only so that "we saw it N months early" is a measured number and not a claim.

    python3 stress.py                 # build events.csv, print the report
    from stress import events, leadtime

Every threshold below is a knob. They are set where the signal separates on
this dataset, not from theory. Retune them, do not remove them.
"""
import csv, collections, statistics as st

PANEL = "panel.csv"

BASE_N       = 12    # months of a company's own history that form its baseline
BUFFER_FLOOR = 30.0  # days of outflow covered by cash
BUFFER_FRAC  = 0.4   # ...or this fraction of its own baseline buffer
DPD_JUMP     = 10.0  # paying this many days later than its own baseline
DPD_FLOOR    = 5.0   # and actually late, not just relatively later
OVD_MULT     = 1.5   # overdue receivable stock vs its own baseline
OVD_FLOOR    = 0.15  # and material against monthly billing
MIN_HITS     = 2     # how many of the three conditions must fire together
PERSIST      = 2     # consecutive months required. This is the pothole filter.

SCORE_DROP   = 10.0  # points below baseline that count as a warning


def _mo(m):
    """'2025-03' -> integer month index, so month arithmetic is subtraction."""
    return int(m[:4]) * 12 + int(m[5:7])


def load(path=PANEL):
    """panel.csv -> {company_id: [row, ...]} trimmed to months with activity."""
    by = collections.defaultdict(list)
    for r in csv.DictReader(open(path)):
        for k, v in r.items():
            if k not in ("company_id", "month"):
                r[k] = float(v)
        by[r["company_id"]].append(r)
    out = {}
    for c, rows in by.items():
        rows.sort(key=lambda r: r["month"])
        live = [i for i, r in enumerate(rows) if r["n"] > 0]
        if live:
            out[c] = rows[live[0]:live[-1] + 1]
    return out


def _trail(rows, i, key, n=3):
    return [rows[j][key] for j in range(max(0, i - n + 1), i + 1)]


def signals(rows):
    """Per month: cash buffer in days, own payment lateness, overdue AR stock.

    Three angles on purpose: cash, what the company does to its suppliers, what
    its customers do to it. A company can survive one of them going bad.
    """
    out = []
    for i, r in enumerate(rows):
        outflow = st.mean(_trail(rows, i, "outflow"))
        buf = r["cash_close"] / (outflow / 30) if outflow > 0 else float("inf")

        paid = sum(_trail(rows, i, "paid_n"))
        dpd = sum(_trail(rows, i, "dpd_sum")) / paid if paid else None

        billed = st.mean(_trail(rows, i, "inv_ar", 12))
        ovd = st.mean(_trail(rows, i, "ovd_amt")) / billed if billed > 0 else None

        out.append((buf, dpd, ovd))
    return out


def _base(vals):
    ok = [v for v in vals[:BASE_N] if v is not None and v != float("inf")]
    return st.median(ok) if ok else None


def events(panel):
    """-> ({company: onset_month}, {(company, month): [conditions that fired]})

    Onset is the FIRST month of a run of PERSIST consecutive stressed months, so
    a company that spends one bad month and recovers never produces an event.
    """
    onsets, fired = {}, {}
    for c, rows in panel.items():
        if len(rows) < BASE_N + PERSIST + 1:
            continue
        sig = signals(rows)
        b_buf = _base([s[0] for s in sig])
        b_dpd = _base([s[1] for s in sig])
        b_ovd = _base([s[2] for s in sig])

        stressed = []
        for i in range(BASE_N, len(rows)):
            buf, dpd, ovd = sig[i]
            hits = []
            if b_buf is not None and buf < max(BUFFER_FLOOR, BUFFER_FRAC * b_buf):
                hits.append("cash")
            if (dpd is not None and b_dpd is not None
                    and dpd > b_dpd + DPD_JUMP and dpd > DPD_FLOOR):
                hits.append("pays_late")
            if (ovd is not None and b_ovd is not None
                    and ovd > max(OVD_FLOOR, OVD_MULT * b_ovd)):
                hits.append("unpaid_ar")
            if hits:
                fired[(c, rows[i]["month"])] = hits
            stressed.append(len(hits) >= MIN_HITS)

        for i in range(len(stressed) - PERSIST + 1):
            if all(stressed[i:i + PERSIST]):
                onsets[c] = rows[BASE_N + i]["month"]
                break
    return onsets, fired


def leadtime(scores, onsets, drop=SCORE_DROP):
    """How many months before onset the score first went, and stayed, low.

    scores: {(company_id, 'YYYY-MM'): value}, higher = healthier.
    -> (leads, false_alarms, n_clean) where leads is {company: months_early}.

    A warning only counts if it holds all the way to onset. A score that dips,
    recovers and dips again gets credit for the dip that stuck, not the first one.
    """
    by = collections.defaultdict(dict)
    for (c, m), v in scores.items():
        by[c][m] = v

    leads, false_alarms, clean = {}, 0, 0
    for c, series in by.items():
        months = sorted(series)
        if len(months) < BASE_N + 1:
            continue
        base = st.median(series[m] for m in months[:BASE_N])
        low = [m for m in months if series[m] <= base - drop]

        if c in onsets:
            e = onsets[c]
            before = [m for m in months if m < e]
            w = None
            for m in reversed(before):                 # walk back while still low
                if series[m] <= base - drop:
                    w = m
                else:
                    break
            leads[c] = _mo(e) - _mo(w) if w else 0
        else:
            clean += 1
            run = 0
            for m in months:                           # a warning nobody needed
                run = run + 1 if m in low else 0
                if run >= PERSIST:
                    false_alarms += 1
                    break
    return leads, false_alarms, clean


def naive_score(panel, fired):
    """Reference detector: the cash condition alone, as a 100/0 score.

    Anything worth pitching has to beat this, because a junior analyst with a
    bank statement already has it.
    """
    s = {}
    for c, rows in panel.items():
        for r in rows:
            k = (c, r["month"])
            s[k] = 0.0 if "cash" in fired.get(k, ()) else 100.0
    return s


def report(name, leads, false_alarms, clean):
    if not leads:
        print(f"{name}: no events reached")
        return
    v = sorted(leads.values())
    early = [x for x in v if x >= 1]
    print(f"{name}:")
    print(f"  events covered      {len(v)}")
    print(f"  median lead         {st.median(v):.1f} months")
    print(f"  caught >= 1 month   {len(early) / len(v):.0%}")
    print(f"  caught >= 3 months  {len([x for x in v if x >= 3]) / len(v):.0%}")
    print(f"  missed until onset  {len([x for x in v if x == 0]) / len(v):.0%}")
    print(f"  false alarms        {false_alarms}/{clean} healthy companies")


def demo():
    """Self-check on hand-built series where the right answer is known."""
    months = [f"{y}-{m:02d}" for y in (2024, 2025, 2026) for m in range(1, 13)]
    months = months[8:8 + 18]                      # 2024-09 .. 2026-02
    onsets = {"stuck": "2025-12", "dipped": "2025-12"}

    s = {}
    for i, m in enumerate(months):                 # drops at 2025-09, stays down
        s[("stuck", m)] = 100.0 if i < 12 else 85.0
    for i, m in enumerate(months):                 # dips, recovers, drops again
        s[("dipped", m)] = 85.0 if i in (12, 14) else 100.0
    leads, fa, clean = leadtime(s, onsets)
    assert leads["stuck"] == 3, leads
    assert leads["dipped"] == 1, leads           # credit for the dip that stuck

    s = {("fine", m): 100.0 for m in months}       # healthy, never warns
    s[("noisy", months[13])] = s[("noisy", months[14])] = 80.0
    for m in months:
        s.setdefault(("noisy", m), 100.0)
    leads, fa, clean = leadtime(s, {})
    assert (leads, fa, clean) == ({}, 1, 2), (leads, fa, clean)
    print("demo ok")


if __name__ == "__main__":
    demo()
    panel = load()
    onsets, fired = events(panel)
    print(f"\n{len(onsets)} events in {len(panel)} companies "
          f"({len(onsets) / len(panel):.0%})")

    with open("events.csv", "w") as f:
        w = csv.writer(f)
        w.writerow(["company_id", "onset_month", "conditions_at_onset"])
        for c, m in sorted(onsets.items()):
            w.writerow([c, m, "|".join(fired.get((c, m), []))])

    leads, fa, clean = leadtime(naive_score(panel, fired), onsets, drop=50)
    report("\nreference (cash condition alone)", leads, fa, clean)
    print("\nNow run leadtime(your_scores, onsets) and beat that line.")
