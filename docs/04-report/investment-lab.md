# Investment Lab / sync repair — Report

Implemented in `0d5d2a5`; published at https://ksg0694-ops.github.io/NetVisualizer/?view=investment-lab .

- Sync: three additive metadata columns applied; normal run `34996445980` succeeded. Later scheduled runs `34997812863` and `35016215380` also succeeded. Historical repair flags remained false; no existing transaction data was edited by the schema change.
- Lab: read-only account/strategy exploration, proportional grouped treemap, weighted comparable price return, concentration/coverage, contribution ranking and inspectable position details. Existing portfolio and editing screens remain available via explicit handoff.
- Data dashboard/visualization guidance informed shared calculations, honest missing-data/freshness states and mobile drill-down. The explicitly selected existing NetVisualizer runtime and GitHub hosting were preserved rather than introducing a separate artifact framework.
- Quality: full `npm run check`, 29 JS tests, 17 Python tests. Synthetic populated desktop/mobile UI checked; real app direct route and logged-out state checked locally and live. Real authenticated holdings and end-to-end editing were not inspected in the browser.
- Publication: branch CI `35029200968`, main CI `35029276821`, Pages `35029275483` all successful. Deployment verifier passed cache v187, appShell 20260916-investment-1, manifest 131b647f7d65308a.
- No private holdings/credentials or local test screenshots shipped. `outputs/` remains untracked.

Intentional scope limits: price return excludes historical FX, dividends, fees and realized P&L. Daily change and target allocation are not invented without a verified comparison/target source. Stale values are retained with warnings and neutral map colors.
