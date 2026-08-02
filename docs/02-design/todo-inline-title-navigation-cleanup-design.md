# Todo inline title and navigation cleanup design

## Interaction design

- The detail title is the single source of title-edit interaction. Its default state is a focusable heading; double-click, Enter, or Space changes it to an input.
- Enter or the check button saves the title. Escape, the cancel button, or closing the detail form discards an unsaved title edit.
- Step rows retain the existing edit, completion, and delete controls, with the drag affordance placed last to establish a consistent right-edge reorder target.
- Todo remains a tool, not a top-level Life area. Desktop and mobile navigation label the section as `도구`.
- NetVisualizer uses `href="./"`. Left click is intercepted for SPA navigation; middle click receives an explicit `auxclick` new-tab path.

## Data safety

- Inline title save uses the existing local and remote persistence path.
- Unsaved Step drafts remain form-local and disappear when the detail view closes.
- No schema or stored Todo data migration is required.
