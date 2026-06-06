# Asset Trend Redesign Slice

Date: 2026-06-06
Branch: `codex/asset-trend-redesign`

## Goal

Use the long-term asset trend screen as the first architecture redesign slice. The goal is not a visual redesign yet. The first step is to separate asset-trend data modeling from `renderDashboard()` so the feature can later move into a full module without changing user-facing behavior.

## Before

```mermaid
flowchart TD
    RenderDashboard["renderDashboard()"] --> TxCards["Cash-flow cards and tx table"]
    RenderDashboard --> ExpenseChart["Expense chart"]
    RenderDashboard --> MonthlyTrend["Monthly income/expense chart"]
    RenderDashboard --> AssetMetrics["Asset metric calculations"]
    RenderDashboard --> AssetCharts["Dashboard + full asset charts"]
    RenderDashboard --> Roadmap["Finance Roadmap"]
```

Problems:

- Long-term asset calculations were embedded inside the large dashboard renderer.
- The dashboard mini chart and full asset trend chart shared inline chart-building logic.
- Asset trend data selection was mixed with DOM writes and Chart.js config.

## After This Slice

```mermaid
flowchart TD
    AssetRows["assets table rows"] --> ParseAsset["parseAssetData()"]
    ParseAsset --> AssetState["dynamicAssetHistory"]

    AssetState --> AssetModule["js/features/assetTrend.js\nAssetTrendFeature.createModel()"]
    AssetModule --> AssetModel["asset trend model\nmetrics + dashboard series + full series"]

    RenderDashboard["renderDashboard()"] --> RenderAssetTrend["renderAssetTrend(db)"]
    RenderAssetTrend --> Summary["renderAssetTrendSummary()"]
    RenderAssetTrend --> Diff["renderAssetTrendDashboardDiff()"]
    RenderAssetTrend --> Charts["renderAssetTrendCharts()"]
    Charts --> ChartConfig["createAssetTrendChartConfig()"]
    ChartConfig --> ChartLifecycle["renderOrUpdateChart()"]
```

## Current Boundary

Moved out of `index.html`:

- Current-year dashboard asset series generation
- Full asset trend series generation
- Goal progress calculations
- Baseline asset calculations
- Month-difference model values

Still inside `index.html`:

- DOM updates
- Chart.js configuration
- Chart lifecycle calls
- Finance Roadmap updates

## Why This Boundary

This keeps the first slice low-risk. The new feature file is pure model logic and does not touch Supabase, localStorage, Chart.js, or the DOM. The existing static app can load it with a normal script tag, so no build system or framework migration is required.

## Next Candidate Steps

1. Move asset trend chart config into the feature boundary.
2. Move asset trend DOM renderers into a screen controller.
3. Split dashboard asset mini chart from full asset trend screen if their UX diverges.
4. Add a small fixture-based regression test for `AssetTrendFeature.createModel()`.
5. Repeat the pattern for cash-flow import or portfolio detail after this screen is stable.
