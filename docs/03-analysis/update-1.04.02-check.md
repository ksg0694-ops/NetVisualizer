# Update 1.04.02 Check

## 자동 검사

- `npm run check`: 통과
- JavaScript 문법, TypeScript, UI 계약, Supabase 컬럼 계약, 정적 자산 참조: 통과

## 브라우저 기능 검사

- 생활 노트 Quick Capture 생성: 통과
- 생활 노트 Monitor 보류/재활성화: 통과
- 학습 아카이브 신규 노트 및 4단계 입력 폼: 통과
- Todo 그룹 헤더 표시: 통과
- Step Subgroup 및 Step 상세내역 보존: 통과
- Todo Monitor 필터 및 투명 상태: 통과
- 완료 보고서 입력과 PPT 생성 완료 토스트: 통과

## 반응형 검사

- PC 1487×1058: 2단 편집 구조 및 넓은 상세 입력 영역 확인
- 모바일 390×844: 메뉴, 탭, Quick Capture, 2열 카드 레이아웃 확인

## 알려진 운영 조건

- PPT는 로그인하지 않아도 로컬 다운로드가 가능하다.
- 서버 Upload Library는 로그인과 `todo-reports` Storage migration이 필요하다.
