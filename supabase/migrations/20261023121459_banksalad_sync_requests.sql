-- Opaque browser-to-worker acknowledgements. No financial records are modified.
begin;
create table public.banksalad_sync_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  messages_processed integer not null default 0,
  messages_failed integer not null default 0,
  rows_inserted integer not null default 0,
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index banksalad_sync_requests_owner_created on public.banksalad_sync_requests(user_id, created_at desc);
create unique index banksalad_sync_requests_one_active on public.banksalad_sync_requests(user_id)
  where status in ('queued','processing');
alter table public.banksalad_sync_requests enable row level security;
revoke all on public.banksalad_sync_requests from public, anon, authenticated;
grant select on public.banksalad_sync_requests to authenticated;
grant all on public.banksalad_sync_requests to service_role;
create policy banksalad_sync_requests_read_own on public.banksalad_sync_requests
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.enqueue_banksalad_sync(p_user_id uuid)
returns table(request_id uuid, request_status text, should_dispatch boolean)
language plpgsql security invoker set search_path = public as $$
declare active_request public.banksalad_sync_requests;
begin
  -- Serialize requests across devices and edge-function instances.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  update public.banksalad_sync_requests set status='failed', error_code='worker_timeout', finished_at=now()
    where user_id=p_user_id and status in ('queued','processing') and created_at < now()-interval '20 minutes';
  select * into active_request from public.banksalad_sync_requests
    where user_id=p_user_id and status in ('queued','processing');
  if found then
    return query select active_request.id, active_request.status, false;
    return;
  end if;
  if exists (select 1 from public.banksalad_sync_requests
    where user_id=p_user_id and created_at > now()-interval '30 seconds') then
    raise exception using errcode='P0001', message='sync_rate_limited';
  end if;
  insert into public.banksalad_sync_requests(user_id) values(p_user_id) returning * into active_request;
  return query select active_request.id, active_request.status, true;
end $$;
revoke all on function public.enqueue_banksalad_sync(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_banksalad_sync(uuid) to service_role;
commit;
