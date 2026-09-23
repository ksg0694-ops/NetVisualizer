# Cashflow promotion and fixed-cost review

## Plan / Design
Promote the existing cashflow Lab to the visible name Cashflow. Preserve the legacy
route and mark it pending deletion; do not delete data or screens. Keep existing
URLs compatible and add a clean cashflow URL for the promoted screen.
Refresh the existing UI, not a new app: ivory/white surfaces, teal income, indigo
spending, softly tinted KPI cards and restrained accent controls. Preserve separate
income/consumption charts, common pace scale and compact explanatory copy.

## Analysis scope
Read-only review of existing user-classified fixed expenses and recurring candidates.
Use source selection and valid-close semantics already used by the app. Separate
payment timing from monthly obligations; no automatic reclassification or private
results in this public repository. Latest source coverage limits completed periods.

## Check plan
Run name/navigation, calculation and asset regressions; inspect populated synthetic
desktop/mobile screens. Keep private analysis local and deploy only application code.

## Do / Check / Report
Promoted desktop/mobile labels and page title; preserved internal IDs and legacy
navigation. Added `?view=cashflow` alias while retaining `?view=cashflow-lab`.
Updated colors, panels and KPI cards without changing financial calculations.
Full npm check passed, including 33 foundation tests. Synthetic populated desktop
and 390px mobile layouts inspected; no horizontal overflow. Direct route and
unauthenticated empty state verified. Prepared cache v192. Read-only fixed-cost
findings remain private; no database writes, reclassification or deletion.
