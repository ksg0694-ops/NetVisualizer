# Lab copy cleanup

## Plan / Design
Remove verbose implementation and methodology prose requested by the user.
Keep units, missing-data warnings, comparison availability and price-return scope.
Keep a default-collapsed short calculation reference and the existing data tables.
No data, calculations, chart interactions or layout changes.

## Do
Removed source disclaimer paragraphs, month lists and numeric axis narration.
Replaced long cashflow and investment methodology sections with three short lines.

## Check
Run regression checks and visually inspect expanded/collapsed calculation sections.

## Report
Full npm check passed (31 foundation tests plus all contracts). Synthetic cashflow
preview verified collapsed by default and three-line reference when expanded.
Data tables and charts retained. Cache v190 prepared for publication.
