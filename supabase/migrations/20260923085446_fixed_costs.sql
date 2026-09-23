-- Version assigned by Supabase apply_migration on the linked project.
begin;
create table public.fixed_costs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    name text not null check (length(trim(name)) between 1 and 80),
    category text not null check (length(trim(category)) between 1 and 40),
    kind text not null check (kind in ('fixed','essential')),
    monthly_amount bigint not null check (monthly_amount between 0 and 1000000000),
    pay_day integer check (pay_day between 1 and 31),
    payment_method text not null default '' check (length(payment_method)<=80),
    note text not null default '' check (length(note)<=500),
    is_active boolean not null default true,
    version bigint not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index fixed_costs_owner on public.fixed_costs(user_id);
alter table public.fixed_costs enable row level security;
revoke all on public.fixed_costs from public, anon, authenticated;
grant select, insert, update on public.fixed_costs to authenticated;
create policy fixed_costs_owner on public.fixed_costs for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create function public.fixed_costs_version() returns trigger language plpgsql set search_path = public as $$
begin
    if new.user_id is distinct from old.user_id or new.id is distinct from old.id then
        raise exception 'Owner and identity cannot change';
    end if;
    new.version := old.version + 1;
    new.updated_at := clock_timestamp();
    new.created_at := old.created_at;
    return new;
end $$;
create trigger fixed_costs_version before update on public.fixed_costs
for each row execute function public.fixed_costs_version();
commit;
