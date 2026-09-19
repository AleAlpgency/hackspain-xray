# Product

**Positioning:** An internal health and planning tool for group finance teams. It scores each legal entity every month from the bank and ERP data Embat already holds, says why the number moved, projects where cash is heading, and compares what would have to change.

**Buyer/users:** Embat sells it as a module to its corporate clients. Users are the group CFO and treasury team, restricted to their authorised companies.

**Pricing:** flat per group, never per subsidiary. Partial coverage does not just reduce revenue, it breaks the product: consolidated cash is wrong, the cross-entity comparison is uncomputable, and the intercompany plan disappears. Group size in the dataset is a median of 3 entities and a mean of 5.1, so per-unit pricing would also be small. Where entities lack the evidence to be scored, say so in the product rather than discount: it is a reason for the client to connect more data.

**Scope note:** this narrows the earlier product doc. Everything outward facing is out: no external ratings, no lender marketplace, no sharing links, no verification. The number lives inside the company that produced it.

## Problem and value

A €2m balance against €4m due next month is not a €2m position. The bank sees the balance; the ERP holds the commitment. Embat holds both, and nobody puts them in one number.

The same gap exists inside a group. Consolidated cash looks fine while individual subsidiaries cannot cover their own month. In the challenge dataset, 31% of companies with a positive bank balance are negative once 30-day commitments are subtracted, and 36% of multi-entity groups are healthy consolidated with at least one subsidiary short.

**Value:** the finance team sees which entity is turning, why, and how many months early, without waiting for filed accounts.

## Core workflow

1. **Saber:** current and historical health per entity, the trajectory, the causes with signed contributions, and the evidence behind each one down to the invoice or transaction.
2. **Prever:** a 90-day cash path with 30/60/90 checkpoints, minimum cash, first shortfall date, and funding needed above a stated buffer. Contractual timing is distinguished from behavioural estimates.
3. **Actuar:** one dated goal per entity, with bounded candidate plans compared by target attainment, cash impact, trade-offs, and any constraint they breach. If no plan qualifies, the remaining gap is stated.

One of those plans moves money that already belongs to the group. Where a sibling entity holds free cash above its own buffer, the planner proposes the transfer before it proposes a bank line, and shows which entity it comes from and what it costs that entity. In the dataset, 49% of multi-entity groups with a short subsidiary could cover the hole entirely from inside, and 200 intercompany or shareholder loans already exist across 33 companies, so the practice is running today without the data to aim it. The tool proposes the movement and flags that it needs a loan agreement at market rate. It does not execute it, and consolidated group debt does not change.

A monitor raises alerts on its own, in both directions, and only on sustained change. A single bad month never fires. The monitor, not the dashboard, is the recurring value: a health check is consulted, a monitor interrupts. That makes precision a product requirement rather than a preference, because alerts that cry wolf get silenced in the second month.

Evidence gates the output. Where history is short, coverage is partial, or too many movements are uncategorised, the score is marked not publishable and the reasons are shown. Missing evidence is never read as poor health: 501 of the 1,286 companies in the dataset have no invoices at all.

## Embat connection and scope

[Embat already provides treasury forecasting and risk monitoring](https://www.embat.io/treasury-management/cashflow). We add the health trajectory, the committed-cash view across a group, and the goal workflow on top of it. Exposed as tools, this is a capability their TellMe agent can call rather than a second chat surface.

Start with challenge CSVs and fixed assumptions. No payment execution, no action assignment, no optimiser: the planner compares bounded scenarios, it does not search.

**Adoption:** a 90-day pilot on a client Embat already serves, where onboarding cost is zero because the data is connected. Ninety days is not a free trial, it is the shortest window in which we can show which alerts turned out to be right.

**Success:** a finance user can explain a cash gap, see it before it arrives, and compare plans against a dated goal. Validate the score on unseen companies, and report warning lead time and false alerts against the cash-only reference detector, which today has a median lead of 0 months, misses 57% until onset, and fires on 368 of 607 healthy companies.

Team plan: [REQUIREMENTS.md](REQUIREMENTS.md).
