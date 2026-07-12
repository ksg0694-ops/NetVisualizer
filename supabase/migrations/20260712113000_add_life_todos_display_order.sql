-- Store user-defined To do ordering for the draggable Life to-do board.

alter table public.life_todos
  add column if not exists display_order integer;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by is_done asc, due_date asc, created_at desc
    ) * 1000 as next_display_order
  from public.life_todos
  where display_order is null
)
update public.life_todos target
set display_order = ranked.next_display_order
from ranked
where target.id = ranked.id;

create index if not exists idx_life_todos_user_display_order
  on public.life_todos (user_id, display_order);

comment on column public.life_todos.display_order is
  'User-defined display order for draggable To do cards.';
