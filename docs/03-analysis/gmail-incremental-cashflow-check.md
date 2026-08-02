# Gmail incremental cash-flow data-quality check

## Dataset and grain

- Intended grain: one financial event per transaction row.
- Raw Supabase ledger: 2,213 rows.
- Sources: 874 manual rows and 1,339 BankSalad Gmail rows.
- Manual range: 2025-12-24 through 2026-07-22.
- Gmail range: 2025-08-02 through 2026-08-02.

## Root cause

The original Gmail file contained 1,636 valid unique rows. Only 297 exactly matched the existing database fingerprint; 1,339 were inserted. Since the export was a historical snapshot, differences in time, memo, or payment-method text allowed much of the old period to be misclassified as new.

## Incremental-scope evidence

GitHub Actions dry run `30771067071` applied the 2026-07-24 boundary.

| Check | Result |
| --- | ---: |
| Latest file valid rows | 1,636 |
| Eligible from 2026-07-24 | 44 |
| Ignored historical file rows | 1,592 |
| Raw database rows | 2,213 |
| Existing historical Gmail rows excluded from calculation | 1,295 |
| Counted operational rows | 918 |

The 918 counted rows consist of the retained 874-row manual baseline plus 44 Gmail rows from the August period. Historical Gmail rows excluded from calculation contain 176 income rows, 595 expense rows, and 524 transfers. Their gross absolute values are audit evidence, not a deletion instruction.

## Verification

- Python importer and audit tests: 15 passed locally and in GitHub Actions.
- Full NetVisualizer application check suite: passed.
- Dry run parsed the real Gmail attachment without database writes.
- Required fields, transaction types, amounts, and dates remain valid.

## Risk and remediation

- Severity before remediation: critical for cash-flow interpretation because historical flow was counted twice.
- Remediation: source-aware cutover in both calculation and ingestion.
- Confidence: high; source ranges, row counts, and the live attachment all support the same cause.
- Existing rows are retained for reversibility. A physical database cleanup should be a separate reviewed operation.
