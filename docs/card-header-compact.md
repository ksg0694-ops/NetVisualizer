# Card header compact — 2026-10-01

Plan/design: remove held-card count; align refresh/add with existing Card heading. Preserve card data and editor behavior.
Do: mount toolbar into section header; remove on account reset; keep mobile buttons readable and keyboard focus visible.
Check: regression test for removed count, header mounting/reset, and browser desktop/mobile verification.

Report: full npm check passed (75 tests). Synthetic browser confirmed add dialog; heading/button vertical centers identical on desktop (75px) and mobile (71px). At 390px document width remained 390px. No financial data changed.
