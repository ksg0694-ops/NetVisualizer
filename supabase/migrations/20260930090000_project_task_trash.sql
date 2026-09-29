begin;
alter table public.personal_project_tasks add column deleted boolean not null default false;
alter table public.personal_project_tasks add constraint project_deleted_archived check(not deleted or archived);
commit;
