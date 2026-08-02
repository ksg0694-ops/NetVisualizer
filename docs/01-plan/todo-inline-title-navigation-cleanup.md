# Todo inline title and navigation cleanup

## Goal

- Edit a Todo title from the detail header instead of a separate form field.
- Make Step ordering controls easier to scan by placing the drag handle at the right edge.
- Remove the top-level Life area while keeping Todo available under Tools.
- Preserve SPA home navigation on left click and open NetVisualizer in a new tab on middle click.

## Acceptance criteria

- Double-clicking or pressing Enter on a Todo detail title opens an inline editor with save and cancel controls.
- Saving the rest of the detail form does not require title edit mode to be open.
- Every Step row ends with its drag handle.
- Neither desktop nor mobile top-level navigation exposes a Life area.
- NetVisualizer is a real link and handles middle-click as a new-tab action.
- Automated checks and desktop/mobile browser checks pass.
