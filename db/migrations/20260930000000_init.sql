-- Sprint Viewer schema. Every row is owned by one user; RLS restricts access to the owner.

create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default app.uid() references app.users (id) on delete cascade,
  title text not null,
  start_date date,
  skip_weekends boolean not null default false,
  rest_days date[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints (id) on delete cascade,
  user_id text not null default app.uid() references app.users (id) on delete cascade,
  position int not null,
  name text not null,
  url text not null default '',
  subject text not null default '',
  difficulty text check (difficulty in ('Basic', 'Core', 'Pro')),
  companies text[] not null default '{}',
  topics text[] not null default '{}',
  sprint_no int not null default 1,
  day_no int not null default 1,
  original_day_no int not null default 1,
  done_at timestamptz,
  starred boolean not null default false,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default app.uid() references app.users (id) on delete cascade,
  name text not null,
  query jsonb not null,
  created_at timestamptz not null default now()
);

create index problems_sprint_day_idx on public.problems (sprint_id, day_no, position);
create index problems_companies_idx on public.problems using gin (companies);
create index problems_topics_idx on public.problems using gin (topics);
create index sprints_user_idx on public.sprints (user_id);
create index saved_filters_user_idx on public.saved_filters (user_id);

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger sprints_touch before update on public.sprints
  for each row execute function public.touch_updated_at();
create trigger problems_touch before update on public.problems
  for each row execute function public.touch_updated_at();

alter table public.sprints enable row level security;
alter table public.problems enable row level security;
alter table public.saved_filters enable row level security;

create policy "own sprints" on public.sprints for all to authenticated
  using ((select app.uid()) = user_id) with check ((select app.uid()) = user_id);

create policy "own problems" on public.problems for all to authenticated
  using ((select app.uid()) = user_id)
  with check (
    (select app.uid()) = user_id
    and exists (select 1 from public.sprints s where s.id = sprint_id and s.user_id = (select app.uid()))
  );

create policy "own saved filters" on public.saved_filters for all to authenticated
  using ((select app.uid()) = user_id) with check ((select app.uid()) = user_id);

-- Bulk reschedule in one round-trip. security invoker => RLS still applies to the caller.
create function public.reschedule_problems(changes jsonb) returns void
language sql security invoker set search_path = '' as $$
  update public.problems p
     set day_no = c.day_no, sprint_no = c.sprint_no
    from jsonb_to_recordset(changes) as c(id uuid, day_no int, sprint_no int)
   where p.id = c.id;
$$;
