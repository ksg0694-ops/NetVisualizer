-- Additive audit metadata only. Existing transaction records are untouched.
alter table public.banksalad_sync_runs
  add column if not exists import_start_date date,
  add column if not exists rows_eligible_incremental integer,
  add column if not exists rows_ignored_before_start integer;

comment on column public.banksalad_sync_runs.import_start_date is 'Inclusive import cutoff used by this run; null for older runs.';
comment on column public.banksalad_sync_runs.rows_eligible_incremental is 'Parsed rows on/after import cutoff; null when not measured.';
comment on column public.banksalad_sync_runs.rows_ignored_before_start is 'Parsed rows before import cutoff; null when not measured.';
notify pgrst, 'reload schema';
