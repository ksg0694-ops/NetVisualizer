# Mobile state and Todo formatting design

## State restoration

앱 공통 UI 상태와 할 일 UI 상태를 업무 데이터와 분리해 `localStorage`에 저장한다.

- `netvisualizer.app.ui-state.v1`: 활성 탭, Monthly Report/현금흐름 선택 월
- `netvisualizer.checklist.ui-state.v1`: 진행 상태 필터, 영역 필터, 선택한 할 일 ID

앱 탭은 실제 존재하고 복원 가능한 뷰만 허용하고, 월은 `YYYY-MM` 형식만 허용한다. 할 일 상태도 허용된 필터와 영역만 복원한다. 탭 이동과 필터 변경 시 즉시 저장하며 `visibilitychange`와 `pagehide`를 종료 직전 보조 저장 지점으로 사용한다.

저장하지 않은 입력값은 의도적으로 복원하지 않는다. 서버 데이터와 충돌하거나 사용자가 취소한 편집이 되살아나는 문제를 피하기 위해서다.

## Todo card color

영역 배지는 유지하면서 카드 전체에 동일 계열의 50 단계 배경색과 200 단계 테두리를 사용한다.

- Career: sky
- Finance: emerald
- Life: violet

선택 상태는 한 단계 진한 배경과 얇은 링으로 구분한다. 색상만으로 의미를 전달하지 않도록 기존 영역 텍스트 배지도 유지한다.

## Note formatting

`contenteditable` HTML 저장 대신 토큰 기반 편집을 사용한다.

- 굵게: `**텍스트**`
- 밑줄: `++텍스트++`
- 취소선: `~~텍스트~~`

이 방식은 기존 텍스트 컬럼과 서버 동기화 구조를 바꾸지 않는다. 미리보기는 전체 문자열을 HTML 이스케이프한 뒤 세 토큰만 `strong`, `u`, `s`로 변환한다. 따라서 임의 HTML이나 스크립트는 실행되지 않는다.

## Mobile behavior

상세 편집 폼의 상단에 28px 서식 버튼을 한 줄로 배치해 390px 폭에서도 줄바꿈 없이 사용한다. 서식이 포함된 경우에만 미리보기를 표시해 기존 폼 높이를 불필요하게 늘리지 않는다.
