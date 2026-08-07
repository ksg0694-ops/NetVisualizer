# Update 1.04.02 Plan

## 목표

- 할 일을 `Career / Finance / Life` 그룹으로 나누고 `진행 중 / Monitor / 완료` 상태로 관리한다.
- 완료된 할 일에서 PPT 완료 보고서를 만들고 파일 Library에 보관한다.
- Step에 Subgroup과 상세내역을 추가한다.
- Life 그룹에서는 가벼운 `생활 노트`와 Life 할 일을 한 탭에서 함께 제공한다.
- `공부 분야 → 공부 항목 → Chapter → 상세 노트` 구조의 학습 아카이브를 신설한다.

## 범위

- Frontend: Career/Finance/Life Todo, Life 내장 생활 노트, 학습 아카이브, PC/모바일 내비게이션
- Data: `life_todos` 확장, `life_notes`, `learning_archive_notes`, `todo-reports` Storage
- PWA: 신규 정적 자산 캐시 및 버전 1.04.02 반영

## 완료 기준

- PC Todo는 목록과 넓은 상세 편집기를 동시에 표시한다.
- 모바일 폼은 화면 단위로 열리고 핵심 입력이 잘리지 않는다.
- Life 그룹은 메모/체크/보류 Quick Capture와 할 일 목록을 같은 화면에 제공한다.
- 완료 보고서 PPT가 브라우저에서 생성·다운로드된다.
- 전체 애플리케이션 검사와 반응형 화면 검증을 통과한다.

## Todo Workbench 최종 보정

- PC에서 Career/Finance/Life 목록, 상세 편집기, 완료보고서 라이브러리를 한 화면의 3열로 제공한다.
- 상태 필터와 영역 선택은 선택한 할 일의 헤더에 compact select로 모은다.
- 상세 화면에서는 Step 입력 패널을 숨기고 상세내역 작성 공간을 최대화하되 기존 Step 데이터는 보존한다.
- 좌측 목록의 중복 제목과 영역 라벨을 제거한다.

## 완료보고서 외부 링크 보정

- 완료보고서는 NetVisualizer 내부에서만 생성하지 않고 Google Slides, Drive, PowerPoint 등 외부 PPT 주소도 연결할 수 있어야 한다.
- 링크는 선택한 완료 할 일의 `completion_report`에 저장하고 파일 업로드 메타데이터와 함께 유지한다.

## Report Library 의미 정정

- Report Library는 완료 상태의 결과물이 아니라 모든 할 일이 각각 소유하는 독립 자료함이다.
- 진행 중, Monitor, 완료 여부와 관계없이 링크와 파일을 여러 개 등록할 수 있다.
- 할 일 상태가 바뀌어도 해당 Library 항목은 유지한다.

## OneNote 편집 도구 및 Library 단순화

- Report Library는 별도 파일 업로드 없이 링크 등록만 제공한다.
- 링크 제목과 주소로 PowerPoint, Excel, 일반 링크를 자동 구분한다.
- 할 일 상세내역은 3칸 들여쓰기, 체크박스, 아이콘 삽입을 지원한다.
- 서버 저장 상태 배지는 제거해 좌측 목록을 단순화한다.

## 수정패치: Tab·체크박스·생활노트 제거

- 상세내역에서 Tab은 현재 줄 또는 선택한 여러 줄을 공백 3칸만큼 들여쓴다.
- Shift+Tab은 최대 공백 3칸을 내어쓴다.
- 체크박스 미리보기는 편집창 위에서 즉시 보이고 작은 크기로 수직 중앙 정렬한다.
- 생활노트 화면과 실행 코드는 제거하되 기존 저장 데이터는 삭제하지 않는다.
