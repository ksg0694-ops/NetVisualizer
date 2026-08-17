-- Add Work as the fourth fixed Todo domain.

alter table public.life_todos
  drop constraint if exists life_todos_domain_check;

alter table public.life_todos
  add constraint life_todos_domain_check
  check (domain in ('career', 'finance', 'life', 'work'));

comment on column public.life_todos.domain is
  'Top-level task area: career, finance, life, or work.';
