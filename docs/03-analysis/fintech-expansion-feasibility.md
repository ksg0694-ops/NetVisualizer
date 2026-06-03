# 핀테크 확장 기능 실행가능성 검토

작성일: 2026-06-03

## 목표

토스/뱅크샐러드 같은 상용 핀테크 앱이 제공하지 않거나, 개인 전략에 맞게 충분히 커스터마이즈하기 어려운 기능을 NetVisualizer 안에서 직접 구현한다.

핵심 방향은 다음과 같다.

- 계좌/카드/투자 데이터를 자동 또는 반자동으로 가져온다.
- 보유 자산을 계좌, 현금성 자산, 주식, ETF, 부채 등으로 분류한다.
- 투자 자산을 전략 단위로 묶어 성과와 리스크를 추적한다.
- 개인정보와 금융 인증정보를 브라우저에 노출하지 않는다.

## 브랜치 운영 원칙

대규모 기능은 각각 별도 브랜치에서 개발하고, 검증 후 main에 병합한다.

| 기능 | 권장 브랜치 | 병합 조건 |
| --- | --- | --- |
| 자산유형 자동분류 | `codex/asset-classification` | 기존 포트폴리오 데이터 손상 없이 분류 컬럼 추가, 수동 override 가능 |
| Quant 기능 | `codex/quant-engine` | 수익률/매입가/현재가 계산 검증, 외부 시세 API 장애 fallback |
| 실시간 DB 업데이트 | `codex/account-sync` | 인증정보 서버 보관, 수동 동의 흐름, 읽기 전용 동기화부터 검증 |

## 1. 실시간 DB 업데이트

### 실행가능성

중간 난이도 이상이다. 단순 프론트엔드 SPA만으로는 안정적으로 구현하기 어렵고, 별도 백엔드 또는 서버리스 작업자가 필요하다.

계좌 자동 모니터링은 기술보다 인증, 개인정보, API 접근권한이 핵심 리스크다. 은행/카드사 계좌 데이터를 자동으로 읽으려면 보통 오픈뱅킹, 마이데이터, 금융기관 공식 API, 또는 사용자가 내려받은 CSV/엑셀 내역을 처리하는 방식 중 하나가 필요하다.

### 권장 구현 순서

1. CSV/엑셀 가져오기부터 만든다.
2. 가져온 거래내역을 기존 `transactions` 테이블에 매핑하는 import preview 화면을 만든다.
3. 중복 거래 감지 키를 만든다. 예: `date + amount + memo + method`.
4. 서버 측 동기화 작업자를 추가한다. 예: Supabase Edge Functions, 별도 Node/Python worker.
5. 공식 API 연동은 읽기 전용부터 시작한다.

### 피해야 할 접근

- 브라우저 localStorage에 은행 인증정보, 토큰, 공동인증서, API secret을 저장하는 방식
- 금융 앱 화면을 크롤링하거나 자동 로그인하는 방식
- 실패 시 DB를 전체 삭제 후 재삽입하는 방식

### 테스트 관점

- 같은 거래가 두 번 import되지 않는지
- 계좌명/카드명/메모가 누락되어도 안전하게 저장되는지
- 동기화 실패 시 기존 데이터가 유지되는지
- API 토큰 만료 시 사용자가 다시 연결할 수 있는지

## 2. Quant 기능

### 실행가능성

중간 난이도다. 현재 포트폴리오 데이터에는 종목명, 평가금액, 보유수량 일부가 있지만 매입단가, 매수일, 실현손익, 배당, 환율, 수수료가 부족하다. 따라서 바로 고급 전략 분석으로 가기보다 데이터 모델을 먼저 확장해야 한다.

### 필요한 데이터

| 데이터 | 필요 이유 |
| --- | --- |
| ticker | 외부 시세와 연결하기 위한 기본 키 |
| asset_type | 주식/ETF/현금/계좌/부채 구분 |
| quantity | 현재 평가금액만으로는 수익률 계산 불가 |
| avg_buy_price | 매입 대비 수익률 계산 |
| currency | 원화/달러 자산 분리 |
| strategy | 배당, 지수추종, 성장주, 현금대기 등 전략 그룹 |
| price_history | MDD, 변동성, 리밸런싱 신호 계산 |

