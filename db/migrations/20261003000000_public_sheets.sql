-- Public sheets: owners can publish a sprint; signed-in users can browse the catalogue and copy it.
-- Public reads go through column-restricted views so progress (done_at, starred, notes) never leaks.

alter table public.sprints
  add column visibility text not null default 'private' check (visibility in ('private', 'public')),
  add column description text not null default '',
  add column show_owner boolean not null default true,
  add column owner_name text,
  add column owner_avatar text,
  add column published_at timestamptz,
  add column copied_from uuid references public.sprints (id) on delete set null,
  add column copy_count int not null default 0;

create index sprints_public_idx on public.sprints (visibility, published_at desc);

-- The sheet's original sprint for each problem (sprint_no changes when the plan is rescheduled).
alter table public.problems add column original_sprint_no int;

update public.problems p
   set original_sprint_no = coalesce(
     (select q.sprint_no from public.problems q
       where q.sprint_id = p.sprint_id and q.original_day_no = p.original_day_no and q.day_no = q.original_day_no
       limit 1),
     p.sprint_no);

-- Catalogue summary of every public sheet. Owner identity only when the owner opted in.
create view public.public_sheets with (security_invoker = false, security_barrier = true) as
select
  s.id,
  s.title,
  s.description,
  case when s.show_owner then s.owner_name end as owner_name,
  case when s.show_owner then s.owner_avatar end as owner_avatar,
  s.published_at,
  s.copy_count,
  st.problem_count,
  st.day_count,
  st.sprint_count,
  st.basic_count,
  st.core_count,
  st.pro_count,
  coalesce(tp.topics, '{}') as topics,
  coalesce(cc.company_counts, '{}'::jsonb) as company_counts
from public.sprints s
cross join lateral (
  select
    count(*)::int as problem_count,
    coalesce(max(p.original_day_no), 0)::int as day_count,
    count(distinct coalesce(p.original_sprint_no, p.sprint_no))::int as sprint_count,
    count(*) filter (where p.difficulty = 'Basic')::int as basic_count,
    count(*) filter (where p.difficulty = 'Core')::int as core_count,
    count(*) filter (where p.difficulty = 'Pro')::int as pro_count
  from public.problems p
  where p.sprint_id = s.id
) st
left join lateral (
  select array_agg(t.topic order by t.n desc, t.topic) as topics
  from (
    select topic, count(*) as n
    from public.problems p, unnest(p.topics) as topic
    where p.sprint_id = s.id
    group by topic
  ) t
) tp on true
left join lateral (
  select jsonb_object_agg(c.company, c.n) as company_counts
  from (
    select company, count(*) as n
    from public.problems p, unnest(p.companies) as company
    where p.sprint_id = s.id
    group by company
  ) c
) cc on true
where s.visibility = 'public';

-- Problem catalogue of public sheets: no progress columns, original schedule.
create view public.public_sheet_problems with (security_invoker = false, security_barrier = true) as
select
  p.id,
  p.sprint_id,
  p.position,
  p.name,
  p.url,
  p.subject,
  p.difficulty,
  p.companies,
  p.topics,
  coalesce(p.original_sprint_no, p.sprint_no) as sprint_no,
  p.original_day_no as day_no
from public.problems p
join public.sprints s on s.id = p.sprint_id
where s.visibility = 'public';

revoke all on public.public_sheets, public.public_sheet_problems from public;
grant select on public.public_sheets, public.public_sheet_problems to authenticated;

-- Copy a public sheet into the caller's account as a fresh sprint (no progress, no notes).
create function public.copy_public_sheet(src uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid text := app.uid();
  new_id uuid;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  insert into public.sprints (user_id, title, description, start_date, copied_from)
  select uid, s.title, s.description, current_date, s.id
    from public.sprints s
   where s.id = src and s.visibility = 'public'
  returning id into new_id;

  if new_id is null then
    raise exception 'This sheet is not public';
  end if;

  insert into public.problems
    (sprint_id, user_id, position, name, url, subject, difficulty, companies, topics,
     sprint_no, original_sprint_no, day_no, original_day_no)
  select new_id, uid, p.position, p.name, p.url, p.subject, p.difficulty, p.companies, p.topics,
         coalesce(p.original_sprint_no, p.sprint_no), coalesce(p.original_sprint_no, p.sprint_no),
         p.original_day_no, p.original_day_no
    from public.problems p
   where p.sprint_id = src;

  update public.sprints set copy_count = copy_count + 1 where id = src;
  return new_id;
end $$;

revoke all on function public.copy_public_sheet(uuid) from public;
grant execute on function public.copy_public_sheet(uuid) to authenticated;
