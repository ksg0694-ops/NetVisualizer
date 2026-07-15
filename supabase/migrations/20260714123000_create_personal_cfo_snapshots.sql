-- User-owned Personal CFO graph snapshots.
--
-- The Personal CFO model is intentionally stored as JSONB first so the product
-- shape can keep changing without frequent table migrations. Once the model is
-- stable, frequently queried slices can be promoted into relational tables.

create extension if not exists pgcrypto;

create table if not exists public.personal_cfo_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  snapshot_key text not null default 'default',
  schema_version integer not null default 1,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_cfo_snapshots_key_check
    check (length(trim(snapshot_key)) > 0),
  constraint personal_cfo_snapshots_schema_version_check
    check (schema_version > 0),
  constraint personal_cfo_snapshots_snapshot_check
    check (jsonb_typeof(snapshot) = 'object'),
  constraint personal_cfo_snapshots_user_key_unique
    unique (user_id, snapshot_key)
);

create index if not exists idx_personal_cfo_snapshots_user_updated
  on public.personal_cfo_snapshots (user_id, updated_at desc);

create or replace function public.set_personal_cfo_snapshots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_personal_cfo_snapshots_updated_at on public.personal_cfo_snapshots;
create trigger trg_personal_cfo_snapshots_updated_at
before update on public.personal_cfo_snapshots
for each row execute function public.set_personal_cfo_snapshots_updated_at();

alter table public.personal_cfo_snapshots enable row level security;

drop policy if exists personal_cfo_snapshots_select_own on public.personal_cfo_snapshots;
create policy personal_cfo_snapshots_select_own
on public.personal_cfo_snapshots
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists personal_cfo_snapshots_insert_own on public.personal_cfo_snapshots;
create policy personal_cfo_snapshots_insert_own
on public.personal_cfo_snapshots
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists personal_cfo_snapshots_update_own on public.personal_cfo_snapshots;
create policy personal_cfo_snapshots_update_own
on public.personal_cfo_snapshots
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists personal_cfo_snapshots_delete_own on public.personal_cfo_snapshots;
create policy personal_cfo_snapshots_delete_own
on public.personal_cfo_snapshots
for delete
to authenticated
using (auth.uid() = user_id);

comment on table public.personal_cfo_snapshots is
  'User-owned JSONB snapshots for the Personal CFO graph and dashboard model.';

comment on column public.personal_cfo_snapshots.snapshot_key is
  'Logical snapshot slot. v0.1 uses default; future versions may support scenarios.';
