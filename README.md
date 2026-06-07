# NetVisualizer

## 2026-06-07 Applyhome Real Estate Sync Adapter

`codex/realestate-mcp-adapter` branch adds a local sync adapter for the approved `한국부동산원_청약홈 분양정보 조회 서비스`.

The first MCP candidate used a generated file-data endpoint that does not match the approved public-data account. The current default collector calls:

`https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail`

- The external MCP checkout lives under ignored `tools/external/real-estate-mcp`.
- Codex MCP server `real-estate` is registered locally through the external repo's `.venv` Python.
- `scripts/install-realestate-mcp.ps1` installs and registers the MCP candidate without storing API keys in Codex config.
- `scripts/set-realestate-mcp-secrets.ps1` writes data.go.kr / ODcloud keys only into the ignored external `.env`.
- `tools/sync_realestate_from_mcp.py` maps approved Applyhome subscription rows into `real_estate_subscription_sites`.
- `scripts/sync-realestate-from-mcp.ps1` supports fixture dry-run, live dry-run, and explicit Supabase apply mode.
- Design notes: `docs/02-design/realestate-mcp-adapter.md`.

## 2026-06-07 Real Estate Data Sync Scaffold

`codex/realestate-data-sync` branch starts moving the Real Estate / Subscription tab from hardcoded schedule data toward Supabase-backed public-data sync.

- Real Estate schedule cards and map markers now prefer `real_estate_subscription_sites` when the table exists.
- The app keeps a local fallback for 고양창릉 S2/S3/S4, so the screen still works before migration/API setup.
- `supabase/migrations/20260607022840_create_realestate_data_sync.sql` adds subscription-site, housing-type, competition, and apartment price-reference tables.
- The migration seeds 고양창릉 S2/S3/S4 with supply count, type, priority, approximate location, and target budget.
- `supabase/functions/sync-realestate-subscriptions` is a free-only Edge Function scaffold for Applyhome/data.go.kr sync.
- The sync provider is `disabled` by default, so no external real-estate API call occurs until a free public-data key is configured.
- Design notes: `docs/02-design/realestate-data-sync-plan.md`.

## 2026-06-05 Realtime DB Sync Update

`codex/realtime-db-sync` branch now includes the first practical import path for reducing manual Supabase edits.

- Current architecture map before redesign: `docs/02-design/current-architecture-map.md`.
- Cash-flow tab has a `가져오기` action for CSV/TSV transaction files.
- The import modal previews rows before saving and shows ready, duplicate, and invalid counts.
- Common bank/card columns are normalized: date, time, type, category, memo, amount, withdrawal, deposit, payment amount, currency, and method.
- Duplicate detection runs against already loaded transactions and within the selected file.
- Only ready rows are inserted into the existing Supabase `transactions` table; no remote schema migration has been applied yet.
- Recent import run summaries are stored locally, without raw transaction rows.
- Official banking API sync remains deferred until Auth/RLS and secret handling are designed.

## 2026-06-06 Architecture Redesign Slice

`codex/asset-trend-redesign` branch starts the redesign from the long-term asset trend screen.

- Navigation now has two levels: Goal first, then Finance tools.
- Finance, Career, Project, and Health are selectable Goal cockpits. Career/Project/Health currently provide draft KPI structures and next-action areas before data tables are added.
- Finance opens a Goal cockpit with asset goal progress, housing funding readiness, year-to-date surplus, and year-to-date surplus rate.
- The Finance cockpit and Finance tool screens follow a consistent visual structure: time-scope badges, decision cards, one primary visual, and detail/action cards.
- Finance tools are grouped as Portfolio, Cash Flow, Long-Term Asset, and Real Estate.
- Month navigation is scoped to Cash Flow; the Finance cockpit, Portfolio, Long-Term Asset, and Real Estate default back to the latest available month/state.
- Cash Flow now focuses on selected-month totals plus the full monthly income/expense/surplus trend; fixed-saving bars, AI cash-flow comments, and category doughnut cards were removed.
- Asset trend model logic now lives in `js/features/assetTrend.js`.
- `index.html` keeps DOM and Chart.js rendering for now, but calls `AssetTrendFeature.createModel()` for metrics and chart series.
- The long-term asset screen is now arranged as a Finance goal workspace: chart on the left, goal/growth KPIs on the right, roadmap below.
- Slice design notes: `docs/02-design/asset-trend-redesign-slice.md`.

