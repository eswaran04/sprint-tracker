-- Group activity feed, 👏 reactions and nudges.
-- The feed shares only problem names and completion times (never notes or stars). Reactions attach to a
-- member's day of solves; nudges are private to the person nudged. All writes go through RPCs.

create table public.group_reactions (
  group_id uuid not null references public.groups (id) on delete cascade,
  target_user text not null references app.users (id) on delete cascade,
  day date not null,
  reactor text not null references app.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, target_user, day, reactor)
);

create table public.group_nudges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  sender text not null references app.users (id) on delete cascade,
  target text not null references app.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);

create index group_nudges_target_idx on public.group_nudges (target, created_at desc);
create index group_nudges_pair_idx on public.group_nudges (sender, target, created_at desc);

alter table public.group_reactions enable row level security;
alter table public.group_nudges enable row level security;

create policy "members read reactions" on public.group_reactions for select to authenticated
  using (public.is_group_member(group_id));
create policy "targets read own nudges" on public.group_nudges for select to authenticated
  using (target = app.uid());

revoke insert, update, delete on public.group_reactions, public.group_nudges from authenticated;

-- What members completed in the last week, newest first. Names and times only.
create function public.group_activity(p_group uuid)
returns table (user_id text, problem_name text, done_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.name, p.done_at
    from public.group_members m
    join public.problems p on p.sprint_id = m.sprint_id
   where m.group_id = p_group
     and p.done_at >= now() - interval '7 days'
     and public.is_group_member(p_group)
   order by p.done_at desc
   limit 300;
$$;

-- Clap for a teammate's day, or take the clap back.
create function public.toggle_reaction(p_group uuid, p_target text, p_day date) returns void
language plpgsql security definer set search_path = '' as $$
declare uid text := app.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if uid = p_target then raise exception 'You can''t clap for yourself'; end if;
  if not public.is_group_member(p_group) then raise exception 'Not a member of this group'; end if;
  if not exists (select 1 from public.group_members m where m.group_id = p_group and m.user_id = p_target) then
    raise exception 'That person is not in this group';
  end if;
  -- Days are chosen by the client's local clock, so allow a little slack either side of server today.
  if abs(p_day - current_date) > 8 then raise exception 'Too far back to react to'; end if;

  delete from public.group_reactions r
   where r.group_id = p_group and r.target_user = p_target and r.day = p_day and r.reactor = uid;
  if not found then
    insert into public.group_reactions (group_id, target_user, day, reactor)
    values (p_group, p_target, p_day, uid)
    on conflict do nothing;
  end if;
end $$;

-- Nudge a teammate. Limits keep it friendly: one per pair per day, three received per person per day.
create function public.send_nudge(p_group uuid, p_target text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid text := app.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if uid = p_target then raise exception 'You can''t nudge yourself'; end if;
  if not public.is_group_member(p_group) then raise exception 'Not a member of this group'; end if;
  if not exists (select 1 from public.group_members m where m.group_id = p_group and m.user_id = p_target) then
    raise exception 'That person is not in this group';
  end if;
  if exists (
    select 1 from public.group_nudges n
     where n.group_id = p_group and n.sender = uid and n.target = p_target
       and n.created_at > now() - interval '24 hours'
  ) then
    raise exception 'You already nudged them today';
  end if;
  if (
    select count(*) from public.group_nudges n
     where n.target = p_target and n.created_at > now() - interval '24 hours'
  ) >= 3 then
    raise exception 'They have been nudged enough for today';
  end if;

  insert into public.group_nudges (group_id, sender, target) values (p_group, uid, p_target);
end $$;

-- The caller's unseen nudges from the last week.
create function public.my_nudges()
returns table (id uuid, group_id uuid, group_name text, sender_name text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id, n.group_id, g.name, coalesce(m.display_name, 'Someone'), n.created_at
    from public.group_nudges n
    join public.groups g on g.id = n.group_id
    left join public.group_members m on m.group_id = n.group_id and m.user_id = n.sender
   where n.target = app.uid()
     and n.seen_at is null
     and n.created_at > now() - interval '7 days'
     and public.is_group_member(n.group_id)
   order by n.created_at desc;
$$;

create function public.mark_nudges_seen() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if app.uid() is null then raise exception 'Not signed in'; end if;
  update public.group_nudges n set seen_at = now() where n.target = app.uid() and n.seen_at is null;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'group_activity(uuid)', 'toggle_reaction(uuid, text, date)', 'send_nudge(uuid, text)',
    'my_nudges()', 'mark_nudges_seen()'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
