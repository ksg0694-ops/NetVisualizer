# Update 1.04.02 Design

## 정보 구조

- 생활 도구: `할 일`, `생활 노트`, `학습 아카이브`
- Todo 그룹: 사용자 입력 `group_name`으로 목록을 구획한다.
- Todo 상태: `is_done`과 `is_paused`를 독립 값으로 유지한다.
- Step: 기존 JSON 배열에 `groupName`, `detail`을 추가한다.
- 완료 보고서: 요약/성과/Monitor 내용을 `completion_report`에, 업로드 메타데이터를 `report_files`에 저장한다.

## 생활 노트

선택된 5안인 Pocket Notebook을 기준으로 구현한다.

- PC: 왼쪽 Quick Capture·카드 목록 + 오른쪽 넓은 상세 편집기
- 모바일: 메모/체크/보류 탭 + Quick Capture + 2열 카드
- 보류 카드: 낮은 채도와 높은 투명도로 Monitor 상태를 표현한다.

## 학습 아카이브

- 왼쪽: 분야/항목/Chapter 트리 및 검색
- 오른쪽: 상세 학습 노트 편집기
- 노트 속성: 태그, 참고 링크, 고정 상태

## 서버 계약

- 신규 테이블은 현재 단일 사용자 public-server 정책과 같은 소유자 규칙을 사용한다.
- 완료 보고서 Storage는 로그인 사용자별 private 경로를 사용한다.
- 신규 Todo 컬럼 배포 전에도 기존 스키마로 재시도해 로컬 기능을 보존한다.
