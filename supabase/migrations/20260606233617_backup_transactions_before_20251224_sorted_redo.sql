create table if not exists public.transactions_backup_20260607_20251224_sorted_redo as
select
  now() as backed_up_at,
  *
from public.transactions
where date >= date '2025-12-24'
  and date <= date '2026-06-07';;
