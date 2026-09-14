# Cashflow Lab — Report

New optional app tab for comparison, not replacement. Direct route: `?view=cashflow-lab`. Original cashflow view and Monthly Report remain unchanged.

Delivered visual plan: 2026 annual income/consumption grouped bars + signed ledger surplus; current/selected payday-cycle cumulative consumption vs historic same-day median; category spending vs historic same-day average; report mode reuses charts with concise factual summaries and user-initiated print control. Evidence/method tables collapsed under the visuals. Old-version comparison carries the selected period when available.

The Data dashboard and visualization skills informed the hierarchy, independent consumption comparator, honest missing data, common money scales and chart QA. User explicitly selected NetVisualizer as destination, so existing local Chart.js/authenticated data runtime is preserved instead of a standalone Data app/private snapshot. No DB, account, financial record or external service changes.

Local full suite and browser verification passed (details in Check). PDF output was not independently rendered/verified. No claim of authenticated ledger completeness or financial adequacy. Existing refresh re-renders active Lab after finance data updates.

Publication verified 2026-09-15: code `4d408fa`; branch CI `34903550312`, main CI `34903624920`, Pages `34903623903` all success. Deployment verifier passed cache v184 / appShell `20260915-lab-1` / manifest `208c59e7852cc4e2`. Live direct route opened successfully and shows the new tab; anonymous session correctly displays unknown totals/empty charts. User's real records require existing login.
