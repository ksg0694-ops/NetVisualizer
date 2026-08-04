-- NetVisualizer 1.04.02: grouped Todo monitoring, completion-report library,
-- Pocket Notebook Life notes, and the four-level Learning Archive.

alter table public.life_todos
  add column if not exists group_name text not null default '기본 그룹',
  add column if not exists is_paused boolean not null default false,
  add column if not exists completion_report jsonb not null default '{}'::jsonb,
  add column if not exists report_files jsonb not null default '[]'::jsonb;

alter table public.life_todos
  drop constraint if exists life_todos_completion_report_object_check,
  add constraint life_todos_completion_report_object_check
    check (jsonb_typeof(completion_report) = 'object'),
  drop constraint if exists life_todos_report_files_array_check,
  add constraint life_todos_report_files_array_check
    check (jsonb_typeof(report_files) = 'array'),
  drop constraint if exists life_todos_group_name_check,
  add constraint life_todos_group_name_check
    check (length(trim(group_name)) between 1 and 80);

create index if not exists idx_life_todos_user_group_state
  on public.life_todos (user_id, group_name, is_paused, is_done, display_order);

create table if not exists public.life_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade
    default coalesce(auth.uid(), public.netvisualizer_public_owner_id()),
  title text not null,
  content text,
  note_type text not null default 'memo',
  status text not null default 'active',
  checklist jsonb not null default '[]'::jsonb,
  color text not null default 'violet',
  is_pinned boolean not null default false,
  display_order bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint life_notes_title_check check (length(trim(title)) between 1 and 160),
  constraint life_notes_type_check check (note_type in ('memo', 'check')),
  constraint life_notes_status_check check (status in ('active', 'paused', 'archived')),
  constraint life_notes_checklist_array_check check (jsonb_typeof(checklist) = 'array'),
  constraint life_notes_color_check check (color in ('violet', 'sky', 'amber', 'slate'))
);

create index if not exists idx_life_notes_user_state_updated
  on public.life_notes (user_id, status, note_type, is_pinned desc, updated_at desc);

drop trigger if exists trg_life_notes_updated_at on public.life_notes;
create trigger trg_life_notes_updated_at
before update on public.life_notes
for each row execute function public.set_life_todos_updated_at();

alter table public.life_notes enable row level security;

drop policy if exists life_notes_public_server_select on public.life_notes;
create policy life_notes_public_server_select on public.life_notes
for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists life_notes_public_server_insert on public.life_notes;
create policy life_notes_public_server_insert on public.life_notes
for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists life_notes_public_server_update on public.life_notes;
create policy life_notes_public_server_update on public.life_notes
for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists life_notes_public_server_delete on public.life_notes;
create policy life_notes_public_server_delete on public.life_notes
for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

create table if not exists public.learning_archive_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade
    default coalesce(auth.uid(), public.netvisualizer_public_owner_id()),
  field_name text not null,
  item_name text not null,
  chapter_name text not null,
  title text not null,
  content text,
  source_links jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_archive_field_check check (length(trim(field_name)) between 1 and 120),
  constraint learning_archive_item_check check (length(trim(item_name)) between 1 and 160),
  constraint learning_archive_chapter_check check (length(trim(chapter_name)) between 1 and 160),
  constraint learning_archive_title_check check (length(trim(title)) between 1 and 200),
  constraint learning_archive_source_links_array_check check (jsonb_typeof(source_links) = 'array'),
  constraint learning_archive_tags_array_check check (jsonb_typeof(tags) = 'array')
);

create index if not exists idx_learning_archive_user_hierarchy
  on public.learning_archive_notes (user_id, field_name, item_name, chapter_name, updated_at desc);

drop trigger if exists trg_learning_archive_updated_at on public.learning_archive_notes;
create trigger trg_learning_archive_updated_at
before update on public.learning_archive_notes
for each row execute function public.set_life_todos_updated_at();

alter table public.learning_archive_notes enable row level security;

drop policy if exists learning_archive_public_server_select on public.learning_archive_notes;
create policy learning_archive_public_server_select on public.learning_archive_notes
for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists learning_archive_public_server_insert on public.learning_archive_notes;
create policy learning_archive_public_server_insert on public.learning_archive_notes
for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists learning_archive_public_server_update on public.learning_archive_notes;
create policy learning_archive_public_server_update on public.learning_archive_notes
for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists learning_archive_public_server_delete on public.learning_archive_notes;
create policy learning_archive_public_server_delete on public.learning_archive_notes
for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'todo-reports',
  'todo-reports',
  false,
  26214400,
  array[
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/pdf'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists todo_reports_select_own on storage.objects;
create policy todo_reports_select_own on storage.objects
for select to authenticated
using (bucket_id = 'todo-reports' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists todo_reports_insert_own on storage.objects;
create policy todo_reports_insert_own on storage.objects
for insert to authenticated
with check (bucket_id = 'todo-reports' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists todo_reports_delete_own on storage.objects;
create policy todo_reports_delete_own on storage.objects
for delete to authenticated
using (bucket_id = 'todo-reports' and (storage.foldername(name))[1] = auth.uid()::text);

comment on table public.life_notes is 'Lightweight Pocket Notebook cards for personal Life notes and checklists.';
comment on table public.learning_archive_notes is 'Four-level learning archive: field, item, chapter, and detailed note.';
