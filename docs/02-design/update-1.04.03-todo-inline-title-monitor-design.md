# Update 1.04.03 Todo 인라인 제목·Monitor 설계

## 제목 편집

- 기존 제목 `h4`를 편집 시점에만 `contenteditable=true`로 전환한다.
- Enter는 저장, Escape는 취소, 바깥 클릭은 저장으로 처리한다.
- 상세 저장을 누를 때 편집 중인 제목도 함께 반영한다.
- 별도 제목 input과 확인·취소 버튼은 렌더링하지 않는다.

## Monitor 배치

- Monitor 배지를 제목 flex 행의 제목 다음에 배치한다.
- Monitor 때문에 생성되던 두 번째 메타데이터 행을 제거한다.
- 기존 Step 정보가 있는 항목의 Step 행은 유지한다.
