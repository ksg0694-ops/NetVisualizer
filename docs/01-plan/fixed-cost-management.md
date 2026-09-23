# Cashflow feedback and fixed-cost management

## Plan
Apply the three user-annotated screenshots: remove report/print/legacy header
actions and explanatory paragraphs, tighten vertical whitespace, expose category
percentage deltas. Preserve existing financial totals and legacy navigation.

## Design
Default pace Y-axis to visible-series bounds; offer a shared-scale toggle for
cross-month comparisons. Category delta is (current / historical average - 1),
with explicit unavailable / zero-baseline states.

Add a separate Life tools fixed-cost register: authenticated cloud persistence,
create/edit monthly planned amount, category, fixed/variable-essential kind,
payment day, payment method, note and active/paused state. No hard deletion.
Transactions and insurance records are not overwritten. Recent fixed-expense
transactions may prefill a draft only after explicit selection.

## Security / Check gate
Owner RLS and version-checked updates prevent cross-account access and stale
overwrites. Keep edits on error; no success before server acknowledgement.
Test model validation, conflict handling, SQL ownership, navigation and assets;
inspect desktop/mobile, empty, populated and edit/save states before deployment.

## Do / Check / Report
Implemented the annotated cashflow changes and Life tools register. Applied the
additive fixed_costs migration on the linked Supabase project; verified RLS enabled
and no records inserted. No existing transaction/insurance records changed.
All npm checks passed (38 foundation tests), including SQL owner isolation,
forbidden anonymous access, stale-version update rejection and validation.
Browser checks: synthetic edit/save updates list and totals; candidate prefill and
insert; pause excludes the item from active totals; 390px form has no horizontal
overflow. Live app route correctly disables writes while signed out.
Authenticated production UI save was not exercised against real user records;
store behavior was exercised with a local fixture and SQL in an isolated engine.
