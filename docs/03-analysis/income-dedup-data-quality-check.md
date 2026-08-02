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

## Confirmed historical follow-up

### Historical welfare overlap

The user confirmed that the 51 legacy-category rows totaling 823,541 KRW were
duplicates of retained welfare-point rows. GitHub Actions run `30768965841`
removed only those matched legacy rows on 2026-08-03 KST.

| Month | Candidate rows |
| --- | ---: |
| 2026-01 | 19 |
| 2026-02 | 10 |
| 2026-04 | 3 |
| 2026-05 | 12 |
| 2026-06 | 7 |

The post-repair ledger contains 2,213 unique rows. Both the July-period and the
January-through-June welfare overlap candidate sets are now zero. Every removed
row has a retained `복지포인트` counterpart, so no financial event was lost.

### Confirmed bonus pair

Two 800,000 KRW income rows dated 2026-04-09 were confirmed as two actual bonus
payments, not a duplicate. Both rows were retained and their category and
subcategory were normalized to `상여금`. The audit records this identity group
as a confirmed legitimate repeat instead of a classification conflict or exact
duplicate candidate.

### Transfer exclusion

The 2,000,000 KRW same-identity transfer group is outside the income and expense
calculation scope. It remains untouched and is reported separately as one
excluded transfer group rather than being included in the actionable duplicate
amount.

## Residual findings kept audit-only

### Exact duplicate candidates

Eight income or expense groups contain 11 excess-row candidates with a gross
absolute amount of 11,355 KRW.

| Type | Candidate impact | Review note |
| --- | ---: | --- |
| Income | 5 KRW | Three very small interest-like duplicate candidates |
| Expense | 11,350 KRW | Includes repeated same-time small-value groups |

These candidates remain untouched because equal values can represent legitimate
separate events.

### Classification conflicts

One identity group covering two rows still has conflicting subcategory labels.
It is a 2026-02-04 expense whose category is `식비`; the rows require semantic
review rather than automatic deletion.

### Legacy dedupe-key coverage

Eight hundred seventy-four legacy/manual rows have no stored `dedupe_key`. This is
not a missing transaction-field error. The importer now recomputes a
classification-agnostic fingerprint for existing rows, so these records remain
protected during future BankSalad imports. A database backfill can be planned
separately if stored-key completeness is desired.

## Automated checks

- Python audit/import tests: 13 passed locally and in GitHub Actions.
- Full application check suite: passed.
- GitHub Actions guarded July and historical repairs and post-audits: passed.
- Raw memos, methods, owner IDs, and transaction UUIDs were not written to logs
  or artifacts.
