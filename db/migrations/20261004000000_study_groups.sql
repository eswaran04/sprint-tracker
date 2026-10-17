-- Study groups: members follow the same sheet in their own sprints and can see who completed what.
-- Only done/not-done (+ date) is shared; notes and stars stay private. All writes go through RPCs.

-- Stable key to match the same problem across members' copies: coalesce(source_id, id).
alter table public.problems add column source_id uuid;
create index problems_source_idx on public.problems (source_id);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references app.users (id) on delete cascade,
  sprint_id uuid not null references public.sprints (id) on delete cascade,
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id text not null references app.users (id) on delete cascade,
  sprint_id uuid not null references public.sprints (id) on delete cascade,
  display_name text not null,
  avatar text,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);
create index group_members_sprint_idx on public.group_members (sprint_id);

create function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members m where m.group_id = gid and m.user_id = app.uid());
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create policy "members read group" on public.groups for select to authenticated
  using (public.is_group_member(id));
create policy "members read roster" on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

revoke insert, update, delete on public.groups, public.group_members from authenticated;

-- Start a group from one of your sprints.
create function public.create_group(p_sprint uuid, p_name text, p_display_name text, p_avatar text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid text := app.uid();
  gid uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.sprints s where s.id = p_sprint and s.user_id = uid) then
    raise exception 'You can only start a group from your own sprint';
  end if;
  if exists (select 1 from public.group_members m where m.sprint_id = p_sprint) then
    raise exception 'This sprint is already in a group';
  end if;

  insert into public.groups (owner_id, sprint_id, name, invite_code)
  values (uid, p_sprint, left(coalesce(nullif(trim(p_name), ''), 'Study group'), 80),
          substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  returning id into gid;

  insert into public.group_members (group_id, user_id, sprint_id, display_name, avatar, role)
  values (gid, uid, p_sprint, left(coalesce(nullif(trim(p_display_name), ''), 'Owner'), 80), p_avatar, 'owner');
  return gid;
end $$;

-- Groups the caller belongs to, with their own linked sprint.
create function public.my_groups()
returns table (id uuid, name text, invite_code text, role text, sprint_id uuid, member_count int)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, g.invite_code, m.role, m.sprint_id,
         (select count(*)::int from public.group_members x where x.group_id = g.id)
    from public.group_members m
    join public.groups g on g.id = m.group_id
   where m.user_id = app.uid()
   order by g.created_at;
$$;

-- What the join page shows before joining.
create function public.group_preview(p_code text)
returns table (id uuid, name text, owner_name text, member_count int, sheet_title text,
               problem_count int, day_count int, my_sprint_id uuid, existing_copy_id uuid)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name,
         (select o.display_name from public.group_members o where o.group_id = g.id and o.role = 'owner'),
         (select count(*)::int from public.group_members x where x.group_id = g.id),
         s.title,
         (select count(*)::int from public.problems p where p.sprint_id = g.sprint_id),
         (select coalesce(max(p.original_day_no), 0)::int from public.problems p where p.sprint_id = g.sprint_id),
         (select m.sprint_id from public.group_members m where m.group_id = g.id and m.user_id = app.uid()),
         (select c.id from public.sprints c
           where c.user_id = app.uid() and c.copied_from = g.sprint_id
             and not exists (select 1 from public.group_members l where l.sprint_id = c.id)
           order by c.created_at desc limit 1)
    from public.groups g
    join public.sprints s on s.id = g.sprint_id
   where g.invite_code = p_code and app.uid() is not null;
$$;

-- Join via invite code: copy the sheet (or link an existing public copy). Idempotent; returns your sprint id.
create function public.join_group(p_code text, p_display_name text, p_avatar text, p_sprint uuid default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid text := app.uid();
  g public.groups;
  sid uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into g from public.groups where invite_code = p_code;
  if not found then raise exception 'This invite link is invalid or the group was deleted'; end if;

  select m.sprint_id into sid from public.group_members m where m.group_id = g.id and m.user_id = uid;
  if found then return sid; end if;

  if p_sprint is not null then
    if not exists (select 1 from public.sprints s where s.id = p_sprint and s.user_id = uid and s.copied_from = g.sprint_id) then
      raise exception 'You can only link a copy of this sheet';
    end if;
    update public.problems c
       set source_id = src.id
      from public.problems src
     where c.sprint_id = p_sprint and src.sprint_id = g.sprint_id and c.position = src.position;
    sid := p_sprint;
  else
    insert into public.sprints (user_id, title, description, start_date)
    select uid, s.title, s.description, current_date from public.sprints s where s.id = g.sprint_id
    returning id into sid;

    insert into public.problems
      (sprint_id, user_id, position, name, url, subject, difficulty, companies, topics,
       sprint_no, original_sprint_no, day_no, original_day_no, source_id)
    select sid, uid, p.position, p.name, p.url, p.subject, p.difficulty, p.companies, p.topics,
           coalesce(p.original_sprint_no, p.sprint_no), coalesce(p.original_sprint_no, p.sprint_no),
           p.original_day_no, p.original_day_no, p.id
      from public.problems p
     where p.sprint_id = g.sprint_id;
  end if;

  insert into public.group_members (group_id, user_id, sprint_id, display_name, avatar, role)
  values (g.id, uid, sid, left(coalesce(nullif(trim(p_display_name), ''), 'Member'), 80), p_avatar, 'member');
  return sid;
end $$;

-- Who completed what (and when) across the group. Never exposes notes or stars.
create function public.group_progress(p_group uuid)
returns table (user_id text, problem_key uuid, done_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, coalesce(p.source_id, p.id), p.done_at
    from public.group_members m
    join public.problems p on p.sprint_id = m.sprint_id
   where m.group_id = p_group and p.done_at is not null and public.is_group_member(p_group);
$$;

create function public.leave_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.groups g where g.id = p_group and g.owner_id = app.uid()) then
    raise exception 'Owners delete the group instead of leaving';
  end if;
  delete from public.group_members m where m.group_id = p_group and m.user_id = app.uid();
end $$;

create function public.remove_member(p_group uuid, p_user text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.groups g where g.id = p_group and g.owner_id = app.uid()) then
    raise exception 'Only the owner can remove members';
  end if;
  if p_user = app.uid() then raise exception 'Owners delete the group instead'; end if;
  delete from public.group_members m where m.group_id = p_group and m.user_id = p_user;
end $$;

create function public.delete_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.groups g where g.id = p_group and g.owner_id = app.uid()) then
    raise exception 'Only the owner can delete the group';
  end if;
  delete from public.groups g where g.id = p_group;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'is_group_member(uuid)', 'create_group(uuid, text, text, text)', 'my_groups()', 'group_preview(text)',
    'join_group(text, text, text, uuid)', 'group_progress(uuid)', 'leave_group(uuid)',
    'remove_member(uuid, text)', 'delete_group(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
