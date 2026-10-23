# On-demand BankSalad sync — Report

Implemented an owner-authenticated Gmail collection request before explicit global refresh. The existing worker still handles ZIP decryption, normalization and deduplication, with a 15-minute scheduled fallback. New opaque request acknowledgements give the frontend a trustworthy completion/no-op/failure signal, and preserve database refresh after a mail error.

Verification: full npm check (86 tests), Python suite (23 tests), production rollback-only RPC/RLS checks and anonymous Edge Function rejection. Additive request schema and broker v1 are deployed. No source transaction was altered during deployment/verification.

Remaining rollout: configure `NETVISUALIZER_OWNER_USER_ID` and a repository-scoped Actions-write `BANKSALAD_GITHUB_ACTIONS_TOKEN` in Supabase function secrets; merge the workflow/worker, verify an owner-triggered request end to end, then release the frontend. Browser visual checks remain pending; no immediate production-ready claim is made before those steps.

See `supabase/functions/request-banksalad-sync/README.md` for setup, expected timings and rollback.

GitHub repository write access was restored after the user configured repository access. Remote feature branch creation succeeded; code publication and CI can now proceed. Server-only token/owner configuration and real owner end-to-end verification remain the rollout gate.
