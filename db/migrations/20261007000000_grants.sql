-- Supabase granted table privileges to `authenticated` implicitly; plain Postgres needs them explicitly.
-- RLS policies still decide which rows are visible; group tables stay read-only (writes go through RPCs).

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.sprints, public.problems, public.saved_filters to authenticated;
grant select on public.groups, public.group_members, public.group_reactions, public.group_nudges to authenticated;
grant select on public.public_sheets, public.public_sheet_problems to authenticated;

revoke all on all tables in schema public from public;
revoke all on schema public from public;
grant usage on schema public to authenticated;