### 권장 구현 순서

1. 투자 상세 화면에 전략 구조를 먼저 만든다. 예: 목표비중, 리밸런싱 밴드, 신호 기준.
2. 전략 구조가 사용할 최소 메타데이터를 저장한다. 예: ticker, 전략 태그, 평균단가.
3. 종목별 현재가 수동 입력 또는 CSV import를 먼저 지원한다.
4. 외부 시세 API는 서버 측에서 호출하고 캐시한다.
5. 전략별 성과 지표를 추가한다. 예: 수익률, 비중, 변동성, MDD, 배당률.
6. 자동 매수/매도는 하지 않고, 신호 생성과 메모 저장부터 시작한다.

### 테스트 관점

- 원화/달러 자산이 섞여도 총액과 수익률이 맞는지
- ticker가 없는 항목은 계좌/현금성 자산으로 안전하게 제외되는지
- 시세 API 장애 시 마지막 캐시 가격으로 화면이 유지되는지
- 전략 태그 수정 후 차트와 리스트가 함께 갱신되는지

### 1차 적용 결과

2026-06-03에 `codex/asset-classification` 브랜치에서 Quant 기능의 데이터 기반을 먼저 추가했다.

- Supabase `portfolios`에 `strategy_tag`, `avg_buy_price` 컬럼을 추가했다.
- `strategy_tag` 허용값은 `dividend`, `index`, `growth`, `cash`, `pension`, `other`이다.
- 기존 40개 row의 `strategy_tag`는 자산유형과 종목명 규칙으로 backfill했다.
- 포트폴리오 편집 모달에서 ticker, 전략 태그, 평균단가를 직접 입력/수정할 수 있다.
- 투자 상세 화면은 이름 추론만 사용하지 않고 DB의 `strategy_tag`를 우선 사용해 전략별 아코디언과 차트를 그린다.
- 투자 상세 화면에 Quant 전략 구조표를 추가했다. 현재비중, 목표비중, 허용밴드, 신호 기준, ticker/평균단가 준비 상태를 먼저 표시한다.
- Supabase `quant_strategy_rules` 테이블을 추가했다. 전략별 목표비중, 허용밴드, 신호 기준을 코드 상수가 아니라 DB 설정으로 저장한다.
- 투자 상세 화면에서 `quant_strategy_rules` 값을 직접 수정하고 저장할 수 있다. 저장 후 로컬 캐시와 현재 화면을 즉시 갱신한다.
- Supabase `portfolio_market_prices` 테이블을 추가했다. ticker별 수동 현재가, 통화, 가격일, source를 저장한다.
- 투자 상세 화면에서 ticker별 현재가를 직접 입력/저장하고, 같은 통화의 `shares * avg_buy_price`와 `shares * current_price`를 비교해 미실현 손익률을 계산한다.
- 현재가 통화와 포트폴리오 row 통화가 다르면 환율이 없으므로 수익률 계산을 보류한다.

### 2차 적용 결과

2026-06-03에 `codex/quant-engine` 브랜치에서 Quant 계산 흐름을 한 단계 확장했다.

- 투자 상세 화면에 전략별 수익률 요약 카드를 추가했다.
- 수익률은 현재가, 평균단가, 수량, 통화가 모두 맞는 종목만 계산한다.
- 같은 전략 안에 KRW/USD 등 여러 통화가 섞이면 손익을 통화별로 분리해 표시한다.
- Quant 전략 구조표에 목표비중 대비 리밸런싱 필요액을 추가했다.
- 리밸런싱 필요액은 기존 DB 평가금액 기준으로 계산한다. 외부 환율이 아직 없기 때문에 현재가 평가액을 통화 혼합으로 합산하지 않는다.
- Supabase `portfolio_price_history` 테이블을 추가했다. 수동 현재가 저장 시 `portfolio_market_prices` 최신값과 `portfolio_price_history` 이력을 함께 upsert한다.
- `supabase/functions/sync-market-prices` Edge Function 스캐폴드를 추가했고, 이후 Twelve Data를 기본 provider로 연결했다. `TWELVE_DATA_API_KEY`를 서버 secret으로 사용해 시세를 가져오고 최신값/이력을 캐시하는 구조다.