개인 가계부, 자산 포트폴리오, 카드/보험, 부동산 청약 준비 상태를 한 화면에서 확인하는 HTML 기반 PWA입니다. 현재 저장소 기준으로는 별도 프론트엔드 빌드 도구 없이 `index.html` 하나가 화면, 상태, Supabase 연동, 차트 렌더링, 입력 폼 처리를 모두 담당합니다.

이 문서는 2026-06-03 기준 `C:\Users\ksg06\Documents\NetVisualizer` 코드 조사 결과를 바탕으로 현재 프로세스, 확인된 문제점, Load 저감 방향, 테스트 관점을 정리한 것입니다.

## 현재 구조

| 파일 | 역할 |
| --- | --- |
| `index.html` | 핵심 SPA 파일입니다. Tailwind CDN, Supabase JS, FontAwesome, Chart.js, Leaflet을 불러오고 모든 화면/상태/API/렌더링 로직을 포함합니다. |
| `manifest.json` | PWA 이름, 테마 색상, 시작 URL, 아이콘을 정의합니다. UTF-8로 읽어야 한글 설명이 정상입니다. |
| `sw.js` | 서비스 워커입니다. 앱 셸 일부를 캐싱하고 네트워크 실패 시 캐시 fallback을 시도합니다. |
| `AI_AGENT_GUIDE.md` | AI 작업자를 위한 기존 아키텍처 설명 문서입니다. 일부 파일 설명은 현재 저장소와 다를 수 있습니다. |
| `docs/03-analysis/fintech-expansion-feasibility.md` | 계좌 자동 동기화, Quant 기능, 자산유형 자동분류의 실행가능성 검토 문서입니다. |
| `supabase_transactions_template.csv` | 거래 데이터 템플릿입니다. |
| `img/cards/s_choice.png` | 카드 이미지 정적 자산입니다. |

현재 저장소에는 `code.gs`, `scripts/migrate_to_supabase.js`가 포함되어 있지 않습니다. Google Sheets 백업 또는 마이그레이션 스크립트는 외부에 있거나 과거 구조 설명으로 보입니다.

## 기술 스택

- Frontend: HTML, Vanilla JavaScript, Tailwind CSS CDN
- Data/API: Supabase JS SDK v2, Supabase PostgreSQL
- Visualization: Chart.js, Leaflet/OpenStreetMap
- PWA: Web App Manifest, Service Worker, Cache API
- Local fallback: `localStorage`

## 주요 프로세스

### 1. 앱 초기화

1. 브라우저가 `index.html`을 로드합니다.
2. CDN에서 Tailwind, Supabase JS, FontAwesome, Chart.js, Leaflet, Pretendard 폰트를 가져옵니다.
3. `window.load`에서 `sw.js`를 서비스 워커로 등록합니다.
4. `DOMContentLoaded`에서 `loadSettings()` 후 `fetchSheetData(true)`를 실행합니다.

### 2. 초기 데이터 로딩

`fetchSheetData(true)`는 먼저 `localStorage`의 `smartbook_v2_data_cache`를 읽어 화면을 즉시 그립니다. 이후 Supabase에서 최신 데이터를 다시 가져와 전역 상태를 갱신하고 화면을 다시 렌더링합니다.

Supabase에서 병렬 조회하는 테이블은 다음과 같습니다.

- `transactions`
- `assets`
- `portfolios`
- `cards`
- `insurances`

조회 결과는 바로 화면에서 쓰지 않고, 기존 Google Sheets 형태와 비슷한 2차원 배열로 변환된 뒤 파서에 전달됩니다.

### 3. 상태 파싱

- `parseTxData()`는 거래 데이터를 월급일 기준 월 단위로 묶어 `monthlyDB`를 만듭니다.
- `parseAssetData()`는 월별 자산 추이를 `dynamicAssetHistory`, `dynamicAssetSnapshots`에 저장합니다.
- `parsePortfolioData()`는 포트폴리오를 그룹별 구조인 `dynamicPortfolioData`로 변환합니다.
- 카드/보험 데이터는 `addonCards`, `addonInsurances`에 저장됩니다.

