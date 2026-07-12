-- Retired Life tools: Weekly Timetable and Vacation Plan are no longer part of
-- the active app surface or server sync flows.

drop table if exists public.weekly_timetable_events cascade;
drop table if exists public.weekly_timetable_templates cascade;
drop table if exists public.weekly_timetable_weeks cascade;
drop table if exists public.vacation_plans cascade;

drop function if exists public.set_weekly_timetable_updated_at() cascade;
drop function if exists public.set_vacation_plans_updated_at() cascade;
