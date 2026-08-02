-- BankSalad Gmail read-only import provenance, idempotency, and owner-only access.

alter table public.transactions
  add column if not exists source text not null default 'manual',
  add column if not exists source_message_id text,
  add column if not exists dedupe_key text;

create unique index if not exists transactions_user_source_dedupe_key
  on public.transactions (user_id, source, dedupe_key);

create index if not exists transactions_user_source_message_id
  on public.transactions (user_id, source_message_id)
  where source_message_id is not null;

comment on column public.transactions.source is
  'Transaction origin. banksalad_gmail identifies Gmail export imports.';
comment on column public.transactions.source_message_id is
  'Opaque Gmail message id used for import provenance; no email body is stored.';
comment on column public.transactions.dedupe_key is
  'SHA-256 of normalized non-secret transaction fields for idempotent imports.';

create table if not exists public.banksalad_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_message_id text not null,
  attachment_name_hash text,
  status text not null default 'processing',
  sheet_name text,
  rows_seen integer not null default 0,
  rows_valid integer not null default 0,
  rows_inserted integer not null default 0,
  rows_duplicate_file integer not null default 0,
  rows_duplicate_existing integer not null default 0,
  rows_invalid integer not null default 0,
  error_code text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint banksalad_sync_runs_user_message_key unique (user_id, gmail_message_id),
  constraint banksalad_sync_runs_status_check
    check (status in ('processing', 'completed', 'failed'))
);

create index if not exists banksalad_sync_runs_user_started_at
  on public.banksalad_sync_runs (user_id, started_at desc);

drop trigger if exists trg_banksalad_sync_runs_updated_at on public.banksalad_sync_runs;
create trigger trg_banksalad_sync_runs_updated_at
before update on public.banksalad_sync_runs
for each row execute function public.set_netvisualizer_updated_at();

alter table public.banksalad_sync_runs enable row level security;

drop policy if exists banksalad_sync_runs_select_own on public.banksalad_sync_runs;
create policy banksalad_sync_runs_select_own
on public.banksalad_sync_runs for select to authenticated
using (auth.uid() = user_id);

revoke all on public.banksalad_sync_runs from anon;
grant select on public.banksalad_sync_runs to authenticated;
grant all on public.banksalad_sync_runs to service_role;

comment on table public.banksalad_sync_runs is
  'Non-sensitive audit counts for Gmail BankSalad imports. Raw mail and workbook data are never stored.';

-- Restore the Auth boundary before adding broader Gmail-derived finance data.
-- Public-server policies were a temporary compatibility bridge for GitHub Pages.
do $$
declare
  v_table_name text;
  policy_record record;
  personal_tables text[] := array[
    'app_user_profiles',
    'transactions',
    'assets',
    'portfolios',
    'cards',
    'insurances',
    'health_weight_logs',
    'quant_rebalance_signals',
    'life_todos',
    'quant_strategy_rule_overrides',
    'portfolio_market_price_overrides',
    'portfolio_market_price_override_history',
    'personal_cfo_snapshots',
    'finance_month_closes',
    'portfolio_monthly_snapshots',
    'portfolio_strategy_definitions',
    'short_term_roadmap_goals',
    'weekly_timetable_sync',
    'vacation_plan_sync'
  ];
begin
  foreach v_table_name in array personal_tables
  loop
    if to_regclass(format('public.%I', v_table_name)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', v_table_name);

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = v_table_name
        and column_name = 'user_id'
    ) then
      continue;
    end if;

    execute format(
      'alter table public.%I alter column user_id set default auth.uid()',
      v_table_name
    );

    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = v_table_name
        and (
          policyname like '%public_server%'
          or policyname like '%public_select%'
        )
    loop
      execute format('drop policy if exists %I on public.%I', policy_record.policyname, v_table_name);
    end loop;

    execute format('drop policy if exists %I on public.%I', v_table_name || '_authenticated_select_own', v_table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
      v_table_name || '_authenticated_select_own',
      v_table_name
    );
    execute format('drop policy if exists %I on public.%I', v_table_name || '_authenticated_insert_own', v_table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
      v_table_name || '_authenticated_insert_own',
      v_table_name
    );
    execute format('drop policy if exists %I on public.%I', v_table_name || '_authenticated_update_own', v_table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      v_table_name || '_authenticated_update_own',
      v_table_name
    );
    execute format('drop policy if exists %I on public.%I', v_table_name || '_authenticated_delete_own', v_table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)',
      v_table_name || '_authenticated_delete_own',
      v_table_name
    );
  end loop;
end;
$$;
