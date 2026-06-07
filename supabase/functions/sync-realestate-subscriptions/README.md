# sync-realestate-subscriptions

Supabase Edge Function scaffold for server-side Applyhome subscription data synchronization.

## Purpose

- Keep public-data API keys out of `index.html`.
- Pull Korea Real Estate Board Applyhome APT subscription rows from data.go.kr / ODcloud.
- Filter the rows for priority keywords such as `고양창릉`.
- Upsert normalized rows into `real_estate_subscription_sites`.
- Let the browser app read Supabase tables instead of calling real-estate APIs directly.

## Free-Only Default

`REALESTATE_SUBSCRIPTION_PROVIDER=disabled` is the default. In this mode the function returns a message and does not call any external API.

Supported provider values:

- `disabled`: no external calls.
- `manual`: no external calls.
- `data-go-kr` or `applyhome`: calls the free Applyhome public-data API.

## Required Secrets For API Sync

- `REALESTATE_SUBSCRIPTION_PROVIDER=data-go-kr`
- `DATA_GO_KR_SERVICE_KEY` or `ODCLOUD_SERVICE_KEY`
- Supabase default Edge Function secrets: `SUPABASE_URL` and `SUPABASE_SECRET_KEYS`

Optional:

- `ODCLOUD_API_KEY`: authorization header key when issued separately.
- `APPLYHOME_API_BASE`: defaults to `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1`.

## Local Test Shape

Disabled mode:

```bash
supabase functions serve sync-realestate-subscriptions --env-file supabase/functions/.env
```

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/sync-realestate-subscriptions \
  -H "Content-Type: application/json" \
  -d "{\"dryRun\":true}"
```

Applyhome dry run:

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/sync-realestate-subscriptions \
  -H "Content-Type: application/json" \
  -d "{\"dryRun\":true,\"keywords\":[\"고양창릉\",\"창릉\"]}"
```

## Current Scope

This function syncs high-level APT subscription-site rows first. Housing-type rows, special/general supply details, competition rows, and apartment transaction references have tables prepared by the migration, but their sync steps should be added after the Applyhome key is verified against live responses.
