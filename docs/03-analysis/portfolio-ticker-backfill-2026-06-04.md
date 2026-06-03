# Portfolio Ticker Backfill - 2026-06-04

## Scope

This backfill filled obvious stock and ETF tickers in `public.portfolios`.
Cash, loan, subscription, jeonse deposit, and MMF-like rows were left without tickers unless a listed market code was clear.

## Applied Mapping

| Portfolio name | Ticker | Note |
| --- | --- | --- |
| Aberdeen Physical Precious Metals ETF | GLTR | abrdn Physical Precious Metals Basket Shares ETF |
| ACE KRX금현물 | 411060 | Korean listed ETF |
| BITWISE 10 CRYPTO | BITW | Bitwise 10 Crypto Index vehicle |
| ERSHS PVT PB ETF | XOVR | ERShares Private-Public Crossover ETF |
| Invesco Yield Diversified Commoditiy ETF | PDBC | Invesco Optimum Yield Diversified Commodity Strategy ETF |
| ISHARES 0-3M TREASURY BOND | SGOV | iShares 0-3 Month Treasury Bond ETF |
| ISHARES 20+Y TREASURY BOND | TLT | iShares 20+ Year Treasury Bond ETF |
| ISHARES 7-10Y TREASURY BOND | IEF | iShares 7-10 Year Treasury Bond ETF |
| iShares MSCI Chile Capped ETF | ECH | iShares MSCI Chile ETF |
| KODEX 인도Nifty50 | 453810 | Korean listed ETF; applied to investment and pension rows |
| LS | 006260 | Korean listed stock |
| TIGER 미국배당다우존스 | 458730 | Korean listed ETF |
| TIGER 차이나반도체FACTSET | 396520 | Korean listed ETF |
| 대신증권 | 003540 | Korean listed stock |
| 레스토랑 브랜즈 인터내셔널 | QSR | Restaurant Brands International |
| 리얼티 인컴 | O | Realty Income |
| 신영증권 | 001720 | Korean listed stock |
| 태광산업 | 003240 | Korean listed stock |
| PLUS 자사주매입고배당주 | 0098N0 | Korean listed ETF alphanumeric short code |
| RISE 코리아밸류업 | 495050 | Korean listed ETF |
| SOL 코리아고배당 | 0105E0 | Korean listed ETF alphanumeric short code |
| TIGER 인도니프티50 | 453870 | Korean listed ETF |

## Additional Cleanup

- `현금(삼성증권)`, `현금(중개형ISA)`, and `현금(한국투자)` rows were reclassified from `stock/growth` to `account/cash_account/cash`.
- `BITWISE 10 CRYPTO` was reclassified to ETF asset type but kept in the growth strategy bucket.
- iShares Treasury Bond rows were reclassified to ETF asset type and the index strategy bucket.
- `삼성신종종류형MMF제4호-CP` was left without a ticker because it looks like a fund/MMF holding rather than a listed ETF short code.

## Follow-Up Checks

- Confirm every ticker against the user's brokerage app.
- Fill `shares` and `avg_buy_price` next; ticker alone only enables price lookup and signal readiness, not full return accuracy.
- For alphanumeric Korean ETF codes such as `0098N0` and `0105E0`, the Edge Function now treats `NNNNAN`-style six-character codes as domestic short codes.
