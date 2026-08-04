# Update 1.04.02 Plan

## 목표

- 할 일을 그룹으로 묶고 `진행 중 / Monitor / 완료` 상태로 관리한다.
- 완료된 할 일에서 PPT 완료 보고서를 만들고 파일 Library에 보관한다.
- Step에 Subgroup과 상세내역을 추가한다.
- 가벼운 Life 기록은 할 일에서 분리해 `생활 노트`로 제공한다.
- `공부 분야 → 공부 항목 → Chapter → 상세 노트` 구조의 학습 아카이브를 신설한다.

## 범위

- Frontend: Todo, 생활 노트, 학습 아카이브, PC/모바일 내비게이션
- Data: `life_todos` 확장, `life_notes`, `learning_archive_notes`, `todo-reports` Storage
- PWA: 신규 정적 자산 캐시 및 버전 1.04.02 반영

## 완료 기준

- PC Todo는 목록과 넓은 상세 편집기를 동시에 표시한다.
- 모바일 폼은 화면 단위로 열리고 핵심 입력이 잘리지 않는다.
- 생활 노트는 메모/체크/보류 탭과 Quick Capture를 제공한다.
- 완료 보고서 PPT가 브라우저에서 생성·다운로드된다.
- 전체 애플리케이션 검사와 반응형 화면 검증을 통과한다.
