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

- 51 historical welfare-overlap candidates totaling 823,541 KRW across January,
  February, April, May, and June 2026.
- 11 exact-duplicate groups containing 14 excess-row candidates; most of the
  gross 2,063,355 KRW is a 2,000,000 KRW transfer that requires confirmation.
- 9 category/subcategory conflict groups, including an 800,000 KRW income event.
- 925 legacy/manual rows without a stored dedupe key; future imports are still
  protected by recomputed fingerprints.

None of these residual candidates was changed. Their detailed audit is recorded
in `docs/03-analysis/income-dedup-data-quality-check.md`.
