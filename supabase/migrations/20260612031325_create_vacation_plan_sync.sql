-- NetVisualizer vacation plan sync model.
-- Matches the current public anon-client data posture. Revisit RLS policies in
-- a separate security-hardening pass before sharing the app beyond personal use.

create extension if not exists pgcrypto;

create table if not exists public.vacation_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  destination text,
  start_date date,
  end_date date,
  budget_krw numeric(14, 0) not null default 0,
  status text not null default 'idea',
  priority text not null default 'medium',
  transport text,
  lodging text,
  note text,
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_vacation_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_vacation_plans_updated_at on public.vacation_plans;
create trigger trg_vacation_plans_updated_at
before update on public.vacation_plans
for each row execute function public.set_vacation_plans_updated_at();
