# Investment Lab / sync repair — Check

- `npm run check`: full suite passed, including 29 behavioral tests, JS/TS, data contracts, static/offline assets and performance checks.
- `.venv/Scripts/python.exe -m unittest discover -s tools/tests -p "test_*.py" -q`: 17 passed. New tests cover summary-to-migration field agreement and safe error-code logging.
- Additive migration `20260916010000_banksalad_sync_result_columns.sql` applied via project-scoped database query in a transaction. Read-back confirmed all three columns. No transaction rows modified by the migration. SQL is idempotent for later migration replay.
- Normal existing workflow dispatched with both historical repair flags false; run `34996445980` completed successfully. Read-only status check found 7 completed mail runs and one older failed record from September 6; that unrelated historical record was retained.
- Pure model: account reset/filter, weighted cost aggregation, instrument concentration across strategies, market/currency separation, partial cost, missing/future/stale price and FX, zero/empty/debt and fallback states tested.
- Treemap: proportional areas, bounds and non-overlap verified for 1–30 leaves at 1000×400 and 360×350.
- Synthetic local browser: populated overview, account B filter (5,666,000), reset (14,756,000), aggregate position detail, 390px strategy drill-down (growth 7,518,000), empty and logged-out states. No horizontal document overflow at 390px and no browser errors observed. Mobile strategy-only mode hides return-color legend because its tiles encode no returns.
- Local full application direct route `?view=investment-lab` opens the correct tab and shows login-required instead of fake zero holdings.
- Source adapter uses the current authenticated investment group; no public/private sample fallback and no added storage/network calls in Lab UI. All dynamic text uses text nodes.
- Screenshots and synthetic fixture are under untracked `outputs/investment-lab*`, excluded from publication. Populated visual checks were synthetic, not the user's authenticated live holdings. Screen-reader compliance and real-account editor handoff were not exhaustively tested; existing editing implementation is retained.

Deferred intentionally: daily change, target-weight difference, historical FX P&L, dividends/fees/realized P&L. They require additional validated source contracts and are not inferred from current holdings.
