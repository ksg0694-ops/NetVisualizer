# Update 1.04.03 Editor Stability Design

## Architecture

- `learning-editor-surface` is the only contenteditable editing host.
- Rendered line spans inherit editability instead of becoming nested editing hosts.
- Pointer coordinates resolve to a DOM caret range, with last-line fallback for blank space.
- Selection helpers map between logical lines and text offsets.

## Keyboard Model

- Up/Down: previous or next logical line at the closest text offset.
- Left/Right: native within a line; custom crossing at line boundaries.
- Home/End: current logical line start/end, with Shift selection extension.
- Enter: split current line.
- Backspace/Delete: merge previous/next line at boundaries.
- Tab/Shift+Tab: add/remove exactly three indentation spaces.

## Checklist Model

Native checkbox inputs were replaced by explicit `role="checkbox"` buttons because form-control toggling was unreliable inside the shared editing host. State is synchronized through `data-learning-checked`, `aria-checked`, visual styling, and serialized Markdown.

## Release

- Learning Archive asset revision: `20260808-update-10403-5`
- PWA cache revision: `v165`
