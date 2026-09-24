# Personal balance sheet: maintenance map

## Files
- `balanceSheetModel.js`: pure current valuation, monthly history, reconciliation.
- `balanceSheet.js` / `balance-sheet.css`: portfolio landing UI (route retained).
- `appCore.js#getBalanceSheetSource`: authenticated source adapter.
- `financeRepository.js`: private input snapshots and attribution tables.
- `sync-market-prices`: existing authenticated quote service, now also refreshes USD/KRW when Yahoo is configured.

## Sources and boundaries
Current balances use the newest owner-scoped `personal_balance_sheet_inputs` snapshot. Existing portfolios are fallback only; never merge both to avoid double counting. The initial input-sheet snapshot was imported privately, not embedded in the public application. The input-sheet link is an editor link, **not ongoing Sheets synchronization**. A later sheet edit requires another import; there is no unattended bank or sheet balance connection.

Existing `assets.total_asset` is authoritative historical NET worth. Do not subtract its debt field again. Missing/duplicate months are gaps; current valuation is a separate point, never a fabricated month-end close. Historical component fields are not reliable attribution inputs.

Quote refresh runs on authenticated app refresh, throttled to four hours. Valid matching prices and FX at most seven calendar days old replace stored KRW valuation for mapped securities with quantities. Unmapped, stale and failed quotes preserve input values. USD cash and foreign deposits without native-currency quantities remain input KRW values. This is not tick-by-tick real time. Personal manual price overrides retain their established precedence.

## Monthly attribution contract
Calendar month (not salary cycle); scope includes investment and pension accounts, including their cash.

`change = closing_net_worth - opening_net_worth`

`investment performance = closing_investment - opening_investment - net_contributions`

`change = investment performance + net_saving + other_change + reconciliation difference`

- Contributions are net transfers across the investment+pension boundary, including in-kind transfers. Trades inside that scope are not contributions.
- Saving is external income minus consumption, interest and taxes. Exclude internal transfers, asset purchases and principal repayments. Distributions/fees must be counted once under a documented convention.
- Housing revaluation, gifts, corrections and debt write-offs require explicit other-change records; never force them into investment return.
- A reviewed flow row requires beginning/end balances, contributions, saving, other change and nonempty evidence. Evidence should contain source references, period boundary, investment-scope cash treatment, distribution treatment and coverage.
- Reconciliation only renders when flow balances match the historical points. Missing evidence stays null, not zero. Differences remain visible even for reviewed rows.
- The table/schema/calculation are a foundation, not a completed historical attribution or automatic monthly-close pipeline. Future work: collect owner-reviewed month-end investment balances and boundary transfers, and calendar-month saving from classified transactions, then add close/review UI.

## Safety and verification
Append-only source snapshots; both new tables enforce owner RLS. No anonymous access. No update/delete of source snapshots via the browser. Legacy history/portfolios preserved. Tests cover housing debt, missing/duplicate history, contribution exclusion, stale FX fallback, RLS and incomplete review rejection. Synthetic fixture/screenshot exports remain ignored under `outputs/`.
