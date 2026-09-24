begin;
-- Append-only private source snapshots; existing portfolio and long-term history are untouched.
create table public.personal_balance_sheet_inputs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 as_of date not null,
 source_url text not null default '' check (length(source_url)<1000),
 positions jsonb not null check (jsonb_typeof(positions)='array'),
 created_at timestamptz not null default now()
);
create index personal_bs_inputs_owner on public.personal_balance_sheet_inputs(user_id,as_of,created_at);
create table public.personal_balance_sheet_flows (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 basis text not null default 'calendar' check (basis='calendar'),
 scope text not null default 'investment+pension' check (scope='investment+pension'),
 opening_net_worth bigint, closing_net_worth bigint,
 opening_investment bigint, closing_investment bigint,
 net_contributions bigint, net_saving bigint, other_change bigint,
 reviewed boolean not null default false,
 evidence jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence)='object'),
 updated_at timestamptz not null default now(),
 primary key(user_id,month),
 constraint bs_review_requires_values check(not reviewed or
 (opening_net_worth is not null and closing_net_worth is not null and
 opening_investment is not null and closing_investment is not null and
 net_contributions is not null and net_saving is not null and other_change is not null and evidence <> '{}'::jsonb))
);
alter table public.personal_balance_sheet_inputs enable row level security;
alter table public.personal_balance_sheet_flows enable row level security;
revoke all on public.personal_balance_sheet_inputs, public.personal_balance_sheet_flows from public, anon, authenticated;
grant select,insert on public.personal_balance_sheet_inputs to authenticated;
grant select,insert,update on public.personal_balance_sheet_flows to authenticated;
create policy bs_inputs_owner on public.personal_balance_sheet_inputs for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy bs_flows_owner on public.personal_balance_sheet_flows for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
comment on column public.personal_balance_sheet_flows.net_saving is 'Calendar-month external income minus consumption, interest and taxes. Exclude own-account transfers, asset purchases and loan principal. Investment distributions must be counted once under a consistent scope.';
comment on column public.personal_balance_sheet_flows.net_contributions is 'Net cash/assets transferred into investment+pension scope (including transfers in kind), not purchases within those accounts.';
commit;
