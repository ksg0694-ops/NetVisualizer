begin;
create table public.personal_projects (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100),
 category text not null check(category in ('커리어','자격증','자산','여행','개인')),
 note text not null default '' check(length(note)<=2000),
 archived boolean not null default false,
 version bigint not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.personal_project_tasks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 project_id uuid not null,
 title text not null check(length(trim(title)) between 1 and 160),
 start_date date not null check(start_date between date '1900-01-01' and date '2200-12-31'),
 end_date date not null check(end_date between date '1900-01-01' and date '2200-12-31'),
 status text not null default 'waiting' check(status in ('waiting','doing','done')),
 progress integer not null default 0 check(progress between 0 and 100),
 priority text not null default 'normal' check(priority in ('high','normal','low')),
 milestone boolean not null default false,
 note text not null default '' check(length(note)<=2000),
 archived boolean not null default false,
 version bigint not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(user_id,project_id) references public.personal_projects(user_id,id),
 check(end_date>=start_date), check(not milestone or start_date=end_date),
 check((status='waiting' and progress=0) or (status='done' and progress=100) or (status='doing' and progress<100))
);
create index personal_projects_owner on public.personal_projects(user_id);
create index personal_project_tasks_owner_date on public.personal_project_tasks(user_id,end_date);
create index personal_project_tasks_project on public.personal_project_tasks(user_id,project_id);
create function public.project_management_version() returns trigger language plpgsql set search_path=public as $$
begin
 if new.user_id is distinct from old.user_id or new.id is distinct from old.id then raise exception 'Owner and identity cannot change'; end if;
 new.version := old.version+1; new.created_at := old.created_at; new.updated_at := clock_timestamp(); return new;
end $$;
alter table public.personal_projects enable row level security;
alter table public.personal_project_tasks enable row level security;
revoke all on public.personal_projects,public.personal_project_tasks from public,anon,authenticated;
grant select,insert,update on public.personal_projects,public.personal_project_tasks to authenticated;
create policy personal_projects_owner on public.personal_projects for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy personal_project_tasks_owner on public.personal_project_tasks for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create trigger personal_projects_version before update on public.personal_projects for each row execute function public.project_management_version();
create trigger personal_project_tasks_version before update on public.personal_project_tasks for each row execute function public.project_management_version();
commit;
