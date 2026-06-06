# Current Architecture Map

Date: 2026-06-06
Branch: `codex/asset-trend-redesign`

## Purpose

This document maps the current NetVisualizer structure before any architecture redesign. It describes what exists today, not the desired future shape.

The current app is a static PWA built around one large `index.html` file. Most UI, state, Supabase reads/writes, parsing, chart rendering, transaction import, portfolio editing, real-estate views, and Quant workflows are implemented in that single file. The main exception is the Supabase Edge Function for market price sync. The first redesign slice now extracts long-term asset trend model logic into `js/features/assetTrend.js` and starts a visible two-level workspace layout.

## File-Level Map

```mermaid
flowchart TD
    User["User Browser"] --> App["index.html\nSingle-file SPA"]
    App --> AssetTrendModule["js/features/assetTrend.js\nasset trend model"]
    App --> Manifest["manifest.json\nPWA metadata"]
    App --> SW["sw.js\nstatic cache + network-first fallback"]
    App --> CardImage["img/cards/s_choice.png"]

    App --> Docs["docs\nanalysis, SQL drafts, progress reports"]
    App --> Scripts["scripts\nKIS secret/dry-run helpers"]
    App --> SupabaseDir["supabase\nconfig + Edge Function"]

    SupabaseDir --> PriceFn["sync-market-prices\nEdge Function"]
```

## Runtime Container Diagram

```mermaid
flowchart LR
    Browser["Browser / PWA Shell"] --> Index["index.html"]

    Index --> CDN["CDN Libraries\nTailwind, Supabase JS, Chart.js, Leaflet, FontAwesome"]
    Index --> LocalStorage["localStorage\napp cache + import audit"]
    Index --> ServiceWorker["Service Worker\nstatic cache"]

    Index --> SupabaseClient["Supabase JS Client\nanon key in browser"]
    SupabaseClient --> Tables["Supabase Tables\ntransactions, assets, portfolios, cards, insurances,\nquant_strategy_rules, portfolio_market_prices"]
    SupabaseClient --> EdgeFunction["Supabase Edge Function\nsync-market-prices"]
    EdgeFunction --> PriceProviders["Optional Quote Providers\nKIS or Twelve Data when configured"]
    EdgeFunction --> PriceTables["portfolio_market_prices\nportfolio_price_history"]

    Index --> OpenStreetMap["Leaflet + OpenStreetMap Tiles"]
```

## Current Navigation Shape

The app is moving away from one flat tab list. The first visible step keeps all existing Finance screens but places them under a Goal layer.

```mermaid
flowchart TD
    AppShell["App shell"] --> GoalLayer["Goal layer\nFinance active"]
    GoalLayer --> FutureGoals["Career / Project / Health\nvisible placeholders"]
    GoalLayer --> FinanceTools["Finance tool layer"]

    FinanceTools --> Summary["Summary\nformerly Dashboard"]
    FinanceTools --> Portfolio["Portfolio"]
    FinanceTools --> CashFlow["Cash Flow"]
    FinanceTools --> AssetTrend["Long-Term Asset"]
    FinanceTools --> RealEstate["Real Estate"]
```

Current limitation: only Finance is interactive. The other goal buttons are intentionally disabled placeholders until their data model and tool sets are designed.

## Current SPA Internal Shape

These are logical areas inside `index.html`; they are not separate modules yet.

```mermaid
flowchart TD
    HtmlViews["HTML View Templates\nDashboard, Portfolio, Cash Flow,\nAsset Trend, Real Estate, Invest Detail"]

    State["Global Mutable State\nmonthlyDB, dataCache, dynamicPortfolioData,\nrawPortfolioData, marketPriceMap,\nquantStrategyRules, txImportCandidates"]

    AssetTrendModule["AssetTrendFeature\npure asset trend model"]

    DataAdapter["Data Adapter Functions\nfetchRemoteTables, fetchSheetData,\nformatRows, mergeTransactionRowsIntoCache"]

    Parsers["Parser / Normalizer Functions\nparseTxData, parseAssetData,\nparsePortfolioData,\nparseQuantStrategyRules,\nparseMarketPrices"]

    Renderers["Render Functions\nrenderDashboard, renderPortfolio,\nrenderInvestDetail, renderRealEstate,\nrenderAddons, renderSections"]

    ChartLayer["Chart Layer\nrenderOrUpdateChart, destroyChart,\nwithChartTransitions"]

    Mutations["Mutation Flows\nsubmitTransaction, confirmTxImport,\nsubmitPortfolio, saveQuantRules,\nsaveQuantSignals, saveMarketPrice"]

    Events["DOM Event Bindings\nnav clicks, month buttons,\nfile input, keyboard navigation"]

    HtmlViews --> Events
    Events --> Mutations
    Events --> Renderers
    DataAdapter --> Parsers
    Parsers --> State
    State --> AssetTrendModule
    AssetTrendModule --> Renderers
    State --> Renderers
    Renderers --> ChartLayer
    Mutations --> DataAdapter
    Mutations --> State
```

