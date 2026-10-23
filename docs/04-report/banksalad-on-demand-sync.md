# On-demand BankSalad sync — Report

The global sync button now requests a Gmail check, waits for the existing BankSalad importer to acknowledge the opaque request, and refreshes Supabase-backed views. Transaction normalization/deduplication and the 15-minute scheduled fallback are preserved. No-op, failure, wait timeout, account transition and partial/deferred screen reloads have explicit UI states.

## Released

PR #44 merged as `69e965914fe288033b46d6dfdc9214a4006122ca`. Main Quality gates and Pages deployment passed. Live revision `3a95acba5dac27ff` matches the tested source. The additive request schema and owner-authenticated Supabase broker are deployed. The user saved both required server secrets; existing auth-path checks verify configuration presence, rejection of anonymous requests and successful CORS preflight without exposing any secrets.

## Validation and remaining check

Full npm check passed (86 tests), Python suite passed (23 tests), and production rollback-only owner/RLS/service-only enqueue checks passed. No source transaction was changed during verification. Actual GitHub dispatch token validity, Gmail collection and the refreshed view still require one request from the owner's signed-in browser; local browser connection was unavailable. This limitation is separate from the completed production deployment.

No temporary privileged diagnostic route was deployed: automatic review rejected the proposed route and it was abandoned. Production checks used only the existing function and normal authentication paths.

Next: apply the PWA update, press sync while signed in, and inspect the matching request/import result. Setup and rollback remain documented in `supabase/functions/request-banksalad-sync/README.md`.
