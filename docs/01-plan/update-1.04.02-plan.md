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
