# Update 1.04.03 Todo 신규등록 정리 검증

## 자동 검사

- `node --check js/features/checklist.js`: 통과
- `node tools/check-ui-contract.mjs`: 통과
- `npm.cmd run check`: 전체 통과
- `git diff --check`: 통과

## 브라우저 검사

- PC: 기존 상세가 열린 상태에서 신규등록 창이 즉시 전면 노출되고 제목에 포커스됨.
- 모바일 390 × 844: 신규등록 창과 제목 입력란이 화면에 표시됨.
- PC·모바일 모두 신규등록 폼의 Step 입력 0개, Subgroup 입력 0개 확인.
- 신규등록 모달의 상위 레이어(`z-[70]`) 적용 확인.
