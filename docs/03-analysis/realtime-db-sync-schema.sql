-- Realtime DB Sync schema draft.
-- Do not apply until RLS/Auth policy and import UI behavior are reviewed.
-- This schema intentionally does not store financial API secrets or raw account numbers.

create table if not exists public.account_sync_sources (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_account_key text,
  display_name text not null,
  institution_name text,
  sync_mode text not null default 'manual_import',
  status text not null default 'planned',
  scope text[] not null default '{}',
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_sync_sources_provider_check
    check (provider in ('manual_csv', 'open_banking', 'mydata', 'kis', 'other')),
  constraint account_sync_sources_sync_mode_check
    check (sync_mode in ('manual_import', 'api_readonly', 'scheduled_readonly')),
  constraint account_sync_sources_status_check
    check (status in ('planned', 'connected', 'paused', 'error', 'disabled'))
);

comment on table public.account_sync_sources is
  'Non-secret sync source metadata for NetVisualizer import/API synchronization.';
comment on column public.account_sync_sources.provider_account_key is
  'Opaque provider account key or hash. Never store raw account numbers here.';
comment on column public.account_sync_sources.scope is
  'Approved read scopes such as transactions, balances, holdings.';

create unique index if not exists idx_account_sync_sources_provider_key
  on public.account_sync_sources (provider, provider_account_key)
  where provider_account_key is not null;

create table if not exists public.account_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.account_sync_sources(id) on delete set null,
  run_type text not null default 'manual_import',
  status text not null default 'started',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_seen integer not null default 0,
  rows_staged integer not null default 0,
  rows_inserted integer not null default 0,
  rows_skipped integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  constraint account_sync_runs_run_type_check
    check (run_type in ('manual_import', 'api_dry_run', 'api_sync', 'scheduled_sync')),
  constraint account_sync_runs_status_check
    check (status in ('started', 'staged', 'completed', 'partial', 'failed', 'cancelled'))
);

comment on table public.account_sync_runs is
  'Audit trail for manual imports and future read-only provider sync runs.';

create index if not exists idx_account_sync_runs_source_started
  on public.account_sync_runs (source_id, started_at desc);

create table if not exists public.transaction_import_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.account_sync_runs(id) on delete cascade,
  source_id uuid references public.account_sync_sources(id) on delete set null,
  external_id text,
  dedupe_key text not null,
  tx_date date not null,
  tx_time time,
  tx_type text not null,
  category text,
  subcategory text,
  memo text,
  amount bigint not null,
  currency text not null default 'KRW',
  method text,
  raw_payload jsonb,
  status text not null default 'pending',
  matched_transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_import_candidates_tx_type_check
    check (tx_type in ('수입', '지출', '이체')),
  constraint transaction_import_candidates_status_check
    check (status in ('pending', 'imported', 'duplicate', 'skipped', 'error'))
);

comment on table public.transaction_import_candidates is
  'Staging rows for CSV/API transaction import preview before writing to public.transactions.';
comment on column public.transaction_import_candidates.dedupe_key is
  'Stable duplicate detection key derived from non-secret normalized transaction fields.';
comment on column public.transaction_import_candidates.raw_payload is
  'Provider/raw import payload. Must not include credentials, passwords, OTP, or raw account numbers.';

create unique index if not exists idx_transaction_import_candidates_source_external
  on public.transaction_import_candidates (source_id, external_id)
  where external_id is not null;

create index if not exists idx_transaction_import_candidates_dedupe
  on public.transaction_import_candidates (dedupe_key);

create index if not exists idx_transaction_import_candidates_run_status
  on public.transaction_import_candidates (run_id, status);
