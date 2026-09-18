# Product

**Positioning:** An internal health and planning tool for group finance teams. It scores each legal entity every month from the bank and ERP data Embat already holds, says why the number moved, projects where cash is heading, and compares what would have to change.

**Buyer/users:** Embat sells it as a module to its corporate clients. Users are the group CFO and treasury team, restricted to their authorised companies.

**Scope note:** this narrows the earlier product doc. Everything outward facing is out: no external ratings, no lender marketplace, no sharing links, no verification. The number lives inside the company that produced it.

## Problem and value

A €2m balance against €4m due next month is not a €2m position. The bank sees the balance; the ERP holds the commitment. Embat holds both, and nobody puts them in one number.

The same gap exists inside a group. Consolidated cash looks fine while individual subsidiaries cannot cover their own month. In the challenge dataset, 31% of companies with a positive bank balance are negative once 30-day commitments are subtracted, and 36% of multi-entity groups are healthy consolidated with at least one subsidiary short.

**Value:** the finance team sees which entity is turning, why, and how many months early, without waiting for filed accounts.

## Core workflow

1. **Saber:** current and historical health per entity, the trajectory, the causes with signed contributions, and the evidence behind each one down to the invoice or transaction.
2. **Prever:** a 90-day cash path with 30/60/90 checkpoints, minimum cash, first shortfall date, and funding needed above a stated buffer. Contractual timing is distinguished from behavioural estimates.
3. **Actuar:** one dated goal per entity, with bounded candidate plans compared by target attainment, cash impact, trade-offs, and any constraint they breach. If no plan qualifies, the remaining gap is stated.

A monitor raises alerts on its own, in both directions, and only on sustained change. A single bad month never fires.

Evidence gates the output. Where history is short, coverage is partial, or too many movements are uncategorised, the score is marked not publishable and the reasons are shown. Missing evidence is never read as poor health: 501 of the 1,286 companies in the dataset have no invoices at all.

## Embat connection and scope

[Embat already provides treasury forecasting and risk monitoring](https://www.embat.io/treasury-management/cashflow). We add the health trajectory, the committed-cash view across a group, and the goal workflow on top of it. Exposed as tools, this is a capability their TellMe agent can call rather than a second chat surface.

Start with challenge CSVs and fixed assumptions. No payment execution, no action assignment, no optimiser: the planner compares bounded scenarios, it does not search.

**Success:** a finance user can explain a cash gap, see it before it arrives, and compare plans against a dated goal. Validate the score on unseen companies, and report warning lead time and false alerts against the cash-only reference detector, which today has a median lead of 0 months, misses 57% until onset, and fires on 368 of 607 healthy companies.

Team plan: [REQUIREMENTS.md](REQUIREMENTS.md).
