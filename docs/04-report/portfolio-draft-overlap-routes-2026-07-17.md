# PortfolioDraft and Overlapping Graph Routes Report

Date: 2026-07-17
Feature: PortfolioDraft v1 + shared graph routes

## Delivered

- Replaced `portfolioEditor.js` column-index access with named object fields.
- Added stable `clientKey` identifiers for existing and newly created draft items.
- Moved portfolio mutation planning and Supabase `upsert`, `insert`, and `delete` commands into `FinanceRepository`.
- Kept classification enrichment in the editor/domain boundary while the repository owns database payload shape.
- Removed graph edge fan offsets and collision-avoidance channels.
- Changed every non-straight edge to one shared middle-axis route, allowing related arrows to overlap before branching.

## Verification

- Repository tests cover edit, add, remove, mutation payloads, and three write commands.
- UI contract rejects indexed draft columns and direct portfolio writes from the editor.
- Browser test changed an amount and confirmed the expected-asset delta, then restored it.
- Browser test added and removed a `new-*` draft item without saving remote data.
- Strategy graph inspection found shared route prefixes used by up to three edges.
- The portfolio save button was not pressed during browser QA; Supabase data was not modified.

## Next

Move payday accounting-period construction into the TypeScript finance domain so `appCore.js` no longer owns a finance calculation rule.
