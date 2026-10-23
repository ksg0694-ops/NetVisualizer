# On-demand BankSalad sync — Design

1. Frontend invokes `request-banksalad-sync` with the user's Supabase session.
2. Broker validates the user against `NETVISUALIZER_OWNER_USER_ID`, atomically creates/reuses a request via service-only RPC, and dispatches the fixed main-branch mail workflow with an opaque request UUID.
3. Existing workflow concurrency serializes scheduled and requested imports. Worker claims that UUID for the configured owner, reuses the existing Gmail importer, and records terminal status and counts, including successful no-ops.
4. Frontend polls only its RLS-protected request row. It refreshes all relevant data after terminal acknowledgement, and warns on failure, offline interruption or wait timeout. An in-document/account guard prevents cross-account results.

Requests expose counts/status only; no credentials or email content. Clients cannot create/update request rows or invoke the service-only RPC. Active requests coalesce; abandoned requests expire after 20 minutes, with a 30-second dispatch rate limit. The browser waits up to three minutes; a timed-out request continues and is reused on the next click. Only explicit button clicks initiate Gmail collection; automatic data refreshes stay read-only.

Rollout: merge workflow/backend first; apply migration, set the broker's owner and repository-scoped Actions-write secret, deploy function, verify owner/anonymous paths, then enable the tested frontend. Until backend is configured the new button reports the Gmail failure and still refreshes database data without claiming a complete sync.
