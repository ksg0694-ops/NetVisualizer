# Income / spending separation — Report

Implemented separate consumption-level and income-flow cards in the existing cashflow screen. Consumption compares first N elapsed days with a median of eligible prior periods, never with current income. Income shows current recorded total plus prior full-period median/range. Existing balance allocation is a collapsed reference; imports, details and categories remain available.

Data KPI-design principles informed separate denominators, explicit source/period definitions, visible provisional status and refusal to invent a spending target. This is a product implementation using existing ledger sources, not a claim about the user's actual spending adequacy.

Local full checks and six new behavioral tests passed. Synthetic desktop/mobile UI and actual unauthenticated app integration checked. No DB/storage/schema changes; no actual financial records edited. Remaining limitation: comparison reflects only ingested/classified transactions, not guaranteed complete history, actual personal budget or future commitments. Different fixed-expense posting dates can affect comparisons.

Publication verified 2026-09-15: implementation `9e95fd4`, branch CI `34900344102`, main CI `34900424053`, Pages `34900423215` all success. `npm run deploy:verify` passed with cache v183 / asset revision `4fe7ff6bfc5347eb`; published spendingAnalysis source hash matches local (newline-normalized). Final app empty-state UI verified after refreshing versioned script URLs. User should reopen old installed-app tabs to activate waiting PWA updates.
