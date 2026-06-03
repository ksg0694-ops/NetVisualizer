# sync-market-prices

Supabase Edge Function scaffold for server-side market price synchronization.

## Purpose

- Read tickers from the request body or from `portfolios.ticker`.
- Call a configured quote provider from the server.
- Upsert latest prices into `portfolio_market_prices`.
- Upsert historical prices into `portfolio_price_history`.

## Provider Decision

NetVisualizer runs in free-only mode by default. No external quote provider is called unless you explicitly set a free provider.

Why:

- `disabled` is the default provider, so manual prices and DB cache work without any external API.
- `kis` uses Korea Investment & Securities Open API for Korean domestic short-code quotes only.
- `twelvedata` remains optional for US/global free-tier development tests only.
- The function uses today's DB cache before calling any provider.

Tradeoffs:

- KIS requires app credentials from KIS Developers.
- KIS token is cached only in the Edge Function runtime memory, not in the database.
- This function does not call account, balance, order, or paid-market-data endpoints.
- Korean symbols through Twelve Data are always blocked.

## Required Secrets

- `MARKET_PRICE_PROVIDER`: `disabled` by default. Optional values: `kis`, `twelvedata`.
- `KIS_APP_KEY`: optional KIS Developers app key for domestic Korean quotes.
- `KIS_APP_SECRET`: optional KIS Developers app secret for domestic Korean quotes.
- `KIS_BASE_URL`: optional, defaults to `https://openapi.koreainvestment.com:9443`.
- `TWELVE_DATA_API_KEY`: optional Twelve Data free-tier API key for US/global tests.
- `TWELVE_DATA_SYMBOL_OVERRIDES`: optional JSON map from local ticker to provider symbol.
- Supabase default Edge Function secrets: `SUPABASE_URL` and `SUPABASE_SECRET_KEYS`.

Legacy `SUPABASE_SERVICE_ROLE_KEY` is supported as a fallback for local development.

For local setup, copy `supabase/functions/.env.example` to `supabase/functions/.env` and replace the key.

## Local Test Shape

```bash
supabase functions serve sync-market-prices --env-file supabase/functions/.env
```

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/sync-market-prices \
  -H "Content-Type: application/json" \
  -d "{\"tickers\":[\"VOO\",\"SCHD\"],\"dryRun\":true}"
```

Korean stock examples:

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/sync-market-prices \
  -H "Content-Type: application/json" \
  -d "{\"tickers\":[\"005930\",\"091990\"],\"dryRun\":true}"
```

With `MARKET_PRICE_PROVIDER=kis`, Korean domestic short-code tickers such as `005930` and alphanumeric ETF codes such as `0098N0` are queried through the KIS domestic quote endpoint.

There is no paid-market-data override. Non-domestic short-code tickers are rejected by the KIS provider.
