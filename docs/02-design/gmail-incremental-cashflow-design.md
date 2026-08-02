# Gmail incremental cash-flow design

## Source boundary

| Source | Counted period |
| --- | --- |
| `manual` or legacy | All retained rows |
| `banksalad_gmail` | 2026-07-24 onward |

The boundary follows NetVisualizer's payday accounting periods: the July period ends on 2026-07-23 and the August period starts on 2026-07-24.

## Browser calculation

- Fetch the transaction `source` column.
- Normalize missing sources as `manual` for compatibility.
- Filter historical Gmail rows in the finance repository before cache persistence, accounting-period creation, or cash-flow rendering.
- Move the cache key from `v4` to `v5` so old cached rows without source metadata cannot remain in calculations.

## Gmail ingestion

- Configure `BANKSALAD_IMPORT_START_DATE=2026-07-24` in the scheduled workflow.
- Parse the full attachment in memory, then discard pre-cutover rows before fingerprint comparison or insertion.
- Record eligible and ignored row counts in each sync summary.

## Data safety

No existing Supabase transaction is deleted. The 1,295 already stored historical Gmail rows remain available for audit or a later reviewed archival cleanup, but NetVisualizer excludes them from financial calculations.
