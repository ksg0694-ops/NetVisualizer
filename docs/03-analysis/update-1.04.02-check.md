# Update 1.04.02 Check

## 자동 검사

- `npm run check`: 통과
- JavaScript 문법, TypeScript, UI 계약, Supabase 컬럼 계약, 정적 자산 참조: 통과

## 브라우저 기능 검사

- `할 일` 상단 그룹이 Career/Finance/Life 3개로 고정됨: 통과
- 별도 생활 노트 메뉴 제거: 통과
- Life 그룹에서 생활 노트와 Life 할 일을 동시 표시: 통과
- 생활 노트 Quick Capture 생성: 통과
- 생활 노트 Monitor 보류/재활성화: 통과
- 학습 아카이브 신규 노트 및 4단계 입력 폼: 통과
- 사용자 입력 Todo 그룹 필드 제거: 통과
- Step Subgroup 및 Step 상세내역 보존: 통과
- Todo Monitor 필터 및 투명 상태: 통과
- 완료 보고서 입력과 PPT 생성 완료 토스트: 통과

## 반응형 검사

- PC 1487×1058: Life 노트 2단 편집 구조와 Life 할 일 목록의 동일 탭 배치 확인
- 모바일 390×844: 메뉴, 탭, Quick Capture, 2열 카드 레이아웃 확인

## 알려진 운영 조건

- PPT는 로그인하지 않아도 로컬 다운로드가 가능하다.
- 서버 Upload Library는 로그인과 `todo-reports` Storage migration이 필요하다.

## Todo Workbench 최종 검사

- PC 1280×720: 좌측 3개 영역 목록, 중앙 전체 폭 상세 편집기, 우측 영구 완료보고서 라이브러리 확인
- 모바일 390×844: 상세 제목과 상태/영역 컨트롤이 2행으로 정렬되고 가로 잘림 없음
- 상태 select 전환, 보고서 검색 초기화, 상세 저장 동작 확인
- 숨겨진 Step 입력 DOM 없이 상세 저장 후 기존 Step 데이터 보존 계약 확인
- `npm run check`: 전체 통과
- `npm audit --audit-level=moderate`: 취약점 0건
