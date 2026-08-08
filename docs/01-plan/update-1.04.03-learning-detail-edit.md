# Update 1.04.03 Learning Detail Edit Plan

## Problem

Learning Archive metadata (field, item, Chapter) remained editable, but the note detail body looked read-only because only the rendered line text accepted focus. Clicking the large empty editor area did not place a caret, and the visible `노트 수정` action opened metadata rather than the note body.

## Goal

- Keep field, item, Chapter, tag, and link editing unchanged.
- Make the entire detail surface lead into direct note-body editing.
- Keep the single WYSIWYG surface without adding a duplicate preview.
- Provide an explicit body save action while preserving autosave.
- Clarify the metadata action label.

## Acceptance Criteria

1. Clicking a populated detail line edits that line.
2. Clicking blank detail space focuses the final editable line.
3. An empty note always creates/focuses one editable line.
4. Detail changes synchronize to the stored note string and can be saved explicitly.
5. Metadata editing is labelled separately from detail-body editing.
