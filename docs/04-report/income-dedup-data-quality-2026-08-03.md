# Income Duplication Repair Report — 2026-08-03

## Outcome

The confirmed July welfare-point duplication has been corrected. Twenty-two
legacy `기타수입` rows totaling 311,200 KRW were removed while their matching
`복지포인트` rows were retained. July income is now 4,300,269 KRW.

The repair was limited to the approved 2026-06-25 through 2026-07-23 period and
verified by a full post-delete ledger read. The same command can be run again
without deleting anything.

## Prevention

The BankSalad importer now treats category and subcategory as editable
classification, not as transaction identity. Reclassifying an existing event
therefore no longer makes a second imported row. Every scheduled mail sync also
runs the full-ledger quality audit, and a guarded manual workflow is available
for explicitly approved repairs.

## Remaining review queue

- The confirmed 51 historical welfare-overlap rows totaling 823,541 KRW were
  removed while all matching `복지포인트` rows were retained.
- The two 800,000 KRW income rows were retained as two actual bonus payments and
  normalized to `상여금`.
- The 2,000,000 KRW transfer group is untouched and excluded from financial
  calculation duplicate candidates.
- 8 remaining income/expense duplicate groups contain 11 excess-row candidates
  totaling 11,355 KRW.
- 1 expense identity group still has conflicting subcategory labels.
- 874 legacy/manual rows lack a stored dedupe key; future imports are still
  protected by recomputed fingerprints.

The remaining 11,355 KRW and one subcategory conflict were not changed. Their
detailed audit is recorded in `docs/03-analysis/income-dedup-data-quality-check.md`.
