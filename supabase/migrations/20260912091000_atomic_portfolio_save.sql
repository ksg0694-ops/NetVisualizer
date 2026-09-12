begin;
create table if not exists public.portfolio_save_operations (
  user_id uuid not null references auth.users(id),
  operation_id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
alter table public.portfolio_save_operations enable row level security;
revoke all on public.portfolio_save_operations from anon;
grant select, insert on public.portfolio_save_operations to authenticated;
create policy portfolio_operations_own on public.portfolio_save_operations
  for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

create or replace function public.save_portfolio_atomic(mutation jsonb, operation_id uuid)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  owner uuid := auth.uid();
  item jsonb;
  row_id uuid;
  fields text;
  assignments text;
  previous jsonb;
  affected integer;
begin
  if owner is null then raise exception 'Authentication required'; end if;
  if operation_id is null or jsonb_typeof(mutation->'upserts') is distinct from 'array'
    or jsonb_typeof(mutation->'inserts') is distinct from 'array'
    or jsonb_typeof(mutation->'removedIds') is distinct from 'array' then
    raise exception 'Invalid portfolio mutation';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(owner::text, 0));
  select o.payload into previous from public.portfolio_save_operations o
    where o.user_id=owner and o.operation_id=save_portfolio_atomic.operation_id;
  if found then
    if previous <> mutation then raise exception 'Operation ID was reused'; end if;
    return;
  end if;
  for item in select value from jsonb_array_elements((mutation->'upserts') || (mutation->'inserts')) loop
    if jsonb_typeof(item) <> 'object' then raise exception 'Invalid position'; end if;
    if exists(select 1 from jsonb_object_keys(item) k where k not in (
      'id','group_name','name','currency','maturity','amount','shares','asset_type','instrument_type',
      'ticker','risk_bucket','classification_source','classification_updated_at','strategy_tag','avg_buy_price',
      'account_name','account_provider','account_type','asset_class','purpose_key','mapping_review_status',
      'mapping_source','mapping_updated_at','account_order')) then raise exception 'Unexpected position field'; end if;
    if item ? 'id' then
      row_id := (item->>'id')::uuid;
      perform 1 from public.portfolios p where p.id=row_id and p.user_id=owner for update;
      if not found then raise exception 'Position missing or belongs to another account'; end if;
      item := (item - 'id') || jsonb_build_object('updated_at',clock_timestamp());
      select string_agg(format('%I = r.%I',k,k), ',') into assignments from jsonb_object_keys(item) k;
      execute format('update public.portfolios p set %s from jsonb_populate_record(null::public.portfolios,$1) r where p.id=$2 and p.user_id=$3', assignments) using item,row_id,owner;
    else
      item := item || jsonb_build_object('id',gen_random_uuid(),'user_id',owner);
      select string_agg(format('%I',k), ',') into fields from jsonb_object_keys(item) k;
      execute format('insert into public.portfolios (%s) select %s from jsonb_populate_record(null::public.portfolios,$1)',fields,fields) using item;
    end if;
  end loop;
  for row_id in select value::uuid from jsonb_array_elements_text(mutation->'removedIds') loop
    delete from public.portfolios p where p.id=row_id and p.user_id=owner;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Removed position missing or belongs to another account'; end if;
  end loop;
  insert into public.portfolio_save_operations(user_id,operation_id,payload) values(owner,operation_id,mutation);
end;
$$;
revoke all on function public.save_portfolio_atomic(jsonb,uuid) from public, anon;
grant execute on function public.save_portfolio_atomic(jsonb,uuid) to authenticated;
commit;
