# Update 1.04.03 성능·배포 기반 정리 검증

## 자동 검사

- `npm.cmd run check`: 전체 통과
- Tailwind CSS v4.3.3 빌드: 83,281 bytes 정적 CSS 생성
- 성능 계약: 초기 런타임 23개 모두 `defer`, PPT 엔진 lazy-load 확인
- 정적 자산 계약: 28개 로컬 참조 파일 확인

## 브라우저 검사

- 초기 화면에서 Tailwind Play CDN과 PPT 런타임이 로드되지 않는지 확인
- 초기 화면에서는 활성 화면의 Chart.js canvas만 초기화되는지 확인
- Todo → 학습 아카이브 → Monthly Report → 현금흐름 전환 확인
- Monthly Report에서 숨은 현금흐름 추이 차트가 생성되지 않고, 현금흐름 진입 후 생성되는지 확인
- 브라우저 warning/error 0건 확인
- 390×844 viewport에서 데스크톱 사이드바 숨김, 모바일 메뉴 표시, 수평 overflow 없음 확인

## 초기 전송 감소

- 기존 eager PPT 엔진: 477,529 bytes
- 기존 Tailwind Play CDN 런타임: 407,279 bytes
- 새 정적 Tailwind CSS: 83,281 bytes
- 첫 진입 기준 약 801KB의 비압축 자산과 Tailwind 런타임 실행을 제거

## 배포 게이트

- Service Worker 캐시: `v181`
- 앱 셸 버전: `20260824-active-view-render-1`
- 배포 후 `npm run deploy:verify`로 두 버전을 실제 GitHub Pages와 비교한다.
