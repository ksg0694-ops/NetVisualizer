# Update 1.04.03 Learning Archive Drag Performance Report

## Result

Learning Archive hierarchy movement now provides an immediate floating preview and dashed insertion position, while rendering and persistence work occur only when necessary.

## User-visible changes

- Faster long-press activation.
- Moving-row preview and insertion placeholder.
- Edge auto-scroll during long drags.
- Faster search, ordering, note switching, and typing response.

## Technical result

- Pointer work is frame-throttled.
- Search and order changes avoid full workbench reconstruction.
- Reordered records use a single batch upsert.
- Cache advanced to `v166` and the Learning Archive asset query to `update-10403-6`.
