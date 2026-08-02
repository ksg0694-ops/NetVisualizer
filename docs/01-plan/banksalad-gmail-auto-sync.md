# BankSalad Gmail Auto Sync Plan

## Goal

After the one-time Gmail and Supabase authorization setup, the user only sends
the BankSalad export email. NetVisualizer detects the attachment, decrypts it,
normalizes the ledger, removes duplicates, and stores new transactions without
a manual download, ZIP extraction, app upload, or GitHub deployment.

## Scope

### Included

- Gmail read-only search for BankSalad export messages.
- Password-protected ZIP extraction in an ephemeral runner directory.
- Automatic selection of the `가계부 내역` worksheet.
- Header, date, time, type, sign, category, and payment-method normalization.
- Exact duplicate removal inside one workbook.
- Stable cross-run transaction deduplication.
- Supabase transaction insertion and a non-sensitive sync audit trail.
- Scheduled and manual GitHub Actions execution.
- Owner-only Supabase access for personal finance tables.

### Excluded

- Gmail send, delete, archive, label, or read-state changes.
- Storage of raw email bodies, raw ZIP files, decrypted workbooks, passwords,
  account numbers, or full raw worksheet rows.
- Automatic portfolio or asset-snapshot replacement from `뱅샐현황` in this
  slice. That sheet requires a separately reviewed mapping contract.
- Bank login automation, scraping, transfers, or payment actions.

## PDCA

| Phase | Deliverable | Gate |
| --- | --- | --- |
| Plan | Scope, privacy boundary, operating model | Approved user goal |
| Design | Data flow, idempotency, secret inventory, failure handling | No raw finance files persisted |
| Do | Python worker, migration, workflow, auth reactivation | Dry-run works without DB writes |
| Check | Parser, ZIP, duplicate, API and repository checks | Repeated input inserts zero extra rows |
| Report | Deployment, secret registration, first live run | Mail send is the only recurring user action |

## Acceptance Criteria

1. A matching BankSalad ZIP email is discovered with Gmail read-only access.
2. The password is read only from the automation secret store.
3. Decrypted files exist only in a temporary directory destroyed after the run.
4. The worker selects `가계부 내역` even when it is not the first worksheet.
5. Exact rows repeated inside the workbook are counted and skipped.
6. Existing NetVisualizer rows and previously imported BankSalad rows are not
   inserted again.
7. A second run against the same message inserts zero transactions.
8. Failures are recorded without secret values or raw financial payloads.
9. Personal finance reads require the signed-in owner session.
