# Gmail incremental cash-flow plan

## Problem

BankSalad mail exports contain a rolling historical ledger rather than only transactions added since the previous mail. The original importer compared a detailed fingerprint, so historical rows with changed time, memo, or payment-method text were treated as new and accumulated beside the manual ledger.

## Goal

- Preserve the existing manual ledger through the July close.
- Count and import BankSalad Gmail rows only from the August accounting period onward.
- Keep previously imported historical Gmail rows recoverable instead of deleting them.
- Make the rule identical in the browser calculation, Gmail worker, and quality audit.

## Acceptance criteria

- The cutover is 2026-07-24, the day after the July period end.
- Manual rows remain in calculation scope regardless of date.
- Gmail rows before the cutover are excluded from calculation and future inserts.
- Gmail rows on or after the cutover remain visible and continue to sync.
- Cache version changes so clients cannot reuse source-less transaction cache rows.
- Full application checks, Python tests, and a real Gmail dry run pass.
