-- Local dev only: the login role the app uses (DATABASE_URL). Migrations run as `postgres`.
-- It owns nothing and has no BYPASSRLS, so RLS applies once it switches to `authenticated`.
create role app_server nologin;
create role sprintboard_app login password 'sprintboard_app';
grant app_server to sprintboard_app;
