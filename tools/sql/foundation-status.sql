select jsonb_build_object(
 'private_tables',(select count(*) from information_schema.columns c where c.table_schema='public' and c.column_name='user_id'),
 'anon_readable_private_tables',(select count(*) from information_schema.columns c where c.table_schema='public' and c.column_name='user_id' and has_table_privilege('anon',format('%I.%I',c.table_schema,c.table_name),'SELECT')),
 'owner_guards',(select count(*) from pg_policies where schemaname='public' and policyname='private_owner_guard' and permissive='RESTRICTIVE'),
 'banksalad_write_policies',(select count(*) from pg_policies where schemaname='public' and tablename='banksalad_sync_runs' and permissive='PERMISSIVE' and cmd in ('ALL','INSERT','UPDATE','DELETE')),
 'note_version_triggers',(select count(*) from pg_trigger where tgname in ('zz_learning_note_version','zz_todo_note_version')),
 'rpc_available',to_regprocedure('public.save_portfolio_atomic(jsonb,uuid)') is not null,
 'migrations',(select jsonb_agg(to_jsonb(m)) from (select version,name from supabase_migrations.schema_migrations where name like '20260912%') m)
) as verification;