### 4. 화면 렌더링

- `renderFinanceSummary()`는 Finance KPI와 자산 성장 차트를 렌더링하고, `renderCashFlow()`는 선택 월 요약과 전체 월 흐름 차트를 렌더링합니다.
- `renderPortfolio()`는 현재 월 포트폴리오 요약, 아코디언 목록, 포트폴리오 차트를 렌더링합니다.
- `renderInvestDetail()`은 투자 자산 상세 분석, 전략 분류, 투자 비중 차트를 렌더링합니다.
- `renderRealEstate()`는 Leaflet 지도와 청약 준비 자금 진행률을 렌더링합니다.
- `renderAddons()`는 카드/보험 목록과 진행률을 렌더링합니다.

화면 전환 시 `switchView()`가 활성 화면을 바꾸고, 대상 화면에 필요한 렌더링만 호출합니다. 예를 들어 부동산 탭은 지도/청약 준비 상태만 갱신하고, 일반 탭 전환만으로 대시보드와 포트폴리오 차트를 모두 다시 만들지 않습니다.

### 5. 거래 입력

1. 사용자가 플로팅 버튼으로 거래 입력 모달을 엽니다.
2. `submitTransaction()`이 입력값을 읽고 지출이면 금액을 음수로 변환합니다.
3. Supabase `transactions` 테이블에 `insert`합니다.
4. 저장 성공 후 insert 응답 row를 로컬 캐시에 병합하고 현재 월 화면만 다시 계산합니다.
5. insert 응답이 비어 있으면 fallback으로 `transactions` 테이블만 다시 조회합니다.

### 6. 포트폴리오 편집

1. `openPortfolioEditModal()`이 현재 포트폴리오 원본 배열을 복사해 편집 상태를 만듭니다.
2. 사용자가 항목 추가/삭제/금액 변경, 자산유형, ticker, 전략 태그, 평균단가를 수정합니다.
3. `submitPortfolio()`가 기존 row는 `id` 기준 upsert, 새 row는 insert, 삭제된 row만 delete하고, 자산분류/Quant 메타데이터를 함께 저장합니다.
4. 저장 성공 후 `portfolios` 테이블만 다시 조회해 포트폴리오 화면과 관련 차트를 갱신합니다.

## 확인된 문제점과 리스크

