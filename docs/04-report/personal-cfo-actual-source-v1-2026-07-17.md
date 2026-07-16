# Personal CFO Actual Source v1 Report

Date: 2026-07-17
Phase: Report
Result: completed

## Delivered

- `mockData.ts`와 `personalCfoMockSnapshot` 런타임 의존을 제거했다.
- 빈 기준 스냅샷과 계획 전용 schema v3 정규화를 추가했다.
- 기존 v2 seed 바구니, 프로젝트, 리스크, KPI를 자동 제거한다.
- 실제 계좌·자산·부채는 FinanceRepository portfolio rows에서만 구성한다.
- 실제 종료월 거래에서 소득 노드와 지출·저축 자금 흐름 노드를 구성한다.
- 계획값이 없으면 KPI와 전략 네트워크에 빈 상태를 표시하고 프로젝트·리스크 표는 하나의 상태로 축약한다.
- 생성 CFO 번들을 45.7KB에서 39.2KB로 줄였다.

## Verified Result

| Area | Result |
| --- | --- |
| 순자산 | 실제 포트폴리오 기준 2.35억 유지 |
| 종료월 잉여현금 | 실제 거래 기준 약 100만원 유지 |
| 고정비·상환율 | 실제 종료월 기준 48.3% 유지 |
| 부채비율 | 실제 포트폴리오 기준 21.7% 유지 |
| 프로젝트·리스크 | seed 제거 후 각각 0개 |
| 계획 KPI | 설정 전 `미설정` 상태 |

## Next Work

- Finance Plan Settings v1에서 계획값을 사용자가 직접 설정하고 변경 이력을 남긴다.
- 여러 포트폴리오 행 저장을 server RPC 또는 transaction으로 원자화한다.
