begin;
alter table public.personal_project_tasks
 add column item_type text not null default 'task' check (item_type in ('task','activity','event')),
 add column calendar_mode text not null default 'full' check (calendar_mode in ('hidden','deadline','full'));
alter table public.personal_project_tasks add constraint project_event_single_day check (item_type <> 'event' or (milestone and start_date=end_date));
commit;