| 구분 | 내용 | 영향 |
| --- | --- | --- |
| 단일 대형 파일 | `index.html`이 약 3,100라인, 200KB이며 UI, 상태, API, 렌더링이 한 파일에 결합되어 있습니다. | 수정 영향 범위 추적이 어렵고 회귀 버그 가능성이 큽니다. |
| 전체 재조회 패턴 | 거래 저장, 포트폴리오 저장, 수동 동기화 후 항상 여러 테이블을 전체 조회합니다. | 데이터가 늘수록 네트워크/DB/렌더링 부하가 선형 증가합니다. |
| 포트폴리오 전체 삭제 후 재삽입 | `portfolios` 저장 시 전체 delete 후 insert를 수행합니다. | 중간 실패 시 데이터 유실 또는 빈 포트폴리오 상태가 생길 수 있습니다. |
| Supabase 키 하드코딩 | Supabase URL과 anon key가 `index.html`에 직접 포함되어 있습니다. | 공개 배포 시 RLS 정책이 약하면 데이터 노출/변조 위험이 있습니다. |
| Supabase RLS 비활성화 | `transactions`, `portfolios`, `assets`, `cards`, `insurances`의 RLS가 꺼져 있습니다. | anon key를 가진 사용자가 테이블 전체를 읽거나 수정할 수 있으므로 배포 전 정책 설계가 필요합니다. |
| 외부 CDN 의존 | Tailwind, Supabase JS, FontAwesome, Chart.js, Leaflet, 폰트가 모두 외부 CDN입니다. | 네트워크 불안정 시 초기 로딩 실패 가능성이 높고 PWA 오프라인성이 제한됩니다. |
| 서비스 워커 캐시 범위 제한 | `sw.js`는 `./`, `index.html`, `manifest.json`만 설치 시 캐싱합니다. CDN 자산과 로컬 이미지 대부분은 사전 캐시하지 않습니다. | 오프라인 또는 느린 네트워크에서 UI가 완전히 살아나기 어렵습니다. |
| Supabase GET 캐시 예외 없음 | 서비스 워커는 `script.google.com`과 POST만 제외합니다. Supabase GET은 fetch handler를 통과하지만 별도 캐싱/저장 정책은 없습니다. | API 요청 의도가 코드에 명확히 드러나지 않고 장애 분석이 어렵습니다. |
| 잦은 차트 destroy/recreate | 주요 렌더링마다 Chart.js 인스턴스를 destroy 후 새로 생성합니다. | 화면 전환/월 이동 시 CPU와 메모리 사용량이 커질 수 있습니다. |
| 화면 전환 시 과다 렌더링 | `switchView()`가 대상 화면과 무관하게 대시보드와 포트폴리오를 모두 다시 그립니다. | 부동산/자산/현금 흐름 탭 전환에도 불필요한 렌더링이 발생합니다. |
| `innerHTML` 사용 범위 큼 | Supabase 데이터에서 온 문자열이 여러 곳에서 템플릿 리터럴로 직접 들어갑니다. | 데이터에 특수문자/HTML이 섞이면 XSS 또는 UI 깨짐 가능성이 있습니다. |
| 하드코딩된 기준값 | 목표자산 2.5억/30억, 예상 대출 3억, 청약 목표 8억, 이자율 등이 코드에 고정되어 있습니다. | 사용자 조건 변경 시 코드 수정이 필요하고 계산 설명이 불투명해집니다. |
| 현재 README와 실제 파일 차이 | 과거 README는 `code.gs`를 저장소 파일처럼 설명하지만 현재 repo에는 없습니다. | 신규 작업자가 구조를 오해할 수 있습니다. |

## 적용된 개선사항

현재 코드에는 프레임워크 전면 전환 없이 다음 개선이 적용되어 있습니다.

| 개선 | 적용 내용 |
| --- | --- |
| 부분 동기화 | `fetchSheetData()`가 테이블 목록을 인자로 받아 `transactions`, `portfolios` 등 필요한 테이블만 다시 가져올 수 있게 변경했습니다. |
| 거래 저장 부하 저감 | 거래 입력 후 전체 테이블 재조회 대신 Supabase insert 결과를 로컬 캐시에 병합하고, 응답이 없을 때만 `transactions` 테이블만 재조회합니다. |
| 포트폴리오 저장 안정화 | 전체 delete 후 insert 방식에서 기존 row는 `id` 기준 upsert, 새 row는 insert, 삭제된 row만 delete하는 방식으로 변경했습니다. |
| 자산분류 DB 저장 | `portfolios`에 `asset_type`, `instrument_type`, `ticker`, `risk_bucket`, `classification_source`, `classification_updated_at`를 추가하고 화면 정렬/배지/계산 보조값으로 사용합니다. 포트폴리오 탭의 별도 자동분류 요약 카드는 제거했습니다. |
| Quant 1차 메타데이터 | `portfolios`에 `strategy_tag`, `avg_buy_price`를 추가하고 편집 모달, 투자 상세 전략 차트, Quant 전략 구조표에서 사용합니다. |
| 종목 ticker 백필 | 현재 보유 주식/ETF 23개 row에 ticker를 채우고, 증권계좌 현금 row는 Quant 현금대기 자산으로 재분류했습니다. 상세 매핑은 `docs/03-analysis/portfolio-ticker-backfill-2026-06-04.md`에 남겼습니다. |
| Quant 전략 설정 DB화 | `quant_strategy_rules` 테이블에 전략별 목표비중, 허용밴드, 신호 기준을 저장하고 투자 상세 화면에서 직접 수정/저장할 수 있게 했습니다. |
| 수동 현재가 입력 구조 | `portfolio_market_prices` 테이블에 ticker별 최신 현재가를 저장하고, 투자 상세 화면에서 평균단가/수량 기반 미실현 손익률을 계산합니다. |
| Quant 수익률/리밸런싱 | 투자 상세 화면에 전략별 수익률 요약을 추가하고, Quant 전략 구조표에서 목표비중 대비 매수/축소 필요액을 계산합니다. |
| Quant 신호 스냅샷 | 투자 상세 화면의 `신호` 버튼으로 전략별 현재/목표/리밸런싱 필요액과 데이터 준비도를 `quant_rebalance_signals` 테이블에 저장합니다. |
| 현재가 이력 저장 | `portfolio_price_history` 테이블에 날짜별 가격 이력을 저장합니다. 수동 현재가 저장 시 최신값과 이력값을 함께 갱신합니다. |
| 무료 전용 시세 캐시 | `supabase/functions/sync-market-prices` Edge Function의 기본 provider를 `disabled`로 두고, 무료 테스트 provider만 선택적으로 허용합니다. 한국 유료 가능 거래소 symbol은 항상 차단합니다. |
| 월 목록 캐싱 | `Object.keys(monthlyDB).sort()` 반복 호출을 줄이기 위해 정렬된 월 목록을 `sortedMonthKeys`로 유지합니다. |
| 탭 전환 렌더링 저감 | 탭 전환 시 대시보드와 포트폴리오를 무조건 다시 그리지 않고, 대상 화면에 필요한 렌더링만 수행합니다. |
| 차트 재사용 | Chart.js 차트는 가능한 경우 destroy/recreate 대신 데이터와 옵션을 교체한 뒤 `update('none')`으로 갱신합니다. |
| 서비스 워커 명확화 | Supabase API 요청은 network-only로 분리하고, 앱 셸 캐시에 `sw.js`와 로컬 카드 이미지를 추가했습니다. |
| 문자열 escape | Supabase 데이터가 `innerHTML`에 들어가는 주요 위치에 escape 처리를 추가해 UI 깨짐과 XSS 위험을 줄였습니다. |

