# Cashflow comparability — Report

Implemented user correction in Lab: retain historical records regardless of changed-close status, display smaller comparison cohorts instead of hiding them, split annual income and consumption, offer daily-average consumption for unequal periods, use actual dates and a fixed consumption Y maximum across selected months. Previous cashflow screen defaults preserved; no financial records modified.

Visualization skill principles informed within-series comparisons, explicit independent income/spending scales, invariant across-month consumption scale, and honest partial-period/short-history treatment. Existing NetVisualizer runtime and authorized-source privacy boundary preserved.

Local full tests and rendered chart checks passed. Source-backed read-only eligibility validation confirms September compares all eight prior 2026 periods. Published code `4a813d6`: branch CI `34959124264`, main CI `34959205008`, Pages `34959203682` success. Deployment verifier: cache v185, assets `f65201100ed47c2e`. Live browser confirms separate income/spending panels, daily-average control and fixed-axis note. Original financial records unchanged.
