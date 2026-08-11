# Advanced Independent Note Suite — Design

## Shared editor runtime

`NoteEditor` owns presentation-only behavior: inline sizes, paragraph prefix parsing, templates, safe exports, and line diffs. It does not read or write Todo or Learning Archive stores.

## Independent feature stores

Todo and Learning Archive each keep distinct keys for records, versions, trash, dirty IDs, and pending remote deletions. Search, recent navigation, templates, and export entry points are rendered inside the owning feature.

## Reconciliation rule

Remote data is authoritative except for IDs explicitly marked dirty on this device. Pending deletions are excluded from the merged view and retried when connectivity returns. Successful uploads and deletions clear their queue entries.

## Security

Word and print exports remove executable or embedded elements and event attributes before writing note HTML into an export document.
