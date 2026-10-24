# Finance Intelligence v1 — Design / deployment contract

## Scope shipped in code
- Cashflow Lab selected payday period: categorization suggestion, user-owned reusable rule, user-owned event/special-spend label.
- Import ledger is immutable. Suggestions are strictly opt-in and change **only the existing monthly-close classification overlay**, never past confirmed monthly-close records.
- User-owned `finance_transaction_rules` and `finance_transaction_tags` tables (RLS) provide multi-device persistence. No secrets or raw financial data added to browser storage.
- Explicit special-spend tag keeps total consumption unchanged; only comparison-only daily spending = total consumption less special spending.
- Registered fixed costs are matched to selected-period expenses when name, optional payment-method, date (+/-5 days) all match unambiguously. A missing match means **unconfirmed**, never confirmed unpaid.
- Registered card observed usage matches explicit payment-method aliases; not an official card-company performance or billing estimate.
- Rules do not run at Gmail import time; current importer normalization/deduplication and background sync remain untouched.

## Safe deployment order
1. Review this PR and run CI. Check `npm run check`, `npm run check:foundation` and associated migration RLS validation.
2. Apply additive `supabase/migrations/20261024090000_finance_intelligence.sql` to the linked Supabase project, using migration tooling after approval.
3. Merge to main and verify published static assets and offline manifest (the build step regenerates `index.html` revision, `offline-assets.js` and `version.json`).
4. Sign in; open `?view=cashflow-lab`, select a payday period and confirm new panel loaded.
5. Verify one harmless sample rule and tag through authenticated sessions on two devices. Inspect owner RLS separately without touching existing ledger records. Do not infer completeness of imported data from a successful panel load.

## Boundaries and known gaps
- A rule is *proposed*, never applied to all past transactions.
- Payment-matching precision depends on recorded merchant names; reconciliation is advisory, not a statement of paid/unpaid.
- Card amount is a cashflow-period total of matched transactions; real card statement billing-cycle and performance exclusions are NOT modeled.
- Special spend isn't excluded from pre-existing annual statistics or accounting. This panel adds a separate ordinary/special comparison for the selected payday period.
- Existing monthly-close UI is currently retired from top-level navigation; users can apply suggestions in Cashflow Lab. Rules that conflict remain manual.
- Remaining Phase 3 candidates (budget rollovers, account balance reconciliations, split transactions, cross-period bulk search) need separate scoped planning due to different accounting invariants.
- Migration isn't auto-applied by GitHub Pages. Before it is applied, this panel displays a configuration error instead of creating local-only un-synced pseudo records.

## Verification
- `tools/tests/finance-intelligence.test.mjs` covers deterministic rules, conflicts, month-end due days, conservative matching, tags and card figures.
- No live banking data is modified and no production migration is applied by this pull request.
