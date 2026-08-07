alter table public.learning_archive_notes
  add column if not exists field_order bigint not null default 0,
  add column if not exists item_order bigint not null default 0,
  add column if not exists chapter_order bigint not null default 0,
  add column if not exists display_order bigint not null default 0;

with ranked as (
  select
    id,
    dense_rank() over (partition by user_id order by field_name) * 1000 as field_order,
    dense_rank() over (partition by user_id, field_name order by item_name) * 1000 as item_order,
    dense_rank() over (partition by user_id, field_name, item_name order by chapter_name) * 1000 as chapter_order,
    row_number() over (
      partition by user_id, field_name, item_name, chapter_name
      order by is_pinned desc, updated_at desc, id
    ) * 1000 as display_order
  from public.learning_archive_notes
)
update public.learning_archive_notes as notes
set field_order = ranked.field_order,
    item_order = ranked.item_order,
    chapter_order = ranked.chapter_order,
    display_order = ranked.display_order
from ranked
where notes.id = ranked.id
  and (
    notes.field_order = 0
    or notes.item_order = 0
    or notes.chapter_order = 0
    or notes.display_order = 0
  );

create index if not exists idx_learning_archive_user_ordering
  on public.learning_archive_notes (
    user_id,
    field_order,
    item_order,
    chapter_order,
    display_order
  );

comment on column public.learning_archive_notes.field_order is
  'User-defined order for learning fields.';
comment on column public.learning_archive_notes.item_order is
  'User-defined order for learning items inside a field.';
comment on column public.learning_archive_notes.chapter_order is
  'User-defined order for chapters inside an item.';
comment on column public.learning_archive_notes.display_order is
  'User-defined order for notes inside a chapter.';
