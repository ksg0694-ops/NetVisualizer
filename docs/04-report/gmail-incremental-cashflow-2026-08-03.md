# Gmail incremental cash-flow report

## Outcome

NetVisualizer now treats the existing manual ledger as the historical baseline and BankSalad Gmail as an incremental source beginning 2026-07-24.

- Past Gmail history is no longer included in income, expense, reports, or forecast inputs.
- Future mail syncs ignore pre-cutover rows before database insertion.
- Existing raw Gmail history remains stored and recoverable; no transaction was deleted.
- The browser cache was versioned to force a source-aware refresh.

## Evidence

- The current raw ledger contains 2,213 rows; the corrected calculation scope contains 918.
- Latest BankSalad attachment: 1,636 valid rows, of which 44 are in the incremental period and 1,592 are historical.
- Live dry-run workflow `30771067071` and all 15 Python tests passed.
- The full application check suite passed.
