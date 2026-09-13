-- Synthetic fixtures exist only inside this transaction; ALWAYS roll back.
begin;
do $$
declare owner_a uuid := gen_random_uuid(); owner_b uuid := gen_random_uuid();
begin
  perform set_config('netvisualizer.test_owner_a',owner_a::text,true);
  perform set_config('netvisualizer.test_owner_b',owner_b::text,true);
  perform set_config('netvisualizer.test_record',gen_random_uuid()::text,true);
  insert into auth.users(id) values(owner_a),(owner_b);
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
end $$;
set local role authenticated;
do $$
declare record_id uuid := current_setting('netvisualizer.test_record')::uuid;
  operation uuid := gen_random_uuid(); mutation jsonb; first_version timestamptz;
  affected integer;
begin
  insert into public.learning_archive_notes(id,field_name,item_name,chapter_name,title,content)
    values(record_id,'__verification__','test','test','synthetic','base');
  select updated_at into first_version from public.learning_archive_notes n where n.id=record_id;
  update public.learning_archive_notes n set content='device A' where n.id=record_id and updated_at=first_version;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'first edit failed'; end if;
  update public.learning_archive_notes n set content='device B' where n.id=record_id and updated_at=first_version;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'stale update was allowed'; end if;
  delete from public.learning_archive_notes n where n.id=record_id and updated_at=first_version;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'stale deletion was allowed'; end if;
  insert into public.portfolios(id,group_name,name,amount) values(record_id,'cash','__verification__',100);
  mutation := jsonb_build_object('upserts',jsonb_build_array(jsonb_build_object('id',record_id,'amount',200)),
    'inserts','[]'::jsonb,'removedIds','[]'::jsonb);
  perform public.save_portfolio_atomic(mutation,operation);
  perform public.save_portfolio_atomic(mutation,operation);
  if (select count(*) from public.portfolio_save_operations where operation_id=operation) <> 1 then
    raise exception 'idempotency failed'; end if;
  begin
    perform public.save_portfolio_atomic(jsonb_build_object(
      'upserts',jsonb_build_array(jsonb_build_object('id',record_id,'amount',999)),
      'inserts',jsonb_build_array(jsonb_build_object('name',null,'group_name','cash','amount',1)),
      'removedIds','[]'::jsonb),gen_random_uuid());
    raise exception 'invalid insert unexpectedly succeeded';
  exception when not_null_violation then null; end;
  if (select amount from public.portfolios p where p.id=record_id) <> 200 then raise exception 'atomic rollback failed'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('netvisualizer.test_owner_b'),true);
do $$
declare record_id uuid := current_setting('netvisualizer.test_record')::uuid; affected integer;
begin
  if exists(select 1 from public.learning_archive_notes where id=record_id) then raise exception 'foreign note visible'; end if;
  if exists(select 1 from public.portfolios where id=record_id) then raise exception 'foreign position visible'; end if;
  update public.learning_archive_notes set content='forbidden' where id=record_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'foreign note editable'; end if;
end $$;
set local role anon;
do $$
begin
  begin
    perform 1 from public.learning_archive_notes limit 1;
    raise exception 'anonymous read unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  if has_function_privilege('anon','public.save_portfolio_atomic(jsonb,uuid)','EXECUTE') then
    raise exception 'anonymous RPC execution allowed'; end if;
end $$;
reset role;
rollback;
