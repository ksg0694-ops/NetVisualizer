# Compact fixed costs

Plan: make the existing register scannable without changing saved data or import logic.
Design: compact light header and summary; category sections with active monthly subtotals; short rows, expandable notes, explicit refresh label. Desktop two columns, mobile one; touch actions at least 44px.
Do: map category aliases for display only; unknown categories stay visible under Other. Inactive items never enter totals. Existing owner/version save protection remains unchanged.
Check: grouped totals, alias handling, immutable inputs, existing store tests, desktop/mobile synthetic UI, full checks and deployment.

Results: 40 tests and full npm check passed. Synthetic 1280px and 390px views inspected; edit/save changed the group subtotal and total correctly; inactive records remained excluded in All view. Production data was not edited. Release v195.
