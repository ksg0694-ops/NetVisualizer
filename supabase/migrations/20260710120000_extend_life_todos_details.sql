-- Extend Life to-dos with product area grouping and nested step details.

alter table public.life_todos
  add column if not exists domain text not null default 'life',
  add column if not exists steps jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.life_todos'::regclass
      and conname = 'life_todos_domain_check'
  ) then
    alter table public.life_todos
      add constraint life_todos_domain_check
      check (domain in ('career', 'finance', 'life'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.life_todos'::regclass
      and conname = 'life_todos_steps_array_check'
  ) then
    alter table public.life_todos
      add constraint life_todos_steps_array_check
      check (jsonb_typeof(steps) = 'array');
  end if;
end $$;

create index if not exists idx_life_todos_user_domain_open_due
  on public.life_todos (user_id, domain, is_done, due_date, created_at desc);

comment on column public.life_todos.domain is
  'Top-level task area: career, finance, or life.';
comment on column public.life_todos.steps is
  'Nested checklist steps stored as an array of objects with id, title, and done fields.';