### 시세 공급자 검토

2026-06-03 기준으로 실제 시세 공급자는 다음 기준으로 검토했다.

- 한국 주식/ETF와 미국 주식/ETF를 같은 구조로 처리할 수 있는가
- 무료 범위만으로 개인 포트폴리오 동기화가 가능한가
- Supabase Edge Function에서 API key를 숨기고 호출하기 쉬운가
- 배치 조회, 캐시, 이력 저장 구조로 확장 가능한가

| 후보 | 장점 | 단점 | 판단 |
| --- | --- | --- | --- |
| Twelve Data | 미국/글로벌 주식, ETF, forex, crypto를 같은 API 형태로 테스트할 수 있다. `/quote`, `/price` 배치 조회가 가능하고 미국/글로벌 개발 테스트는 무료 Basic credit으로 시작하기 쉽다. | 한국 KRX/KOSDAQ/KONEX는 EOD와 유료 플랜 조건이 붙어 있으므로 무료 고정 원칙에서는 차단해야 한다. | 선택적 무료 테스트 |
| Alpha Vantage | 문서가 단순하고 글로벌 quote endpoint가 있다. | 무료 제한이 매우 낮고, bulk real-time quote는 premium 쪽 성격이 강하다. 개인 포트폴리오 여러 종목 동기화에 답답하다. | 보류 |
| Financial Modeling Prep | 미국 주식, 재무제표, 프로필 데이터가 강하고 무료 호출량이 비교적 명확하다. | 한국 종목 커버리지와 거래소 suffix 운용이 Twelve Data보다 이번 요구에 덜 직접적이다. | 보조 후보 |
| Finnhub | quote API가 단순하고 free tier rate가 넉넉한 편이다. | 한국 종목/ETF 커버리지와 장기 확장성은 별도 확인이 필요하다. | 보조 후보 |
| KIS Open API | 국내주식 현재가를 공식 API로 조회할 수 있다. 증권사 앱키/시크릿 기반으로 무료 사용 가능성이 높고 비공식 크롤링보다 안정적이다. | OAuth 토큰 발급과 앱키 관리가 필요하다. 계좌/주문 API까지 확장하면 보안 설계가 커진다. | 한국 무료 provider 채택 |
| Yahoo/Naver 비공식 API | key 없이 빠르게 붙일 수 있다. | 비공식 endpoint라 차단/스키마 변경/약관 리스크가 크다. | 제외 |

결론: 무료 고정을 위해 기본 provider는 `disabled`로 둔다. 한국 국내 단축코드 ticker 자동 조회는 KIS Open API의 국내주식 현재가 조회 provider를 별도로 붙인다. Twelve Data는 미국/글로벌 ticker의 무료 개발 테스트에만 선택적으로 사용하고, 한국 거래소 symbol은 Twelve Data 경로에서 계속 차단한다.

### 무료 전용 시세 적용 결과

- `sync-market-prices` Edge Function의 기본 provider를 `disabled`로 정했다.
- `TWELVE_DATA_API_KEY`는 선택적 무료 테스트용 secret으로만 사용한다.
- `MARKET_PRICE_PROVIDER=twelvedata`일 때만 여러 ticker를 comma-separated `symbol` 파라미터로 요청한다.
- 포트폴리오 ticker가 `005930`, `0098N0` 같은 한국 국내 단축코드이면 기본 provider symbol을 `005930:XKRX`, `0098N0:XKRX`처럼 변환하지만 실제 호출은 차단한다.
- KOSDAQ/KONEX 또는 provider symbol이 다른 경우 `TWELVE_DATA_SYMBOL_OVERRIDES` JSON으로 `{"091990":"091990:XKOS"}`처럼 덮어쓴다.
- 의도하지 않은 유료 플랜 호출을 막기 위해 한국 거래소 symbol은 코드상 항상 차단한다. 유료 호출을 켜는 override는 없다.
- 같은 날짜에 이미 저장된 API 시세가 있으면 외부 API를 다시 호출하지 않고 DB 캐시를 반환한다.
- `MARKET_PRICE_PROVIDER=kis`일 때는 KIS Open API의 국내주식 현재가 조회만 호출한다.
- KIS provider는 국내 단축코드 ticker만 허용하고, 계좌잔고/주문/체결 API는 호출하지 않는다.
- KIS 접근 토큰은 Edge Function 런타임 메모리에만 캐시하고 DB에는 저장하지 않는다.

