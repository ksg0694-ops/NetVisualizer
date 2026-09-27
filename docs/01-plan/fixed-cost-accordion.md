# Fixed-cost accordion

## Plan / design
- Replace always-expanded category panels with native details/summary rows, initially collapsed, showing category, count and active monthly subtotal.
- Preserve expanded categories across refresh/edit/filter rendering; reset on account change. Keep item editing and existing totals unchanged.
- Retired-item deletion requires identifying the exact user-intended records first. Do not infer age from transaction dates or delete source transactions/insurance.

## Check / report gates
- Test escaped labels, semantic accordion markup, expansion preservation and unchanged active subtotals. Run project checks and verify deployment.
- Complete record cleanup only after scope is confirmed; clearly report any pending cleanup.

## Result
- User confirmed all paused records. Saved a private git-ignored backup, deleted the three exact owner/version/status-matched records, verified ten active records remain. Source transactions unchanged.
- Accordion regression covers default collapse, expand/collapse persistence, escaping and monthly subtotal. All 58 tests and full project check passed.
