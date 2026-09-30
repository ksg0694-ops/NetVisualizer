# Project accordion design QA

Source: C:/Users/ksg06/.codex/generated_images/01a092fd-d241-7a60-9183-1a95b878af42/exec-3221919f-1bd5-45cc-9ade-c074c858eb95.png

Implementation: outputs/project-accordion-desktop.png
Viewport: 1488 x 1058, desktop, first project expanded, synthetic data.

## Iteration 1
- [P2] Category icons were black rather than category-colored. Fix: tint the vendored Tabler outline assets using category filters.
- [P2] Step and activity labels too small. Fix: 13px secondary labels / 15px current activity.
- Source and implementation were opened together in the same comparison input. Source 1488 x 1058; initial full-page implementation 1473 x 1078 (scrollbar and longer content). Normalize by comparing the accordion region at CSS scale; do not claim exact pixel identity.
- Intentional: existing app toolbar/filter retained; real registered items drive steps and checklist rather than fabricated template stages. Four instead of two example checklist rows means greater expanded height. Empty completed section omitted.

## Iteration 2 — 2026-10-01
- Source and outputs/project-accordion-desktop-final.png opened together after fixes. Icons now category-colored, active step connections colored, labels readable. No actionable P0/P1/P2 remaining.
- Final desktop capture: 1473 x 1084 full-page pixels at 1488 x 1058 CSS viewport, 1x capture, scrollbar excluded. Source 1488 x 1058. No image resampling; compare corresponding accordion regions, not page margins from fixture shell.
- Mobile: outputs/project-accordion-mobile.png, 390 x 844 CSS viewport; document scrollWidth 375 <= innerWidth 390. No outer horizontal overflow; all icons loaded. Native scrollbars account for screenshot width.
- Typography: existing Korean system font retained; 20px project title, 14px checklist, 13px secondary labels. Source has larger visual scale; implementation deliberately follows existing app density and user compact preference.
- Layout: one grouped white accordion, tinted inline checklist, category identity / journey / current activity columns. Mobile stacks these regions. Four actual example stages/checklist rows rather than the mock's two sample subtasks; empty completed group omitted.
- Colors: existing blue/purple/teal/orange/pink tokens retained. Check/current marker plus text labels avoid relying only on color.
- Assets: licensed Tabler outline icons, all loaded; no raster art needed. Added to offline cache list.
- Copy: removed dashboard KPI and upcoming schedule copy. No fabricated project stages or automatic date-based completion.
- Focused comparison: full-resolution source and implementation labels/icons were readable at supplied scale; no additional crop necessary.
- Interactions verified with isolated synthetic storage: expand; complete and reopen; edit dialog preserves calendar mode/dates; project-scoped add and save; all-done project moves to completed group. No actual user data mutated in QA.
- Console errors: none. Full accessibility certification and live authenticated account browser test are outside this check.

final result: passed

Follow-up polish (P3): source and implementation icon silhouettes differ slightly within the same outline style; inherited app toolbar remains above the tab row.