남은 구조 개선 후보는 모듈 분리입니다. 현재는 리스크를 낮추기 위해 대규모 파일 분리는 보류하고, 같은 SPA 안에서 부하와 안정성 개선을 먼저 적용했습니다.

## Load 저감 방향

### 우선순위 1: 데이터 조회량 줄이기

- 거래 목록은 전체 `select('*')` 대신 현재 월 또는 최근 N개월 기준으로 범위를 제한합니다.
- `assets`, `portfolios`, `cards`, `insurances`는 변경 빈도가 낮으므로 거래 저장 뒤에는 필요한 테이블만 갱신합니다.
- 거래 저장 성공 시 전체 재조회 대신 방금 insert한 row를 로컬 상태에 반영하고 해당 월 화면만 다시 계산합니다.
- Supabase query에 필요한 컬럼만 명시합니다. 예: `select('date,time,type,category,subcategory,memo,amount,currency,method')`

### 우선순위 2: 렌더링 부하 줄이기

- `switchView()`에서 모든 화면을 다시 그리지 말고 대상 화면만 렌더링합니다.
- 월 이동 시 `Object.keys(monthlyDB).sort()`를 매번 호출하지 말고 정렬된 month key 배열을 상태로 캐싱합니다.
- Chart.js는 destroy/recreate 대신 데이터셋 교체 후 `chart.update()`를 우선 검토합니다.
- 거래 테이블은 데이터가 많아질 경우 월별 페이지네이션 또는 가상 스크롤을 도입합니다.

### 우선순위 3: PWA/정적 자산 최적화

- `sw.js`의 사전 캐시에 `sw.js`, 로컬 이미지, 필요 시 주요 CDN 파일의 self-hosted 사본을 포함합니다.
- Supabase API 요청은 서비스 워커에서 명시적으로 network-only 처리해 의도를 분리합니다.
- Tailwind CDN은 개발용에 가깝기 때문에, 배포 안정성을 원하면 빌드된 CSS 파일로 고정하는 편이 좋습니다.
- 외부 폰트/CDN 장애에 대비해 fallback UI를 점검합니다.

### 우선순위 4: 데이터 안정성 개선

- 포트폴리오 저장은 전체 삭제/재삽입 대신 upsert 또는 서버 측 RPC/transaction으로 원자성을 확보합니다.
- RLS 정책을 확인해 anon key로 허용되는 `select`, `insert`, `delete` 범위를 최소화합니다.
- 사용자가 입력한 `memo`, `name`, `description` 등은 화면 삽입 전 escape 처리하거나 DOM API로 텍스트 노드를 생성합니다.

