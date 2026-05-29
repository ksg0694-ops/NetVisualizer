# 부동산 버그 수정 및 신규 뷰 개발

- [x] `index.html` 버그 수정: `views` 객체에 `'realestate-view'` 추가
- [x] 대시보드 구조 개편
  - [x] 수입/지출 카드를 하나의 카드로 병합
  - [x] `md:grid-cols-3`를 `md:grid-cols-2`로 변경하여 레이아웃 조정
- [x] 투자자산 상세 페이지 뷰 신설
  - [x] `<div id="invest-detail-view">` 마크업 작성 (뒤로가기 버튼 포함)
  - [x] `renderPortfolio()` 내 투자자산 렌더링 시 "상세보기" 버튼 추가
  - [x] 상세보기 버튼 클릭 시 `invest-detail-view`를 활성화하고, 해당 투자자산 리스트를 카드로 렌더링하는 JS 로직 작성
