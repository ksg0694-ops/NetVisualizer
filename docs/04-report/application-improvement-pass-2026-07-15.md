# NetVisualizer 애플리케이션 개선 1차 완료 보고

- 작업 시작: 2026-07-15
- 범위: 로그인 정책을 제외한 제로베이스 검토의 우선 개선 항목
- 실행 환경: 로컬 정적 PWA + Supabase 데이터

## 결정

개인 로컬 관리 앱에 로그인은 필수 조건이 아니다. 이번 단계에서는 인증 방식과 로그인 UI를 변경하지 않았다.

다만 현재 익명 Supabase 정책은 공개 서비스에 적합하지 않다. 인증 정책을 정하기 전까지 앱은 로컬 단일 사용자 환경에서만 사용하고, 공개 배포와 추가 민감정보 적재는 보류한다.

## 완료한 개선

### 1. 재무 숫자 신뢰 통합

- `financeModel.js`를 현재 재무 데이터의 공통 계산 경계로 만들었다.
- Finance Home, Portfolio, Personal CFO가 포트폴리오 실제값을 우선하는 같은 순자산을 표시한다.
- 현재 검증값은 총자산 `299,601,305원`, 부채 `65,000,000원`, 순자산 `234,601,305원`이다.
- 화면에 데이터 원천과 최근 갱신 시점을 표시한다.
- Finance Home의 정적 안내를 최대 3개의 동적 의사결정 항목으로 교체했다.

### 2. Personal CFO 데이터와 모바일 UX

- 실제 포트폴리오가 있으면 mock 계좌·자산·부채를 완전히 대체한다.
- 프로젝트는 `부동산 청약 준비`, `온라인 석사 준비` 두 개만 유지한다.
- 데스크톱은 직사각형 노드와 직교 연결선 네트워크를 유지한다.
- 모바일은 복잡한 그래프 대신 자산, 부채, 월 자금 배분 목록을 보여준다.
- 프로젝트와 리스크는 점수순 표로 표시한다.

### 3. Life 실행 홈

- 생활 홈에 미완료, 오늘 마감, 기한 지남, 최근 체중 KPI를 추가했다.
- 우선 할 일 5개, 7일 체중 평균, CFO 프로젝트 진행률을 한 화면에 연결했다.
- 할 일을 누르면 해당 Todo 상세가 바로 열린다.
- 현재 실제 데이터로 미완료 5개, 기한 지남 4개, 최근 체중 62.9kg이 표시된다.

### 4. 한글화와 접근성

- 사이드바, 건강, 할 일, Finance/Life 주요 제목을 한글로 정리했다.
- 홈, 새로고침, 설정, 추가, 삭제, 닫기, 드래그 버튼에 접근 가능한 이름을 추가했다.
- 건강 날짜·체중·메모·키 입력과 label을 연결했다.
- 체중 입력의 과도한 크기와 오해를 부르는 예시값을 줄였다.
- `실시간 동기화됨`을 실제 동작에 맞는 `최근 동기화됨`으로 수정했다.

### 5. 코드·성능·AI 작업 비용

- 반복되던 HTML escape, 날짜·금액 형식을 `appUtils.js`로 모았다.
- SheetJS와 Leaflet을 필요한 기능에 들어갈 때만 지연 로드한다.
- Life 기능은 서로의 내부 상태를 직접 읽지 않고 dashboard snapshot API를 사용한다.
- 공통 재무 계산과 UI 스크립트 계약 검사를 `npm run check`에 추가했다.
- 현재 런타임 소유권과 수정 규칙을 `docs/02-design/current-architecture-map.md`에 기록했다.

## 검증 결과

- `npm.cmd run check`: manifest, JavaScript syntax, TypeScript, domain model, UI contract, Supabase column contract, static asset 검사 통과
- 데스크톱: Finance Home, Personal CFO, Life Home, Health, Portfolio 실제 데이터 렌더 확인
- 모바일 390x844: Personal CFO 요약 전환, Life Home, Todo에서 가로 넘침 없음
- Finance Home, Portfolio, Personal CFO의 순자산 `234,601,305원` 일치 확인
- SheetJS는 첫 화면에서 로드되지 않고, Leaflet은 부동산 진입 시 로드되는 흐름 확인
- 브라우저 콘솔에서 앱 런타임 오류 없음. Tailwind CDN 운영 경고만 남음

## 캡처

- `docs/audits/improvement-pass-2026-07-15/01-finance-home-desktop.png`
- `docs/audits/improvement-pass-2026-07-15/02-personal-cfo-desktop.png`
- `docs/audits/improvement-pass-2026-07-15/03-life-home-desktop.png`
- 기존 전후 비교: `docs/audits/zero-base-review-2026-07-15/`

## 다음 개선 순서

1. Vite + TypeScript를 실제 런타임으로 도입하고 Personal CFO 중복 JS/TS를 하나로 만든다.
2. Supabase 2차원 배열 계약을 객체 기반 repository로 교체한다.
3. 월간 CFO 마감과 90일 현금 전망을 추가한다.
4. Todo의 프로젝트 연결, 반복, 알림은 스키마를 함께 설계해 추가한다.
5. 인증은 외부 공개 필요성이 생길 때 로컬 PIN, 패스키, OAuth 중 사용 환경에 맞춰 결정한다.

이번 1차 단계의 제품 방향은 `Finance-first Personal OS`다. 재무 네트워크는 관계 탐색용 보조 화면으로 두고, 기본 홈은 오늘 확인하고 실행할 항목을 우선한다.
