# Lab neutral palette — 2026-09-16

## Plan
User selected a light white/gray UI with investment gains red and losses blue.
Keep existing calculations, data, routes and legacy views unchanged.

## Design
Use neutral zinc surfaces, borders and typography in both Labs. Cashflow uses
charcoal spending and slate income (not profit/loss colors). Investment uses a
fixed red/blue return scale, gray unknown/stale data, and neutral strategy tiles.
Keep numeric signs, legend labels, keyboard focus and missing-data distinctions.

## Check plan
Run foundation/syntax/static asset checks, verify color ramps and matching legends,
and inspect populated synthetic previews. Batch publication after checks.

## Data check
Read-only completeness and price-date checks were scoped to ticker-bearing rows.
Private results are reported only to the user, not committed to the public repository.
Stale dates are not missing user cost data; this change does not alter market data.

## Check / Report
- Updated both Lab styles, chart colors, investment ramp and legend together.
- Full npm check passed; 30 foundation tests including a new ramp/legend test.
- Populated synthetic investment and cashflow previews visually checked.
- Cache v188 and versioned references force updated assets on the next deployment.
- No personal records, financial calculations or legacy views changed.
