# Balance sheet visual alignment and foreground notifications

## Plan / design
- Use the selected September 24 visual, amended by the September 25 feedback; no new concept/template. Existing production app remains the target.
- Place My Assets directly before Cash Flow on desktop/mobile. Retain one app-shell title; compact toolbar and panel spacing. Bright blue/green/purple/pink/orange Font Awesome icons and KPI icon badges.
- Housing summary shows only net amount. Expand for asset/debt detail.
- Input snapshot belongs to its as-of month (September), not today's moving date. Join its stored net worth to historical series only if the month has no existing record. Preserve the as-of date and do not treat an interim input as a closed month or infer attribution. Current market valuation remains in top KPIs, never retroactively rewrites that input-month point.
- Notifications use a manual popover/top-layer when supported, with a high-z-index fallback. Keep existing vertical screen position and preserve all form state.

## Gates
- Test input-month attribution, existing-month precedence, future/missing input handling, navigation order, title duplication, notification top layer and timed cleanup.
- Compare amended reference and rendered desktop together; mobile and real modal notification checks; full project tests then deploy/verify.

## Do / check / report
- Implemented navigation order, single title, bright icon badges, compact responsive layout, collapsed housing notes and input-month timeline.
- Toasts use the native top layer; verified above actual settings backdrop without closing the form.
- Full `npm run check` passed with 56 tests. Desktop/mobile visual QA passed (see `design-qa.md`). No database writes or private data committed.
- Deployment gate: batch commit and push, request Pages build, compare remote manifest/HTML/cache against local revision.
