# On-demand BankSalad sync — Plan

The global refresh button must request a fresh Gmail check before refreshing Supabase-backed views. Reuse the existing encrypted-ZIP parser and the scheduled worker. Do not move Gmail, ZIP or service-role secrets into the browser. Preserve the 15-minute schedule and existing transaction deduplication.

Success: an authenticated owner clicks once, sees queued/processing/completed or failure, and the UI reloads only after the worker acknowledges the matching request. Concurrent clicks share an active request. A new mail must already have reached Gmail when the worker searches.

Deployment requires an additive migration, an authenticated Supabase broker function, and a server-only GitHub Actions-write token. Prepare and verify code before enabling production.
