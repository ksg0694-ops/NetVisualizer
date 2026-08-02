# Income Deduplication and Data Quality Check

## Check result

The approved July-period repair completed successfully in GitHub Actions run
`30753708430` on 2026-08-03 KST.

| Check | Before | After | Result |
| --- | ---: | ---: | --- |
| Ledger rows | 2,286 | 2,264 | 22 approved rows removed |
| Approved welfare overlap | 22 rows / 311,200 KRW | 0 rows / 0 KRW | Pass |
| Exact duplicate candidates | 12 groups / 15 extra rows | 11 groups / 14 extra rows | July exact duplicate removed |
| Classification conflicts | 29 groups / 61 rows | 9 groups / 20 rows | July overlap removed |
| Missing required fields | 0 | 0 | Pass |
| Invalid types | 0 | 0 | Pass |
| Zero amounts | 0 | 0 | Pass |
| Future-dated rows | 0 | 0 | Pass |

The row-count delta equals the explicit delete count. A post-delete refetch
found no candidate remaining inside the approved 2026-06-25 through 2026-07-23
period. Re-running the guarded repair is therefore a no-op.

## July reconciliation

Before the repair, July income was 4,611,469 KRW and included 311,200 KRW of
legacy `기타수입` rows that duplicated retained `복지포인트` rows. The corrected
income is:

```text
4,611,469 - 311,200 = 4,300,269 KRW
```

No financial event was removed: each deleted legacy row has a matching retained
`복지포인트` row.

## Residual findings kept audit-only

### Historical welfare overlap

There are 51 legacy-category rows, totaling 823,541 KRW, that match retained
welfare-point rows outside the approved July period.

| Month | Candidate rows |
| --- | ---: |
| 2026-01 | 19 |
| 2026-02 | 10 |
| 2026-04 | 3 |
| 2026-05 | 12 |
| 2026-06 | 7 |

These rows were not changed. A separate review should confirm the affected
monthly reports before any repair is authorized.

### Exact duplicate candidates

Eleven groups contain 14 excess rows with a gross absolute amount of 2,063,355
KRW. This is not equivalent to a 2,063,355 KRW cash-flow error because the total
includes a 2,000,000 KRW transfer candidate.

| Type | Candidate impact | Review note |
| --- | ---: | --- |
| Transfer | 2,000,000 KRW | Confirm whether two same-time transfers are distinct |
| Income | 52,005 KRW | Includes very small interest-like values and May entries |
| Expense | 11,350 KRW | Includes repeated same-time small-value groups |

These candidates remain untouched because equal values can represent legitimate
separate events.

### Classification conflicts

Nine identity groups covering 20 rows still have conflicting category or
subcategory labels. Notable examples include a 2026-04-09 income event for
800,000 KRW classified as both `금융수입` and `상여금`, and a 2026-02-04 expense
event whose category is the same but subcategory differs. Both require semantic
review rather than automatic deletion.

### Legacy dedupe-key coverage

Nine hundred twenty-five legacy/manual rows have no stored `dedupe_key`. This is
not a missing transaction-field error. The importer now recomputes a
classification-agnostic fingerprint for existing rows, so these records remain
protected during future BankSalad imports. A database backfill can be planned
separately if stored-key completeness is desired.

## Automated checks

- Python audit/import tests: 10 passed locally and in GitHub Actions.
- Full application check suite: passed.
- GitHub Actions guarded repair and post-audit: passed.
- Raw memos, methods, owner IDs, and transaction UUIDs were not written to logs
  or artifacts.
