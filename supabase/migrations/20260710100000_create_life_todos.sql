-- User-owned Life to-do items.
--
-- This table is safe to enable with RLS from day one because it has no legacy
-- rows. The frontend also works local-first when this migration has not yet
-- been applied to the live Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.life_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  note text,
  category text not null default 'today',
  due_date date not null default current_date,
  priority text not null default 'normal',
  is_done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint life_todos_title_check
    check (length(trim(title)) > 0),
  constraint life_todos_category_check
    check (category in ('today', 'home', 'health', 'admin', 'other')),
  constraint life_todos_priority_check
    check (priority in ('normal', 'high'))
);

create index if not exists idx_life_todos_user_open_due
  on public.life_todos (user_id, is_done, due_date, created_at desc);

create or replace function public.set_life_todos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_life_todos_updated_at on public.life_todos;
create trigger trg_life_todos_updated_at
before update on public.life_todos
for each row execute function public.set_life_todos_updated_at();

alter table public.life_todos enable row level security;

drop policy if exists life_todos_select_own on public.life_todos;
create policy life_todos_select_own
on public.life_todos
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists life_todos_insert_own on public.life_todos;
create policy life_todos_insert_own
on public.life_todos
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists life_todos_update_own on public.life_todos;
create policy life_todos_update_own
on public.life_todos
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists life_todos_delete_own on public.life_todos;
create policy life_todos_delete_own
on public.life_todos
for delete
to authenticated
using (auth.uid() = user_id);

comment on table public.life_todos is
  'User-owned lightweight Life to-do items for reminders and small daily checklists.';