Backfill 결과:

| strategy_tag | count |
| --- | ---: |
| cash | 8 |
| growth | 15 |
| index | 8 |
| other | 3 |
| pension | 6 |

`avg_buy_price`는 실제 매입단가를 사용자가 입력해야 하므로 backfill하지 않았다.

Quant 전략 설정 기본값:

| strategy_tag | target_pct | band_pct | trigger_label |
| --- | ---: | ---: | --- |
| dividend | 25 | 5 | 배당률 |
| index | 45 | 7 | 추세 |
| growth | 20 | 6 | 모멘텀 |
| cash | 10 | 4 | MDD 방어 |
| pension | 0 | 0 | 장기보유 |
| other | 0 | 0 | 수동검토 |

수동 현재가 구조:

| 테이블 | 핵심 컬럼 | 역할 |
| --- | --- | --- |
| `portfolio_market_prices` | `ticker`, `price`, `currency`, `price_date`, `source` | 자동 시세 API 이전 단계의 최신 현재가 저장소 |
| `portfolio_price_history` | `ticker`, `price`, `currency`, `price_date`, `source` | MDD, 변동성, 리밸런싱 검증에 사용할 날짜별 가격 이력 |

최신 화면 계산은 `portfolio_market_prices`를 사용하고, 이후 과거 수익률/MDD/변동성 계산은 `portfolio_price_history`를 사용한다.

## 3. 자산유형 자동분류

### 실행가능성

가장 먼저 개발하기 좋다. 현재 포트폴리오 구조를 크게 바꾸지 않고도 규칙 기반 분류를 추가할 수 있고, Quant와 Risk Assessment의 기반이 된다.

### 1차 구현 범위

브랜치: `codex/asset-classification`

DB 스키마 변경 없이 프론트엔드 계산 레이어에서 다음 값을 자동 분류한다.

- `account`: 계좌, 통장, 예금, 적금, CMA, 파킹, 현금, 예수금, 외화, RP, 발행어음
- `stock`: 보유 수량이 있거나 주식/종목 키워드가 있는 항목
- `etf`: ETF, VOO, QQQ, SCHD, SPY, S&P, KODEX, TIGER 등 ETF 키워드 항목
- `real_estate`: 청약, 부동산, 보증금, 전세 관련 항목
- `debt`: 부채, 대출, 음수 금액 항목

현재 구현은 포트폴리오 항목별 분류 배지와 계산 보조값을 유지한다. 별도 자산유형 자동분류 요약 카드는 제거했고, 투자 상세 화면의 전략 구조와 MDD 방어 상태 계산에서 내부 분류 결과만 사용한다.

### 2차 구현 범위

실제 Supabase DB에 존재하는 `portfolios.group_name`을 우선 분류 기준으로 사용한다.

- 포트폴리오 그룹은 `현금`, `안전`, `투자`, `연금`, `부채`, `기타` 순서로 정렬한다.
- 포트폴리오 편집 모달에서 항목별 분류를 바꾸면 working row의 `group_name`을 변경한다.
- 저장 시 기존 포트폴리오 저장 로직을 통해 Supabase `portfolios.group_name`과 분류 메타데이터 컬럼에 함께 반영한다.

### 1차 구현 한계

- 세부 분류인 `주식`/`ETF`는 `group_name='투자'` 내부에서 종목명/수량 키워드로 추정한다.
- `asset_type`, `risk_bucket`, `ticker`, `strategy_tag`, `avg_buy_price`는 DB 컬럼으로 승격했지만, 외부 시세/실현손익/배당 데이터는 아직 없다.
- 평균 매입가는 자동 backfill하지 않았으므로 사용자가 직접 입력해야 한다.
- ETF/주식 키워드는 보유 종목명이 늘어날수록 보강해야 한다.

