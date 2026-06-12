-- NetVisualizer weekly timetable sync model.
-- The current app uses the public anon Supabase client and existing project
-- tables are operated without RLS. Keep the same posture here and revisit RLS
-- in a dedicated security-hardening pass.

create extension if not exists pgcrypto;

create table if not exists public.weekly_timetable_weeks (
  week_key text primary key,
  company_work_template_v1 boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_timetable_events (
  id uuid primary key default gen_random_uuid(),
  week_key text not null references public.weekly_timetable_weeks(week_key) on delete cascade,
  event_key text not null,
  day_index smallint not null check (day_index between 0 and 6),
  start_minute integer not null check (start_minute >= 0 and start_minute <= 1440),
  end_minute integer not null check (end_minute >= 0 and end_minute <= 1440),
  title text not null,
  event_type text not null default 'focus',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_key, event_key),
  check (end_minute > start_minute)
);

create table if not exists public.weekly_timetable_templates (
  template_key text primary key default 'default',
  rows jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_weekly_timetable_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_weekly_timetable_weeks_updated_at on public.weekly_timetable_weeks;
create trigger trg_weekly_timetable_weeks_updated_at
before update on public.weekly_timetable_weeks
for each row execute function public.set_weekly_timetable_updated_at();

drop trigger if exists trg_weekly_timetable_events_updated_at on public.weekly_timetable_events;
create trigger trg_weekly_timetable_events_updated_at
before update on public.weekly_timetable_events
for each row execute function public.set_weekly_timetable_updated_at();

drop trigger if exists trg_weekly_timetable_templates_updated_at on public.weekly_timetable_templates;
create trigger trg_weekly_timetable_templates_updated_at
before update on public.weekly_timetable_templates
for each row execute function public.set_weekly_timetable_updated_at();
