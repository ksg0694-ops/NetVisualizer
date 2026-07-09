-- NetVisualizer health weight tracker sync model.
-- Matches the current public anon-client data posture. Revisit RLS policies in
-- a separate security-hardening pass before storing sensitive shared data.

create table if not exists public.health_weight_logs (
  log_date date primary key,
  weight_kg numeric(5,2) not null check (weight_kg > 0 and weight_kg < 500),
  note text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_health_weight_logs_updated_at
  on public.health_weight_logs (updated_at desc);

create or replace function public.set_health_weight_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_health_weight_logs_updated_at on public.health_weight_logs;
create trigger trg_health_weight_logs_updated_at
before update on public.health_weight_logs
for each row execute function public.set_health_weight_logs_updated_at();;
