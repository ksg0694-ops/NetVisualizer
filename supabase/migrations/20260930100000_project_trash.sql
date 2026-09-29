begin;
alter table public.personal_projects add column deleted boolean not null default false;
alter table public.personal_projects add constraint project_trash_archived check(not deleted or archived);
commit;
