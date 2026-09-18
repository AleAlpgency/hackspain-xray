# Measuring anticipation without labels

The brief asks how many months early the system sees a change. The dataset has no
outcomes, so there is nothing to be early to. This defines the thing to be early to,
out of the data itself, and then measures the lead.

The event is not a label. Nothing is fitted on it. It exists so the anticipation
number is measured rather than asserted. The score stays calibrated against Friday's
scoring script, as decided.

## What counts as an event

Three conditions, each measured against the company's own first 12 months, not
against a peer group. Sector and size bias disappear when every company is compared
to itself.

- **cash**: buffer below 30 days of its own outflow, or below 40% of its baseline buffer
- **pays_late**: paying suppliers 10+ days later than its own baseline, and actually late
- **unpaid_ar**: overdue receivable stock 1.5x its baseline, and material against monthly billing

Three angles on purpose: the cash, what the company does to its suppliers, what its
customers do to it. Any company survives one of these going bad.

A month is stressed when two of the three fire. An event starts at the first month of
two consecutive stressed months. That persistence rule is the answer to "bache o
caída": one bad month never produces an event.

## What it produces

255 events across 1,286 companies, 20%. The mix at onset:

| conditions | events |
|---|---|
| cash + unpaid_ar | 125 |
| cash + pays_late | 92 |
| pays_late + unpaid_ar | 22 |
| all three | 16 |

All three conditions carry weight, so the event is not one signal wearing a disguise.
Onsets spread from 2025-09 to 2026-07.

Two things to say out loud before a judge says them:

- 424 companies have fewer than 15 covered months and are excluded. The baseline needs 12.
- 42 events land on 2025-09, the first eligible month. Those have a truncated run-up, so
  their lead time is capped by the window, not by the model.

## How the lead is measured

`leadtime(scores, onsets)` takes any score series, higher meaning healthier, and finds
the first month the score went 10 points below the company's own baseline **and stayed
there through onset**. A score that dips, recovers, then falls gets credit for the fall
that stuck, not the lucky first dip. Companies with no event that still produce a
sustained warning are counted as false alarms.

## The bar

The reference detector is the cash condition on its own, which is what anyone with a
bank statement already has:

```
median lead         0.0 months
caught >= 1 month   43%
caught >= 3 months  24%
missed until onset  57%
false alarms        368/607 healthy companies
```

That is the line to beat, and it is beatable: it is blind more than half the time and
cries wolf on six of every ten healthy companies. Put both rows on one slide, yours
against that one. A lead time with nothing to compare it to means nothing.

## Files

- `panel.py` builds `panel.csv`, the company-month panel, from the raw dump
- `stress.py` builds `events.csv` and prints the reference line. `python3 stress.py`
- thresholds are constants at the top of `stress.py`. Retune them, do not delete them
