# Income Deduplication and Data Quality Plan

## Goal

Correct the confirmed July 2026 welfare-point income duplication, audit the full
transaction ledger, and prevent category changes from creating a second copy of
the same financial event.

## Scope

### Included

- Audit every owner transaction through the existing service-role worker.
- Detect exact duplicate rows and transaction-identity conflicts.
- Treat category and subcategory as classification attributes, not identity.
- Remove only approved 2026-07 salary-period `복리후생환불` rows in `기타수입`
  when a matching `복지포인트` row exists.
- Verify row counts and income totals after repair.
- Run a compact quality audit after BankSalad synchronization.

### Excluded

- Automatic deletion of unrelated duplicate candidates.
- Reclassification of unrelated income or expense rows.
- Raw transaction exports in GitHub artifacts or logs.

## Grain and Rules

- Intended grain: one real financial event per transaction row.
- Identity fields: date, time, type, amount, memo, method, and currency.
- Classification fields: category and subcategory.
- An exact duplicate repeats both identity and classification.
- A classification conflict repeats identity with different classifications.
- Internal-transfer debit and credit rows remain separate because amount sign,
  memo, or method differs.

## PDCA

| Phase | Deliverable | Gate |
| --- | --- | --- |
| Plan | Scope, grain, approved repair boundary | No unrelated deletion |
| Design | Audit model, repair guardrails, workflow | No raw finance data in logs |
| Do | Audit worker, dedupe identity update, workflow integration | Unit tests pass |
| Check | Full-ledger pre/post audit | Approved overlap becomes zero |
| Report | Findings, deployment, residual risks | GitHub Pages reflects corrected totals |

## Acceptance Criteria

1. The full owner ledger is profiled without logging raw memos or methods.
2. July welfare-point overlap is reported before repair.
3. Only matched legacy `기타수입` welfare-refund rows are deleted.
4. July income becomes 4,300,269 KRW when welfare points are counted once.
5. Re-running the repair is a no-op.
6. Category-only changes produce the same BankSalad transaction fingerprint.
7. Remaining exact or classification-conflict candidates are reported, not
   deleted automatically.
8. Historical welfare overlaps outside 2026-06-25 through 2026-07-23 remain
   audit-only until separately reviewed.
