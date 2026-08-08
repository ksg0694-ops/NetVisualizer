# Update 1.04.03 Learning Archive Drag Performance Design

## Interaction design

- Keep handle-free long press, but reduce the desktop delay from 480 ms to 180 ms.
- Retain a slightly longer 260 ms touch delay so vertical scrolling remains intentional.
- Clone the pressed hierarchy row as a floating ghost.
- Move a dashed placeholder before or after the nearest valid sibling.
- Auto-scroll the hierarchy pane near its top and bottom edges.

## Performance design

- Coalesce pointer movement with `requestAnimationFrame`.
- Track only the previous and current drop target instead of clearing every row per pointer event.
- Replace full `render()` calls during search and reorder with `renderTreeOnly()`.
- Coalesce editor input serialization to one animation frame.
- Switch notes without waiting for the remote save response.
- Batch hierarchy-order upserts into one Supabase request.

## Data safety

- Local order is updated immediately on drop.
- Server persistence starts only after drop, never during pointer movement.
- Existing same-parent restrictions and Alt+Arrow keyboard ordering remain intact.
