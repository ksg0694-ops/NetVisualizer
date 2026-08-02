# Todo inline title and navigation cleanup check

## Automated checks

- `npm run check`: pass.
- UI contract covers the real home link, explicit middle-click handler, removed Life area, inline title editor, and rightmost Step drag handle.
- JavaScript, TypeScript, domain, repository, finance, Supabase, market price, and static-asset checks pass.

## Browser checks

- Desktop: Todo detail opens, title double-click enters edit mode, and Escape exits without modifying data.
- Desktop: a temporary unsaved Step renders with the delete control followed by the drag handle; closing the detail discards it.
- Mobile 390x844: the drawer exposes `재무` and `도구`, with no Life area; Todo detail remains usable as a full-screen form.
- Browser console: no errors.

## Note

The in-app test browser suppresses background tabs, so the new-tab outcome cannot be counted there. The implementation is guarded by both a native anchor and an explicit middle-button `auxclick` handler, and this contract is checked statically.
