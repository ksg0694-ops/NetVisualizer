-- Add restrictive ownership guards without changing any record or owner ID.
-- Existing permissive policies cannot bypass a restrictive guard.
begin;
do $$
declare t record;
begin
  for t in select c.table_name from information_schema.columns c
    join information_schema.tables b using (table_catalog,table_schema,table_name)
    where c.table_schema='public' and c.column_name='user_id' and b.table_type='BASE TABLE'
  loop
    execute format('alter table public.%I enable row level security', t.table_name);
    execute format('revoke all on table public.%I from public, anon', t.table_name);
    execute format('drop policy if exists private_owner_guard on public.%I', t.table_name);
    execute format('create policy private_owner_guard on public.%I as restrictive for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t.table_name);
    execute format('drop policy if exists private_owner_access on public.%I', t.table_name);
    execute format('create policy private_owner_access on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t.table_name);
    execute format('alter table public.%I alter column user_id set default auth.uid()', t.table_name);
  end loop;
end $$;
commit;
