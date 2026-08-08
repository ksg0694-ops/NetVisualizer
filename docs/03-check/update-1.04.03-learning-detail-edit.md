# Update 1.04.03 Learning Detail Edit Check

## Automated Validation

- `npm run check`: passed.
- JavaScript syntax, TypeScript, repository, domain, finance, UI, Supabase, market-price, and static-asset contracts: passed.
- UI contract now requires separate metadata/body actions and full-surface body focus support.

## Browser Validation

- Reproduced the original defect: clicking the editor's blank surface left focus on `BODY`.
- Verified the patch: the same click focuses a `contenteditable="true"` detail line.
- Typed into an empty note and confirmed the hidden note source updated.
- Clicked `본문 저장` and confirmed the detail-save notification.
- Typed into an existing two-line note and confirmed source synchronization.
- Restored the browser-test note content after validation.
- Reviewed the desktop three-column layout and detail editor visually.
