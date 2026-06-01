# 🤖 AI Agent Integration & Architecture Guide

Welcome! If you are an AI assistant analyzing this repository, this guide will provide you with the essential context required to understand the system architecture, file roles, and database workflows of **NetVisualizer (Smart Household Ledger V2)**. 

Please read this document carefully before making changes to the codebase.

---

## 1. System Architecture Overview

This project is a Progressive Web App (PWA) built with HTML, TailwindCSS, and Vanilla JavaScript.
Originally, it used Google Apps Script (`code.gs`) as the primary backend API, reading/writing to Google Sheets. 

**However, the primary database has been successfully migrated to Supabase (PostgreSQL).**
- **Primary Source of Truth**: Supabase (`transactions`, `assets`, `portfolios` tables).
- **Frontend**: Directly interfaces with Supabase REST API via `@supabase/supabase-js`.
- **Google Sheets**: Now serves **exclusively as a weekly backup/archive**. `code.gs` runs a time-driven trigger to fetch data from Supabase and write it down to the sheets.

---

## 2. Directory & File Roles

### Frontend Files
- **`index.html`**: The monolithic core of the application (~2,000 lines). It contains:
  - **CSS**: Embedded Tailwind classes and custom CSS (Chart styles, Leaflet map overrrides).
  - **DOM & UI**: PWA layout, navigation tabs, dashboard widgets, and interactive charts (using `Chart.js`).
  - **State**: Global JavaScript variables (e.g., `dynamicAssetHistory`, `dynamicPortfolioData`) storing the fetched Supabase data.
  - **Business Logic**: Functions for fetching data (`fetchSheetData`), submitting forms (`submitTransaction`), parsing data, and rendering complex UI (like `renderInvestDetail`).
  > **Note for Agents**: Be extremely careful when modifying global state logic or `innerHTML` assignments in `index.html`. Modifying the object structures in `fetchSheetData` may inadvertently break downstream rendering functions.

- **`sw.js` & `manifest.json`**: Standard PWA configuration and service worker for offline caching.

### Backend / Utility Files
- **`code.gs`**: The Google Apps Script file attached to the Google Spreadsheet. 
  - **Function**: `doBackup()` fetches data from Supabase using `UrlFetchApp` and overwrites the Google Sheets tabs (`수입지출 내역`, `자산추이내역`, `포트폴리오`) for archiving purposes.
  - **DO NOT** use `code.gs` for real-time frontend API calls.

- **`scripts/migrate_to_supabase.js`**: A Node.js utility script that was used for the initial data migration. It can be ignored for future feature development.

---

## 3. Database Schema (Supabase)

The Supabase PostgreSQL database holds three primary tables.

### 1. `transactions` (Income & Expenses)
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid/int8 | Primary Key |
| `date` | date | "YYYY-MM-DD" |
| `time` | time | "HH:MM" (Can be null) |
| `type` | text | "수입" (Income), "지출" (Expense), "이체" (Transfer) |
| `category` | text | Main category (e.g., 식비, 주거비) |
| `subcategory` | text | Sub-category |
| `memo` | text | User description |
| `amount` | numeric | Transaction value |
| `currency` | text | Usually "KRW" |
| `method` | text | Payment method (e.g., 신용카드, 현금) |

### 2. `assets` (Historical Net Worth)
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid/int8 | Primary Key |
| `year` | int4 | Year (e.g., 2026) |
| `month` | int4 | Month (1-12) |
| `total_asset` | numeric| Total Net Worth |
| `cash` | numeric | Cash & Equivalents |
| `safe` | numeric | Safe Assets (Bonds, Deposits) |
| `invest` | numeric | Risk Assets (Stocks, Real Estate) |
| `debt` | numeric | Liabilities / Debt |

### 3. `portfolios` (Current Investments & Accounts)
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid/int8 | Primary Key |
| `group_name` | text | E.g., "현금성 자산", "투자 자산", "부채" |
| `name` | text | Specific asset name (e.g., "삼성전자", "신한은행 적금") |
| `currency` | text | "KRW", "USD", etc. |
| `maturity` | text | Expiration or Maturity date (String) |
| `amount` | numeric | Current Valuated Amount |
| `shares` | numeric | Number of shares (Nullable) |

---

## 4. Key Workflows

### A. Initial Data Load
When the user opens the PWA:
1. `index.html` loads and `fetchSheetData()` is called.
2. It uses `Promise.all()` to query the three tables from Supabase simultaneously.
3. The JSON responses are parsed and stored into global variables (`dynamicPortfolioData`, etc.).
4. Rendering functions (`renderDashboard`, `renderPortfolio`, `renderInvestDetail`) are sequentially triggered.

### B. Submitting a New Transaction
1. User fills out the floating modal and hits Submit.
2. `submitTransaction()` constructs a JSON payload.
3. It calls `supabase.from('transactions').insert(...)`.
4. On success, it fetches the fresh data again via `fetchSheetData(false)` and updates the UI.

---

## 5. Development Best Practices
1. **Error Handling**: Since the app relies on Supabase, always wrap API calls in `try...catch`. Fallbacks to `localStorage` (Offline mode) are implemented in `fetchSheetData()` and should be respected.
2. **Modifying UI**: `index.html` relies heavily on template literals string interpolation (`innerHTML = \`<div...>\``). When adding new UI elements, ensure Tailwind classes are correctly scoped.
3. **Mock Data**: Avoid injecting mock business logic (like random Yield Percentages) into the frontend state, as it makes scaling complex. Keep calculation logic clean and data-driven.
