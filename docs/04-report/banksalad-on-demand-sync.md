# On-demand BankSalad sync — Report

The global sync button now requests a Gmail check, waits for the existing BankSalad importer to acknowledge the opaque request, and refreshes Supabase-backed views. Transaction normalization/deduplication and the 15-minute scheduled fallback are preserved. No-op, failure, wait timeout, account transition and partial/deferred screen reloads have explicit UI states.

## Released

PR #44 merged as `69e965914fe288033b46d6dfdc9214a4006122ca`. Main Quality gates and Pages deployment passed. Live revision `3a95acba5dac27ff` matches the tested source. The additive request schema and owner-authenticated Supabase broker are deployed. The user saved both required server secrets; existing auth-path checks verify configuration presence, rejection of anonymous requests and successful CORS preflight without exposing any secrets.

## Validation — complete

Full npm check passed (86 tests), Python suite passed (23 tests), and production rollback-only owner/RLS/service-only enqueue checks passed. The owner then clicked the production sync button: request `c7490b40-1fb2-474a-bd20-88287b2e1c4f` completed in approximately 21 seconds, processing one email and inserting 80 transactions with zero failures. GitHub workflow_dispatch run `39973236993` succeeded. This verifies the normal owner auth, broker, server token, workflow dispatch, actual Gmail importer and acknowledgement. Direct visual inspection of the owner's screen was unavailable; the production user action and server results are verified.

No temporary privileged diagnostic route was deployed: automatic review rejected the proposed route and it was abandoned. Verification was completed through the normal production button.

Next use: send the BankSalad export to Gmail, wait for delivery, and press the sync button. Existing imports remain deduplicated. Renew the server Actions token before its configured expiry. Setup and rollback are documented in `supabase/functions/request-banksalad-sync/README.md`.
