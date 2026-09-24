# App update and compact settings

## Plan / design
- Dynamic project; bkit tools unavailable. Explicit manual app update beside data sync; details inside account/settings.
- Compare the loaded HTML build ID with a network-only published version manifest. Never say latest after a failed/offline check.
- Preserve waiting-worker safety by activating only on user confirmation, never automatically discard live edits. Other tabs receive an update notice, not an automatic reload.
- Service worker answers its actual build ID and accepts activation only for the verified target build. Handle install failures/timeouts and unsupported SW environments.
- Remove requested settings presentation (legacy recovery/conflict controls, explanatory box, welfare link), not stored backups or data safety logic. Compact login and sync metadata.

## Check gates
- Deterministic build/version generation; offline/version failure; matching/mismatched revisions; activation target validation; UI contracts and full project checks.
- Browser desktop/mobile settings and update flow; publish once and verify served revision.

## Check / report
- Local static server (not Vite) exercised real service-worker installation: loaded build `0dbe711925df8bbd` detected published `5ac808bc95e0ae94`, applied it and navigated to the new build; settings showed matching IDs. Console errors empty.
- Desktop and 390×844 mobile settings inspected. Removed controls absent; source sync collapsed/small; compact auth fields and buttons.
- Unit tests cover latest/mismatch/offline/malformed manifest, approved activation, cancellation, editor protection, worker-build disagreement, network-only manifest and target-gated activation.
- Recovery records and conflict prevention are untouched. Only the retired UI entry points are removed.
- Initial migration limitation: clients running code before this feature must close all existing app windows/tabs once so their waiting worker can activate. Subsequent releases use the new button without that workflow.
- Published version reports actual served content, not GitHub branch HEAD. If Pages deployment has not run, the app cannot install unserved code. Deployment verification compares HTML, version.json and offline manifest IDs.
