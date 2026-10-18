-- Viral Social Loop: an owner can publish a "Readiness Report" snapshot of one sprint.
-- The snapshot holds aggregates only (company readiness, a 2-line scout report, headline stats). Anyone with the
-- slug can view it, see the read-only roadmap (done ticks only: never notes, stars or timestamps) and clone it.
-- Public reads go through narrow security-definer functions; the table itself is owner-only under RLS.

create table public.share_reports (
  slug text primary key check (slug ~ '^[a-z0-9-]{3,64}$'),
  sprint_id uuid not null unique references public.sprints (id) on delete cascade,
  user_id text not null default app.uid() references app.users (id) on delete cascade,
  title text not null,
  owner_name text,
  owner_avatar text,
  show_owner boolean not null default true,
  readiness jsonb not null default '[]'::jsonb,  -- [{company, score, done, total, confidence}]
  scout jsonb not null,                          -- {line1, line2, strengths[], weaknesses[], ai}
  stats jsonb not null,                          -- {pct, done, total, streak, longest, pro_done, pro_total}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index share_reports_user_idx on public.share_reports (user_id);

create trigger share_reports_touch before update on public.share_reports
  for each row execute function public.touch_updated_at();

alter table public.share_reports enable row level security;

-- Owners manage their own reports, and only for sprints they own.
create policy "own share reports" on public.share_reports for all to authenticated
  using ((select app.uid()) = user_id)
  with check (
    (select app.uid()) = user_id
    and exists (select 1 from public.sprints s where s.id = sprint_id and s.user_id = (select app.uid()))
  );

revoke all on public.share_reports from public;
grant select, insert, update, delete on public.share_reports to authenticated;

-- Public snapshot by slug. Owner identity only when the owner opted in (same convention as public_sheets).
create function public.share_report(p_slug text)
returns table (
  slug text, sprint_id uuid, title text, owner_name text, owner_avatar text,
  readiness jsonb, scout jsonb, stats jsonb, updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select r.slug, r.sprint_id, r.title,
         case when r.show_owner then r.owner_name end,
         case when r.show_owner then r.owner_avatar end,
         r.readiness, r.scout, r.stats, r.updated_at
    from public.share_reports r
   where r.slug = p_slug;
$$;

-- Same snapshot by sprint id, for the OpenGraph image. Sprints without a report return nothing.
create function public.share_report_for_sprint(p_sprint uuid)
returns table (
  slug text, sprint_id uuid, title text, owner_name text, owner_avatar text,
  readiness jsonb, scout jsonb, stats jsonb, updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select r.slug, r.sprint_id, r.title,
         case when r.show_owner then r.owner_name end,
         case when r.show_owner then r.owner_avatar end,
         r.readiness, r.scout, r.stats, r.updated_at
    from public.share_reports r
   where r.sprint_id = p_sprint;
$$;

-- Read-only roadmap of a shared sprint on its original schedule: catalogue columns plus a done flag.
create function public.shared_roadmap(p_slug text)
returns table (
  "position" int, name text, url text, subject text, difficulty text, companies text[], topics text[],
  sprint_no int, day_no int, done boolean
)
language sql stable security definer set search_path = '' as $$
  select p.position, p.name, p.url, p.subject, p.difficulty, p.companies, p.topics,
         coalesce(p.original_sprint_no, p.sprint_no), p.original_day_no, p.done_at is not null
    from public.problems p
    join public.share_reports r on r.sprint_id = p.sprint_id
   where r.slug = p_slug
   order by p.original_day_no, p.position;
$$;

-- Clone a shared sprint into the caller's account (no progress, no notes). The slug is the access token, so the
-- source does not have to be a public sheet. Idempotent: returns the caller's existing copy (or their own sprint).
create function public.clone_shared_sprint(p_slug text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid text := app.uid();
  v_src uuid;
  v_owner text;
  new_id uuid;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  select r.sprint_id, r.user_id into v_src, v_owner from public.share_reports r where r.slug = p_slug;
  if v_src is null then
    raise exception 'This share link is no longer active';
  end if;
  if v_owner = uid then
    return v_src;
  end if;

  -- Serialize concurrent clicks from the same user so they can't create two copies.
  perform pg_advisory_xact_lock(hashtext(uid || ':' || v_src::text));

  select s.id into new_id
    from public.sprints s
   where s.user_id = uid and s.copied_from = v_src
   order by s.created_at
   limit 1;
  if new_id is not null then
    return new_id;
  end if;

  insert into public.sprints (user_id, title, description, start_date, copied_from)
  select uid, s.title, s.description, current_date, s.id
    from public.sprints s
   where s.id = v_src
  returning id into new_id;

  insert into public.problems
    (sprint_id, user_id, position, name, url, subject, difficulty, companies, topics,
     sprint_no, original_sprint_no, day_no, original_day_no)
  select new_id, uid, p.position, p.name, p.url, p.subject, p.difficulty, p.companies, p.topics,
         coalesce(p.original_sprint_no, p.sprint_no), coalesce(p.original_sprint_no, p.sprint_no),
         p.original_day_no, p.original_day_no
    from public.problems p
   where p.sprint_id = v_src;

  update public.sprints set copy_count = copy_count + 1 where id = v_src;
  return new_id;
end $$;

revoke all on function public.share_report(text) from public;
revoke all on function public.share_report_for_sprint(uuid) from public;
revoke all on function public.shared_roadmap(text) from public;
revoke all on function public.clone_shared_sprint(text) from public;
grant execute on function public.share_report(text) to app_server, authenticated;
grant execute on function public.share_report_for_sprint(uuid) to app_server, authenticated;
grant execute on function public.shared_roadmap(text) to app_server, authenticated;
grant execute on function public.clone_shared_sprint(text) to authenticated;
