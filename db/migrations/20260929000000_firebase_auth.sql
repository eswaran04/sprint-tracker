-- Replaces Supabase's auth schema. Firebase Auth owns identities; Postgres keeps a profile row per uid.
-- Requests run as role `authenticated` with the verified Firebase uid in `app.uid` (see src/lib/db/session.ts),
-- so the RLS policies and security-definer functions in later migrations work unchanged.

create extension if not exists pgcrypto;

create schema if not exists app;

create table app.users (
  id text primary key,               -- Firebase uid
  email text not null default '',
  display_name text,
  avatar_url text,
  accent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The signed-in user for this transaction, or null. Set with set_config('app.uid', uid, true).
create function app.uid() returns text
language sql stable set search_path = '' as $$
  select nullif(current_setting('app.uid', true), '');
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  -- The app's login role must be granted app_server (never table ownership or BYPASSRLS):
  --   create role sprintboard_app login password '...'; grant app_server to sprintboard_app;
  if not exists (select 1 from pg_roles where rolname = 'app_server') then
    create role app_server nologin;
  end if;
end $$;

grant authenticated to app_server;

grant usage on schema app to authenticated, app_server;
grant execute on function app.uid() to public;
grant select, insert, update on app.users to app_server;