## 테스트 체크리스트

### 정적 검증

```powershell
Get-Content -Encoding UTF8 manifest.json | ConvertFrom-Json
git status --short --branch
```

### 로컬 실행

정적 HTML 앱이므로 로컬 서버로 확인하는 것이 가장 안전합니다.

```bash
npx http-server -p 8080
```

브라우저에서 `http://localhost:8080`으로 접속합니다.

### 기능 테스트

- 초기 진입 시 캐시 데이터가 먼저 보이고 이후 최신 동기화 시간이 갱신되는지 확인합니다.
- 네트워크 차단 상태에서 앱 셸과 캐시 데이터 fallback이 동작하는지 확인합니다.
- 거래 입력 후 해당 월 수입/지출 합계, 차트, 거래 목록이 갱신되는지 확인합니다.
- 포트폴리오 편집 중 저장 실패를 강제로 발생시켜 기존 데이터가 보존되는지 확인합니다.
- 포트폴리오 편집에서 ticker, 전략 태그, 평균단가를 수정한 뒤 저장/재동기화 후 값이 유지되는지 확인합니다.
- 투자 상세 보기에서 전략 태그별 아코디언과 전략 비중 차트가 같은 기준으로 갱신되는지 확인합니다.
- 투자 상세 보기에서 전략별 수익률 카드가 현재가/평균단가가 있는 종목만 계산하고, 통화별 손익을 분리해서 표시하는지 확인합니다.
- 투자 상세 보기에서 `신호` 버튼을 눌렀을 때 `quant_rebalance_signals`에 전략별 리밸런싱 스냅샷이 저장되는지 확인합니다.
- 현재가 저장 후 `portfolio_market_prices` 최신값과 `portfolio_price_history` 날짜별 이력이 함께 저장되는지 확인합니다.
- 월 이동 버튼, 키보드 좌우 이동, 모바일 하단 탭 전환이 불필요한 지연 없이 동작하는지 확인합니다.
- 투자 상세 보기와 부동산 지도 탭을 반복 전환하면서 Chart/Leaflet 오류가 없는지 확인합니다.

## 다음 개선 작업 후보

1. `index.html`을 데이터 API, 상태 파서, 렌더러, 화면 이벤트 모듈로 분리합니다.
2. `fetchSheetData()`를 전체 동기화 함수와 부분 갱신 함수로 나눕니다.
3. 포트폴리오 저장을 delete/insert 방식에서 upsert/RPC 방식으로 바꿉니다.
4. Supabase 응답 데이터를 2차원 배열로 재가공하지 않고 객체 기반으로 직접 파싱합니다.
5. 서비스 워커 캐시 정책을 앱 셸, 정적 자산, API 요청으로 분리합니다.
6. 사용자 입력 문자열을 escape 처리해 `innerHTML` 삽입 리스크를 줄입니다.
7. 목표 금액, 대출 가정, 이자율 등을 설정값으로 분리합니다.

## 대규모 기능 검토

사용자 목표인 "상용 핀테크 앱이 제공하지 않는 개인 맞춤 기능 구현"을 기준으로 다음 3개 확장 기능의 실행가능성을 검토했습니다.

- 실시간 DB 업데이트: 계좌/카드 자동 모니터링은 별도 백엔드와 금융 API 인증 설계가 필요하므로 가장 마지막에 추진합니다.
- Quant 기능: ticker, 매입가, 수량, 통화, 전략 태그가 필요하므로 구조를 먼저 만들고 데이터 품질은 후속 보강합니다.
- 자산유형 자동분류: 포트폴리오 계산을 돕는 내부 메타데이터로 유지하되, 화면의 핵심 기능으로 앞세우지는 않습니다.

`codex/realtime-db-sync` 브랜치에서 실시간 DB 업데이트 작업을 시작했습니다. 첫 범위는 완전 자동 계좌 연동이 아니라 CSV/엑셀 import staging, 중복 방지, sync run 기록입니다. 관련 문서는 `docs/03-analysis/realtime-db-sync-feasibility.md`, SQL 초안은 `docs/03-analysis/realtime-db-sync-schema.sql`, 진행 현황은 `docs/04-report/realtime-db-sync-progress.md`에 있습니다.

