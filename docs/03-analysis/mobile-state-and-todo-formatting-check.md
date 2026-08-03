# Mobile state and Todo formatting check

## Automated checks

- JavaScript syntax 검사
- UI contract 검사
- 전체 `npm run check`

## Browser checks

Viewport: 390 × 844

1. 모바일 메뉴에서 할 일 탭 진입
2. 영역별 카드 배경색 확인
3. `NetVisualizer` 상세 열기
4. B/U/S 버튼과 접근성 이름 확인
5. 전체 상세 텍스트를 굵게 토큰으로 감싼 뒤 미리보기 생성 확인
6. 저장하지 않고 페이지 새로고침
7. 할 일 탭과 `NetVisualizer` 상세가 그대로 복원되는지 확인
8. 저장하지 않은 서식 초안은 복원되지 않는지 확인

## Result

- 탭 복원: 통과
- 선택한 할 일 복원: 통과
- 카드 영역 색상: 통과
- B/U/S 도구와 미리보기: 통과
- 저장하지 않은 초안 폐기: 통과

## Limitation

운영체제가 PWA 프로세스를 실제로 강제 종료하는 동작은 브라우저 자동화에서 직접 재현할 수 없어, 동일한 저장/복원 경로를 실행하는 페이지 재로드로 검증했다. 로그인하지 않은 로컬 할 일 데이터로 UI를 검증했으며 서버 동기화 데이터 구조는 변경하지 않았다.
