begin;
create or replace function public.advance_note_version()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
revoke all on function public.advance_note_version() from public, anon;
create trigger zz_learning_note_version before update on public.learning_archive_notes
for each row execute function public.advance_note_version();
create trigger zz_todo_note_version before update on public.life_todos
for each row execute function public.advance_note_version();
commit;
