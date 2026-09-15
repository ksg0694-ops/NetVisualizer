# Cashflow polish — Check

- Full `npm run check` passed. After final legend filtering, foundation (22 tests), JavaScript syntax and offline build passed again.
- June regression: 34 days, five shorter histories, null baseline; annual total and daily average remain present.
- Synthetic browser preview: June unavailable notice, default daily selector, total selector, current-period reset and report mode checked.
- At 390px and 1280px: no horizontal overflow. Annual headers/plots and detail plots align. Missing comparison legends are removed. No browser errors observed.
- Exact local synthetic screenshots: `outputs/lab-polish/mobile.png`, `desktop.png`, `june.png` (not published or committed). Initial screen had redundant prose, mismatched header rows and a duplicate elapsed-day bar; these were removed or consolidated.
- Real-account data not displayed in preview. No database writes or legacy-view changes. Native print/PDF output not re-tested in this polish.
