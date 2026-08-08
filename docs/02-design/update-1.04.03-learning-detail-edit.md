# Update 1.04.03 Learning Detail Edit Design

## Interaction Design

- Add a compact `상세내역` header above the existing editor.
- Show `본문 저장` as an explicit confirmation action; autosave remains active.
- Treat clicks on line whitespace or the editor's blank area as intent to edit.
- Focus the clicked line when available, otherwise the last line.
- For an empty editor, render a blank editable line before focusing.
- Rename the metadata action to `분류 수정` and its confirmation to `분류 저장`.

## Technical Design

- `focusLearningDetailEditor(target)` owns editor focus recovery.
- The editor shell has a textbox label and a keyboard focus target.
- Existing contenteditable line serialization remains the source of truth.
- Both autosave and explicit body save use the existing `saveActive()` persistence path.
- PWA cache revision advances to `v164`.
