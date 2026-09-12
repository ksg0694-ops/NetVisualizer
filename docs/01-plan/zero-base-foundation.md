# Zero-base foundation — Plan

2026-09-12. User approved the audit recommendations and one final GitHub publication after local implementation/verification.

Order: private-data permissions and account isolation; atomic/conflict-aware persistence; reliable offline assets; mobile/auth/empty states and freshness; feature boundaries, CI and change documentation.

Preserve existing records, finance calculations, note format and functionality. No backend/framework replacement. Keep portfolio/notes/todos separate. Do not include private outputs in commits. Use targeted checks during development and the full required suite before publication.

Acceptance: anonymous personal reads blocked; own-user access preserved; account cache separation; stale edits cannot silently overwrite server records; portfolio updates atomic; offline asset coverage; explicit mobile login/empty states; IME guard; reproducible frontend checks and concise change map.

Security changes may be deployed to the existing linked Supabase project once metadata and transaction rollback tests establish compatibility. Record verification and any actual device/runtime limits in the final report.
