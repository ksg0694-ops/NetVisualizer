# Update 1.04.03 성능·배포 기반 정리 설계

## 로딩 경계

- Tailwind v4 CLI로 필요한 유틸리티만 `styles/app.css`에 생성하고 Play CDN 런타임을 제거한다.
- DOM과 무관하게 먼저 실행할 이유가 없는 Supabase, Chart.js, 공통 런타임, 기능 스크립트는 `defer`로 병렬 다운로드 후 문서 순서대로 실행한다.
- 478KB PPT 생성기는 Todo 완료 보고서를 내보낼 때 기존 `loadPptxGenJS()`가 불러오도록 하고 초기 HTML에서는 제거한다.
- 외부 폰트 `@import`를 제거하고 시스템 폰트 스택을 사용해 추가 렌더 차단 요청을 없앤다.

## 렌더 경계

- `switchView()`는 대상 화면을 표시한 뒤 기능별 `bindControls()`와 `render()`를 한 번만 호출한다.
- 대시보드 렌더는 재무 요약만 갱신하고, 현금흐름/Monthly Report 렌더는 해당 화면으로 이동했을 때만 수행한다.
- 자산 추이 Chart.js 인스턴스는 현재 활성 화면의 canvas만 생성하거나 갱신한다.
- 포트폴리오와 부가 정보도 현재 화면에서 필요할 때만 렌더하도록 중앙 라우터에서 차단한다.

## 회귀 방지

- 성능 계약 검사에서 eager PPT 로딩, 비-deferred 런타임, 대시보드-현금흐름 재결합을 탐지한다.
- 배포 검증 명령은 로컬 `sw.js`의 캐시 이름과 GitHub Pages의 `sw.js` 캐시 이름을 비교한다.
- Service Worker 캐시를 `v181`로 올려 브라우저가 수정된 정적 자산을 새 버전으로 인식하게 한다.

## 배포 흐름

1. 최신 `origin/main`에서 수정 브랜치를 만든다.
2. 전체 검사와 브라우저 회귀 검사를 통과한다.
3. 검증된 커밋을 `main`에 fast-forward하고 `origin/main`으로 push한다.
4. `npm run deploy:verify`로 GitHub Pages의 새 캐시 버전을 확인한다.
