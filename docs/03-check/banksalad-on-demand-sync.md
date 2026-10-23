# On-demand BankSalad sync — Check

- Full `npm run check` passed: 86 Node regression tests, generated assets, JS/TS, finance/domain/runtime/UI/Supabase/performance/static checks.
- Python unittest suite passed: 23 parser/data-quality/request-worker tests.
- New coverage exercises queued→processing→completed, duplicate clicks, empty imports, failure/timeout, account transition, deferred/partial/failed screen refresh, owner authorization, dispatch failure, SQL grants/RLS and stale-request recovery.
- The additive migration was applied to the existing net-visualizer-db project as `20261023121459_banksalad_sync_requests`.
- Production SQL verification used a rolled-back transaction: service-only enqueue, active-request reuse, authenticated owner read and absence of browser write/RPC privileges all passed. No test request or transaction remains.
- `request-banksalad-sync` v1 deployed with gateway JWT verification enabled; anonymous HTTP request rejected with UNAUTHORIZED_NO_AUTH_HEADER. Security advisors returned no findings for the new table/RPC; unrelated pre-existing advisories were not changed.
- Real browser QA and an owner end-to-end Gmail dispatch are pending. Local browser connection timed out; no visual verification is claimed.
- Production frontend stays on its existing branch until server-only owner/token configuration is complete and a real request can be verified. GitHub scoped Actions token creation/Edge Function secret configuration is not exposed by the connected APIs.

GitHub repository write access was restored after the user configured repository access. Remote feature branch creation succeeded; code publication and CI can now proceed. Server-only token/owner configuration and real owner end-to-end verification remain the rollout gate.

## Production release

- User confirmed both required server secrets saved. Standard public-key POST reaches handler authentication (`401 unauthorized`), proving configuration-presence checks passed without exposing any secret. Anonymous POST is rejected by the gateway; browser OPTIONS preflight succeeds with CORS headers. Token validity and owner-session import still need a real owner request.
- PR #44 merged as `69e965914fe288033b46d6dfdc9214a4006122ca`; main Quality gates and GitHub Pages deployment passed. Live `version.json` reports expected revision `3a95acba5dac27ff`.
- A proposed temporary capability-gated diagnostic route was rejected by automatic review and was never deployed. It was abandoned; subsequent checks used only the existing function and ordinary authentication paths.
- Final remaining check: owner updates the PWA and presses sync; verify its request and Gmail import result. Local browser connection timed out, so authenticated end-to-end success is not claimed.