현재 main에 반영된 Quant 구조는 다음과 같습니다. Supabase `portfolios` 테이블에는 `asset_type`, `instrument_type`, `ticker`, `risk_bucket`, `classification_source`, `classification_updated_at`, `strategy_tag`, `avg_buy_price` 컬럼이 추가되어 있습니다. `quant_strategy_rules` 테이블에는 전략별 목표비중과 리밸런싱 밴드를 저장하고, `portfolio_market_prices` 테이블에는 ticker별 최신 현재가를 저장합니다. `portfolio_price_history` 테이블에는 날짜별 가격 이력을 저장합니다. `quant_rebalance_signals` 테이블에는 전략별 현재비중, 목표비중, 리밸런싱 필요액, 데이터 준비도 스냅샷을 저장합니다. 기존 40개 row는 자산분류와 전략 태그 기준으로 backfill했고, 보유 주식/ETF 23개 row는 ticker를 채웠습니다. 화면 정렬은 현금, 안전, 투자, 연금, 부채, 기타 순서입니다.

상세 내용은 `docs/03-analysis/fintech-expansion-feasibility.md`에 정리했습니다. Supabase 컬럼 승격 SQL 초안은 `docs/03-analysis/asset-classification-supabase-migration.sql`, `docs/03-analysis/portfolio-quant-metadata-migration.sql`, `docs/03-analysis/quant-strategy-rules-migration.sql`, `docs/03-analysis/portfolio-market-prices-migration.sql`, `docs/03-analysis/portfolio-price-history-migration.sql`, `docs/03-analysis/quant-rebalance-signals-migration.sql`에 있습니다.

## 시세 API 설정

시세 연동은 무료 전용으로 고정합니다. 기본값은 외부 시세 API를 호출하지 않는 `disabled`입니다.

1. 기본 상태에서는 수동 현재가 입력과 DB 캐시만 사용합니다.
2. `supabase/functions/.env.example`을 참고해 `supabase/functions/.env`를 만듭니다.
3. 한국 국내 단축코드 ticker 자동 조회가 필요하면 `MARKET_PRICE_PROVIDER=kis`, `KIS_APP_KEY`, `KIS_APP_SECRET`을 설정합니다.
4. 무료 범위의 미국/글로벌 ticker 테스트가 필요할 때만 `MARKET_PRICE_PROVIDER=twelvedata`와 무료 API key를 설정합니다.
5. 유료 플랜 호출을 켜는 override는 없습니다.
6. 로컬에서는 `supabase functions serve sync-market-prices --env-file supabase/functions/.env`로 테스트합니다.

현재는 자동 스케줄 배포까지는 하지 않았습니다. 무료 고정을 위해 시세 버튼은 사용자가 누를 때만 동작하고, 같은 날짜의 API 시세가 이미 있으면 외부 API를 다시 호출하지 않고 DB 캐시를 사용합니다.

KIS provider는 국내주식 현재가 조회만 사용합니다. 계좌잔고, 주문, 체결, 매매 API는 호출하지 않습니다.

`sync-market-prices` Edge Function은 Supabase 프로젝트에 배포되어 있으며, 원격 secret `MARKET_PRICE_PROVIDER=disabled`가 설정되어 있습니다. 인증 없는 호출은 401로 차단되는 것을 확인했습니다.

KIS dry run은 다음 스크립트로 확인합니다.

```powershell
.\scripts\set-kis-secrets.ps1
.\scripts\kis-dry-run.ps1 -Tickers 005930
```

원격 함수 배포는 완료되어 있습니다. 현재 남은 차단점은 `supabase/functions/.env`에 실제 KIS 앱키/시크릿이 없다는 점입니다.

투자 상세 화면의 `시세` 버튼은 배포된 `sync-market-prices` Edge Function을 호출합니다. 함수가 배포되지 않았거나 API key가 없으면 DB를 바꾸지 않고 보류 메시지만 표시합니다. 성공 시 `portfolio_market_prices`만 다시 가져와 현재 화면의 수익률을 갱신합니다.
