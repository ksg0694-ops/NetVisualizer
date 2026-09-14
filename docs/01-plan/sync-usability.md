# Sync usability — Plan

User confirmed the foundation release works (2026-09-14). Existing cloud saves and refresh/resume synchronization remain intact; do not present them as new features.

Scope: in-app conflict comparison and safe adoption of the server copy while retaining a local recovery copy; prevent background refresh from replacing active drafts; share paging code so Todo/Learning do not lose records beyond the server page limit. Keep push subscriptions and automatic merge out of this iteration.

Acceptance: no server writes during server-copy adoption; stale dialog or newly edited local copy cannot be silently accepted; queued obsolete saves cannot resurrect resolved content; backup is preserved; all pages must succeed before replacing local records; current checks and branch CI pass before main publication.
