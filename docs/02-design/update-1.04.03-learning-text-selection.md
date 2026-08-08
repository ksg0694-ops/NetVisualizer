# Update 1.04.03 Learning Archive Text Selection Design

## Event design

- Record pointerdown coordinates only inside the note editor.
- Mark the interaction as a selection gesture after more than three pixels of movement.
- At pointerup, clone a non-collapsed range that belongs entirely to the editor.
- During the trailing click, keep the current range or restore the cloned range instead of applying click-to-caret correction.
- Expire the temporary cloned range after 500 ms.

## Compatibility

- Normal clicks do not create a preserved range and continue through exact caret placement.
- Keyboard selection does not depend on the pointer gesture and remains native.
- Checkbox and note-link controls retain their existing click behavior.