## Startup And Read Flow

```mermaid
sequenceDiagram
    participant Browser
    participant Index as index.html
    participant Cache as localStorage
    participant Supabase
    participant State as Global State
    participant UI as Renderers

    Browser->>Index: Load page
    Index->>Browser: Register service worker
    Index->>Cache: loadCachedData()
    alt cache exists
        Cache-->>Index: smartbook_v2_data_cache
        Index->>State: applyCachedData()
        State->>UI: renderSections()
    end
    Index->>Supabase: fetchRemoteTables(ALL_DATA_TABLES)
    Supabase-->>Index: table rows
    Index->>Index: formatTransactionRows / formatAssetRows / formatPortfolioRows
    Index->>Cache: persistDataCache()
    Index->>State: parseTxData / parseAssetData / parsePortfolioData
    State->>UI: renderDashboard / renderPortfolio / renderAddons
```

## State And Storage Map

```mermaid
flowchart TD
    SupabaseTables["Supabase Tables"] --> DataCache["dataCache\n2D row arrays + raw auxiliary rows"]
    DataCache --> LocalDataCache["localStorage\nsmartbook_v2_data_cache"]
    DataCache --> ParsedState["Parsed Runtime State"]

    ParsedState --> MonthlyDB["monthlyDB\nmonthKey -> transactions"]
    ParsedState --> AssetState["dynamicAssetHistory\ndynamicAssetSnapshots"]
    ParsedState --> PortfolioState["dynamicPortfolioData\nrawPortfolioData"]
    ParsedState --> AddonState["addonCards\naddonInsurances"]
    ParsedState --> QuantState["quantStrategyRules\nmarketPriceMap"]

    ImportRuntime["txImportCandidates\ntxImportStats\ntxImportRawRows"] --> ImportAudit["localStorage\nsmartbook_v2_tx_import_runs"]
```

## Screen Dependency Map

```mermaid
flowchart LR
    MonthlyDB["monthlyDB"] --> Dashboard["Dashboard"]
    MonthlyDB --> CashFlow["Cash Flow"]
    MonthlyDB --> PortfolioSummary["Portfolio Summary"]

    AssetState["dynamicAssetHistory"] --> Dashboard
    AssetState --> AssetTrend["Asset Trend"]
    AssetState --> Roadmap["Finance Roadmap"]

    PortfolioState["dynamicPortfolioData"] --> PortfolioTab["Portfolio Tab"]
    PortfolioState --> InvestDetail["Invest Detail / Quant"]
    PortfolioState --> RealEstate["Real Estate"]

    AddonState["cards / insurances"] --> Addons["Cash Flow Add-ons"]
    QuantState["quant rules + market prices"] --> InvestDetail
```

## Current Write Paths

```mermaid
flowchart TD
    TxManual["Manual transaction modal"] --> SubmitTx["submitTransaction()"]
    SubmitTx --> TxInsert["Supabase transactions.insert"]
    TxInsert --> MergeTx["mergeTransactionRowsIntoCache"]
    MergeTx --> RenderTx["renderSections(dashboard, portfolio)"]

    CsvFile["CSV/TSV file"] --> ImportParser["parseDelimitedImportText\nnormalizeImportHeader\nbuildTxImportPayload"]
    ImportParser --> ImportPreview["txImportCandidates preview"]
    ImportPreview --> ConfirmImport["confirmTxImport()"]
    ConfirmImport --> TxInsert
    ConfirmImport --> ImportAudit["local import audit summary"]

    PortfolioEdit["Portfolio edit modal"] --> SubmitPortfolio["submitPortfolio()"]
    SubmitPortfolio --> PortfolioWrites["Supabase portfolios\nupsert / insert / delete"]
    PortfolioWrites --> FetchPortfolio["fetchSheetData(['portfolios'])"]

    QuantRules["Quant rule editor"] --> SaveRules["saveQuantStrategyRules()"]
    SaveRules --> RulesUpsert["quant_strategy_rules.upsert"]

    QuantSignals["Quant signal button"] --> SaveSignals["saveQuantRebalanceSignals()"]
    SaveSignals --> SignalInsert["quant_rebalance_signals.insert"]

    PriceInput["Manual price input"] --> SavePrice["saveMarketPrice()"]
    SavePrice --> PriceUpsert["portfolio_market_prices.upsert"]
```

