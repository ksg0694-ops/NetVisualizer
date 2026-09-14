# Sync usability — Report (2026-09-14)

Deployed implementation: 1043e60 on main. Existing saves and resume/reconnect synchronization were retained, not rebuilt or relabeled as new realtime functionality.

Changes: settings conflict comparison, explicit server-copy adoption with preserved local recovery history, stale-dialog and obsolete queued-save rejection, shared paginated Todo/Learning reads, and deferred refresh while editing. No database migration or production test-record write was required.

Validation: full npm run check, 10 foundation tests, synthetic browser conflict flow, branch/main CI, GitHub Pages and deployment hash df8f1f9d7567a601. The deployed settings menu is present. Existing PWA tabs may need closing/reopening to activate the waiting update without interrupting drafts.

Limits: server-copy adoption only; local copies remain exportable, but automatic text merge and direct local overwrite are not implemented. Browser conflict testing used synthetic data, not the user's live notes. Physical mobile-device tests and a full legacy module rewrite were not part of this iteration.
