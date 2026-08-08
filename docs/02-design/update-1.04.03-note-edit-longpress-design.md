# Update 1.04.03 Note Edit / Long-Press Ordering Design

## Note editing

The previously icon-only metadata control is replaced by a labeled `노트 수정` action. The edit panel keeps the existing autosave behavior but also provides `수정 저장` for explicit confirmation and immediate hierarchy rerendering.

## Long-press ordering

Dedicated grip icons are removed. Pointer or mouse press starts a 480 ms timer on the selected field, item, Chapter, or note row. Movement before activation cancels the timer so normal scrolling remains available. After activation, moving over a valid sibling shows the drop target and releasing persists the order.

Only nodes with the same level and parent can be reordered. `Alt+ArrowUp/Down` remains as the keyboard-accessible equivalent.
