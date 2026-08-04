# Update 1.04.02 Report

## 반영 결과

- Todo를 `Career / Finance / Life` 고정 그룹으로 구획하고 Monitor 상태를 추가했다.
- Step마다 Subgroup과 상세내역을 기록할 수 있다.
- 완료된 Todo에서 결과 요약/성과/후속 Monitor를 작성하고 PPT로 내려받을 수 있다.
- PPT/PDF Upload Library와 private Supabase Storage 계약을 추가했다.
- 선택한 5안 Pocket Notebook을 `할 일 > Life`에 내장하고 Life 할 일과 같은 탭에서 사용하도록 정정했다.
- 별도 생활 노트 메뉴와 사용자 입력 Todo 그룹은 제거했다.
- NotebookLM/OneNote식 계층을 단순화한 학습 아카이브를 신설했다.
- PC에서는 목록과 상세 편집기를 좌우로 배치하고 모바일에서는 단일 흐름으로 전환한다.

## 버전

- 앱: `1.04.02 · correction 2026.08.05`
- PWA cache: `v158`

## Todo Workbench 보정 결과

- 상단 영역 탭과 4개 상태 버튼을 제거하고 선택 할 일 헤더의 compact select 2개로 통합했다.
- Career/Finance/Life를 좌측 한 목록에서 고정 순서로 동시에 확인할 수 있다.
- 카드의 중복 영역 라벨과 `할 일 목록` 제목을 제거했다.
- 중앙 Step 입력 패널과 완료보고서 입력 폼을 제거해 상세내역 편집 공간을 확장했다.
- 완료보고서 라이브러리를 우측 상시 패널로 전환하고 검색, 정렬, 선택 미리보기를 연결했다.
- 기존 Step 및 완료보고서 데이터는 새 화면에서 저장해도 유지된다.

## 완료보고서 링크 보정 결과

- 선택한 완료보고서에 Google Slides, Drive, PowerPoint 등 외부 PPT 링크를 등록할 수 있다.
- 저장된 링크는 우측 미리보기에서 새 창으로 열 수 있다.
- 빈 링크를 저장하면 연결만 삭제되며 완료 할 일과 기존 보고서 내용은 유지된다.
- 외부 링크는 기존 `completion_report` JSON에 저장되어 별도 DB migration 없이 서버 동기화된다.

## Report Library 의미 정정 결과

- `완료보고서 라이브러리`를 `Report Library`로 변경했다.
- 각 할 일이 자신의 Library를 소유하며 완료 여부와 Report 등록 여부를 분리했다.
- 한 할 일에 제목이 있는 PPT 링크를 여러 개 추가하고 열거나 삭제할 수 있다.
- 업로드 파일과 외부 링크를 기존 `report_files` JSON 배열에서 함께 관리하므로 신규 DB migration은 없다.
- 모바일 상세 닫기는 선택을 해제하지 않고 해당 할 일의 Library로 이동한다.

## OneNote 편집 도구 및 Library 단순화 결과

- Report 파일 업로드 버튼과 서버 저장 상태 배지를 제거했다.
- Report 링크가 PowerPoint 또는 Excel인지 자동 판별해 파일 유형 아이콘과 라벨을 표시한다.
- 상세내역 도구 모음에 3칸 들여쓰기, 체크박스, 중요·아이디어·일정·첨부·주의 아이콘을 추가했다.
- 미리보기 체크박스는 원문 상태와 양방향으로 연결된다.