## Market Price Sync Flow

```mermaid
sequenceDiagram
    participant User
    participant Index as index.html
    participant Function as sync-market-prices
    participant Provider as Optional Provider
    participant DB as Supabase Tables

    User->>Index: Click 시세
    Index->>Function: supabase.functions.invoke()
    Function->>DB: Read portfolios.ticker when needed
    alt provider disabled or cached today
        Function->>DB: Use existing portfolio_market_prices
    else free provider configured
        Function->>Provider: Fetch quotes
        Provider-->>Function: Quote results
        Function->>DB: Upsert latest + history
    end
    Function-->>Index: sync result
    Index->>DB: fetchRemoteTables(['portfolio_market_prices'])
    Index->>Index: parseMarketPrices + renderInvestDetail
```

## Supabase Table Usage

| Table | Current use |
| --- | --- |
| `transactions` | Cash-flow rows, dashboard income/expense, manual transaction insert, CSV/TSV import insert |
| `assets` | Monthly asset trend and dashboard asset cards |
| `portfolios` | Portfolio accordion, asset classification, Quant metadata, real-estate funding status |
| `cards` | Cash-flow add-on card list |
| `insurances` | Cash-flow add-on insurance list |
| `quant_strategy_rules` | Strategy targets, bands, trigger labels |
| `portfolio_market_prices` | Latest manual/API market prices by ticker |
| `portfolio_price_history` | Written by Edge Function for historical price cache |
| `quant_rebalance_signals` | Written when saving Quant rebalance suggestions |

Drafted but not applied for realtime DB sync:

| Draft table | Intended future use |
| --- | --- |
| `account_sync_sources` | Provider/source metadata without raw account numbers |
| `account_sync_runs` | Server-side import/sync run audit trail |
| `transaction_import_candidates` | Server-side staging before confirmed transaction insert |

## Current Coupling Hotspots

```mermaid
flowchart TD
    Index["index.html"] --> UI["HTML templates"]
    Index --> State["Global state"]
    Index --> Data["Supabase data access"]
    Index --> Domain["Domain rules\nasset classification, payday period,\nQuant, real-estate funding"]
    Index --> Render["DOM renderers"]
    Index --> Charts["Chart.js orchestration"]
    Index --> Mutations["DB writes"]

    UI --> Risk["High change radius"]
    State --> Risk
    Data --> Risk
    Domain --> Risk
    Render --> Risk
    Charts --> Risk
    Mutations --> Risk
```

Key redesign pressure points:

- `index.html` mixes view markup, state, API access, domain calculations, mutation flows, chart setup, and event binding.
- Runtime state is mostly global mutable variables, so feature boundaries are implicit.
- Supabase row objects are converted into legacy two-dimensional arrays, then parsed back into feature-specific objects.
- Rendering functions depend on shared global state rather than explicit inputs.
- Mutation flows update remote DB, local cache, parsed state, and UI in the same function.
- Local cache and local import audit are useful but currently hidden behind direct `localStorage` calls.
- Edge Function is already a clean external boundary and can serve as a model for future server-side sync.

## Redesign Boundary Candidates

```mermaid
flowchart LR
    StaticApp["Static App Shell"] --> DataLayer["Data Layer\nSupabase client, cache, table adapters"]
    StaticApp --> StateStore["State Store\ncurrent month, parsed datasets, active view"]
    StaticApp --> DomainLayer["Domain Layer\nportfolio classification, Quant, real-estate,\ntransaction normalization"]
    StaticApp --> UILayer["UI Layer\nview renderers and event controllers"]
    StaticApp --> ChartLayer["Chart Layer\nChart.js lifecycle"]
    StaticApp --> SyncLayer["Sync Layer\nCSV import, audit, future provider sync"]

    SyncLayer --> EdgeFunctions["Supabase Edge Functions"]
    DataLayer --> Supabase["Supabase Tables"]
```

This boundary proposal is only a map for discussion. The next redesign decision should choose whether to keep a static vanilla app with separated JS modules or move to a framework-based app structure.
