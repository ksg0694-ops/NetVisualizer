# Update 1.04.03 Note Workspace Check

## 자동 검사

- `npm run check`: 통과
- JavaScript syntax, TypeScript, UI contract, Supabase contract, finance domain, static assets: 통과
- `git diff --check`: 통과
- UI 계약에 Todo 블록/전환/자동 저장/버전과 Learning 3열/Context Dock 검사를 추가했다.

## 브라우저 검사

- Todo `/ 블록`에서 제목·체크박스·강조·구분선·표 메뉴가 열린다.
- 기존 문장을 블록으로 전환해도 내용이 보존된다.
- Todo 입력 정지 후 자동 저장되고 이전 버전을 복원할 수 있다.
- Todo 문장을 Step으로 전환하고 Step 수가 즉시 증가한다.
- Learning Archive에서 Enter 줄바꿈, Tab 들여쓰기, 자동 저장, 버전 기록이 동작한다.
- Learning 문장을 Todo로 전환하면 Context Dock 관련 할 일에 표시된다.
- Learning 분류·태그·참고 링크 편집 패널이 기존 데이터 편집 기능을 보존한다.
- 브라우저 콘솔 오류 0건. 기존 Tailwind CDN 운영 경고만 확인했다.

## 반응형 검사

- 데스크톱 1488×1058: Todo 3열, Learning `계층 목록 / 편집기 / Context Dock` 3열 확인.
- 모바일 390×844: 두 화면 모두 `scrollWidth === innerWidth === 390`, 가로 넘침 없음.

## 의존성 보안 검사

- `npm audit fix`로 `nanoid`를 3.3.18로 갱신했다.
- `pptxgenjs@3.12.0`이 사용하는 `image-size@1.2.1` 관련 고위험 권고 2건은 남아 있다.
- 자동 제안인 `npm audit fix --force`는 `pptxgenjs@1.1.5`로의 breaking downgrade이므로 적용하지 않았다.
- 이번 노트 기능은 해당 이미지 파서 경로를 사용하지 않으며, PPT 의존성 교체는 별도 호환성 패치로 분리한다.
