# Investment market map

## Plan / Design
Scoped user request: Finviz-inspired investment heatmap within the existing Lab.
Reference: https://finviz.com/map (visually inspected 2026-09-16).
Keep the surrounding light UI and the user's red-gain / blue-loss convention.
Use a dark map surface, thin dividers, strategy header bands, ticker-first labels,
size-adaptive typography and a hover/focus summary. Preserve click-through details,
account filters, mobile strategy zoom, unavailable-data semantics and calculations.
This is not market-cap or daily-performance data: area represents own holdings'
valuation; color remains purchase-cost price return, saturated at 20%.
Group headers and separators consume display space; value labels remain exact.

## Check plan
Check the fixed color scale, legend consistency and unchanged area model; inspect
synthetic desktop/mobile screens and hover/click navigation before publication.

## Do / Check / Report — 2026-09-21
- Implemented the dark map panel, strategy header strips, ticker-first tiles and
  adaptive labels. The rest of the Lab retains its neutral light theme.
- Legend colors now come directly from the model to prevent future drift.
- Pointer and keyboard focus display a full readable summary; click opens the
  existing per-account detail. Mobile strategy tiles zoom into individual holdings.
- Full npm check passed, including 30 foundation tests and all runtime contracts.
- Synthetic desktop and 390px mobile layouts checked visually; detail navigation
  and mobile strategy zoom verified. No live private holdings used in screenshots.
- Offline assets and cache v189 prepared. No data or valuation formulas changed.
