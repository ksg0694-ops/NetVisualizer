# Real Estate DSR Simulator - 2026-06-21

## Goal

Add the first finance-analysis feature after the cleanup pass: a real-estate subscription funding simulator that connects current portfolio readiness, planned mortgage assumptions, cash-flow run rate, and an estimated DSR check.

This is a personal scenario tool, not a bank approval calculator.

## Implemented

- Added a `청약 자금 시뮬레이터` panel to the Real Estate tab.
- Simplified the main Real Estate tab so it shows results only; assumptions are edited from a separate `가정 설정` modal.
- Removed extra guidance copy and the self-funding shortfall card from the main panel because the segmented funding bar already communicates the remaining funding gap.
- Added visible target subscription and expected sale price fields to the main simulator summary.
- Inputs use practical planning units:
  - target subscription name
  - target sale price in 만원
  - annual income in 만원
  - existing monthly principal/interest in 만원
  - mortgage rate, stress rate, term, and DSR limit
- Planned loan is no longer typed manually. It is auto-calculated as the smaller of:
  - the loan amount supported by the DSR limit
  - the remaining funding gap after current cash/safe funding
- Assumptions persist in `localStorage` under `smartbook_v2_realestate_analysis_v1`.
- The `기본값` button resets local assumptions.
- Existing `청약 자금 준비도`, dashboard funding KPI, and Finance Roadmap now read the same target budget and planned loan assumptions.
- The simulator calculates:
  - required equity
  - equity shortfall
  - estimated monthly mortgage payment
  - stressed monthly payment for DSR estimation
  - estimated DSR
  - DSR-implied maximum loan
  - estimated months to close the equity shortfall from current year average surplus

## Defaults

| Assumption | Default |
| --- | ---: |
| Target sale price | 800,000,000 KRW |
| Mortgage rate | 4.5% |
| Stress rate | 1.5% |
| Term | 30 years |
| DSR limit | 40% |

The annual income default is derived from current-year cash-flow run rate when the user has not saved a manual assumption.
The planned-loan output is derived from these assumptions and current funding data.

## External Context Checked

- FSC announced third-stage stressed DSR implementation from July 1, 2025, with an additional stress rate of 1.50% for all household loans under the DSR rule, with a temporary non-Seoul-area exception noted in the release.
- Korea Housing Finance Corporation's Didimdol rate page was checked for a current public mortgage-rate reference as of June 2026.

The app still treats these as editable assumptions because loan rules, eligible products, income definitions, regional treatment, and lender underwriting can change.

## Browser Verification

Local target: `http://127.0.0.1:8080`

| Check | Result |
| --- | --- |
| Real Estate tab opens | Pass |
| Simulator defaults render | Pass |
| Main simulator panel has no inline input fields | Pass |
| Main simulator shows target subscription and expected sale price | Pass |
| Main simulator no longer shows the self-funding shortfall card or guidance copy | Pass |
| Assumption modal opens separately | Pass |
| Assumption modal can edit target subscription name | Pass |
| Planned loan input is absent; planned loan is DSR-derived | Pass |
| Leaflet map still renders | Pass |
| DSR limit 40% -> 50% increases auto planned loan | Pass |
| Reset returns DSR limit and auto planned loan to defaults | Pass |
| Reset returns assumptions to defaults | Pass |
| Mobile 390px layout has no horizontal overflow | Pass |
| Browser errors | Pass; only Tailwind CDN production warning remains |

## Notes

- No external financial provider sync was added.
- No Supabase schema or RLS policy was changed.
- Automatic loan approval, account sync, or order/transfer behavior remains intentionally out of scope.
