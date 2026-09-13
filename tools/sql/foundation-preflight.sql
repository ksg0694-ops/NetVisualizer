select jsonb_build_object(
 'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname='public'),
 'columns',(select jsonb_agg(to_jsonb(c)) from (select table_name,column_name,data_type,column_default,is_nullable from information_schema.columns where table_schema='public' and table_name in ('portfolios','life_todos','learning_archive_notes') order by table_name,ordinal_position) c),
 'triggers',(select jsonb_agg(jsonb_build_object('table',c.relname,'definition',pg_get_triggerdef(t.oid))) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal),
 'definer_functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid),'acl',p.proacl)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef),
 'migrations',(select jsonb_agg(to_jsonb(m)) from (select version,name from supabase_migrations.schema_migrations order by version desc limit 8) m)
) as metadata;
