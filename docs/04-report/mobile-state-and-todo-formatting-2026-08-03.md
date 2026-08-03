# Mobile state and Todo formatting completion report

## Outcome

모바일 재시작 시 사용자가 보던 탭, 월, 할 일 필터와 상세 선택을 복원하도록 변경했다. 할 일 카드는 Career, Finance, Life 영역색을 되살렸고, 상세내역과 신규 등록 폼에는 굵게·밑줄·취소선 도구와 안전한 미리보기를 추가했다.

## UX audit sequence

1. **앱으로 복귀 — Healthy**  
   마지막 탭과 선택한 할 일이 다시 열린다. 저장하지 않은 초안은 의도적으로 되살리지 않는다.
2. **할 일 목록 훑기 — Healthy**  
   카드 전체의 낮은 채도 색상과 영역 배지를 함께 사용해 빠르게 분류할 수 있다.
3. **상세내역 편집 — Healthy**  
   모바일 한 줄 도구에서 B/U/S를 적용하고, 서식이 있을 때만 미리보기를 확인한다.

## Evidence

- `docs/audits/mobile-state-todo-formatting/01-before-mobile-list.png`
- `docs/audits/mobile-state-todo-formatting/02-before-mobile-detail.png`
- `docs/audits/mobile-state-todo-formatting/03-after-colored-mobile-list.png`
- `docs/audits/mobile-state-todo-formatting/04-after-format-toolbar.png`
- `docs/audits/mobile-state-todo-formatting/05-after-reload-restored.png`
- `docs/audits/mobile-state-todo-formatting/06-before-after-comparison.png`

## Implementation notes

- 업무 데이터와 UI 복원 상태를 서로 다른 저장 키로 분리했다.
- 저장 가능한 뷰와 필터 값을 화이트리스트로 검증한다.
- 사용자 HTML을 저장하지 않고 기존 텍스트 저장 구조를 유지한다.
- Service Worker 캐시를 v152로 갱신했다.
