begin;
alter table public.cards
 add column card_type text not null default 'unspecified' check(card_type in ('unspecified','credit','debit')),
 add column card_status text not null default 'active' check(card_status in ('active','closed')),
 add column pay_day integer check(pay_day between 1 and 31),
 add column issued_on date,
 add column benefits text not null default '' check(length(benefits)<=2000),
 add column note text not null default '' check(length(note)<=2000),
 add column deleted boolean not null default false,
 add column version bigint not null default 1,
 add column create_key uuid unique;
create function public.card_management_version() returns trigger language plpgsql set search_path=public as $$
begin
 if new.user_id is distinct from old.user_id or new.id is distinct from old.id then raise exception 'Owner and identity cannot change'; end if;
 new.version:=old.version+1;new.created_at:=old.created_at;return new;
end $$;
create trigger card_management_version before update on public.cards for each row execute function public.card_management_version();
commit;