### Supabase 컬럼 승격안

2026-06-03에 Supabase MCP를 통해 `portfolios` 테이블에 다음 컬럼을 추가했고, 기존 40개 row를 `group_name` 기준으로 backfill했다.

```sql
alter table portfolios
  add column if not exists asset_type text,
  add column if not exists instrument_type text,
  add column if not exists ticker text,
  add column if not exists risk_bucket text,
  add column if not exists classification_source text,
  add column if not exists classification_updated_at timestamptz;
```

프론트엔드는 컬럼 추가 후 다음 순서로 전환한다.

1. `select('*')`로 기존 컬럼과 신규 컬럼을 모두 읽는다.
2. DB의 `classification_source = 'manual'`이면 규칙보다 우선한다.
3. 편집 모달 저장 시 `asset_type`, `instrument_type`, `risk_bucket`, `classification_source`를 함께 upsert한다.
4. localStorage override 방식은 제거하고 DB 컬럼을 단일 기준으로 사용한다.

Backfill 결과:

| asset_type | instrument_type | risk_bucket | count |
| --- | --- | --- | --- |
| account | cash_account | safe | 3 |
| account | safe_account | safe | 5 |
| debt | loan | debt | 1 |
| etf | etf | market | 8 |
| other | other | other | 2 |
| pension | pension | tied | 6 |
| stock | stock | market | 15 |

### 권장 데이터 모델

`portfolios` 테이블에 다음 컬럼을 점진적으로 추가하는 방식을 권장한다.

| 컬럼 | 예시 | 설명 |
| --- | --- | --- |
| `asset_type` | `cash`, `account`, `stock`, `etf`, `debt`, `real_estate_ready` | 큰 자산군 |
| `instrument_type` | `deposit`, `saving`, `domestic_stock`, `us_etf` | 세부 상품군 |
| `ticker` | `005930`, `VOO` | 시세 연동용 |
| `strategy_tag` | `dividend`, `index`, `growth` | 투자 전략 그룹 |
| `avg_buy_price` | `73.24`, `65000` | 평균 매입단가 |
| `broker` | `삼성증권`, `토스증권` | 계좌/증권사 |
| `risk_bucket` | `safe`, `market`, `debt` | 리스크 집계용 |
| `classification_source` | `rule`, `manual`, `import` | 분류 출처 |

### 분류 규칙 예시

- 이름에 `ETF`, `VOO`, `QQQ`, `SCHD`가 있으면 ETF 후보
- 종목코드나 ticker가 있으면 주식/ETF 후보
- 이름에 `예금`, `적금`, `CMA`, `파킹`이 있으면 계좌/현금성 자산
- 금액이 음수이거나 그룹이 부채이면 `debt`
- 사용자가 수동으로 바꾼 항목은 규칙보다 우선

### 권장 구현 순서

1. DB 컬럼 추가 전, 프론트엔드에서 임시 분류 함수를 만든다.
2. 분류 결과를 포트폴리오 카드와 투자 상세 화면에 표시한다.
3. 수동 수정 UI를 추가한다.
4. DB 컬럼을 추가하고 기존 데이터 migration을 수행한다.
5. Risk Assessment와 Quant 기능에서 이 분류를 사용한다.

## 우선순위 결론

| 우선순위 | 기능 | 이유 |
| --- | --- | --- |
| 1 | Quant 구조 | 목표비중, 밴드, 신호 기준을 먼저 고정해야 이후 데이터가 들어와도 화면/계산 흐름이 흔들리지 않는다. |
| 2 | 자산유형/종목 데이터 보강 | 구조가 잡힌 뒤 ticker, 평균단가, 분류 정확도를 채워 넣으면 된다. |
| 3 | 실시간 DB 업데이트 | 사용자 가치가 크지만 인증/보안/운영 부담이 가장 크다. |

첫 개발 브랜치는 `codex/asset-classification`으로 진행했고, 시세 이력/수익률 엔진 확장은 `codex/quant-engine` 브랜치에서 분리해 진행 중이다.
