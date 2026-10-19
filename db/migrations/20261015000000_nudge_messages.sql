-- Optional short message on nudges ("Pair up on LRU Cache tonight?").
-- Only the person nudged can read it: the "targets read own nudges" policy and my_nudges()' target filter are unchanged.
-- scripts/migrate.mjs applies each file in one transaction, so send_nudge/my_nudges are never missing mid-deploy.

alter table public.group_nudges
  add column message text
  constraint group_nudges_message_len check (message is null or char_length(message) between 1 and 140);

drop function public.send_nudge(uuid, text);

-- Nudge a teammate, optionally with a message. Limits are unchanged from 20261006000000_group_activity.sql:
-- one per pair per day, three received per person per day. Two-argument calls still work (p_message defaults to null).
create function public.send_nudge(p_group uuid, p_target text, p_message text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid text := app.uid();
  -- Control characters (newlines, tabs, ...) become spaces; blank messages are stored as null.
  msg text := nullif(btrim(regexp_replace(coalesce(p_message, ''), '[[:cntrl:]]+', ' ', 'g')), '');
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if uid = p_target then raise exception 'You can''t nudge yourself'; end if;
  if not public.is_group_member(p_group) then raise exception 'Not a member of this group'; end if;
  if not exists (select 1 from public.group_members m where m.group_id = p_group and m.user_id = p_target) then
    raise exception 'That person is not in this group';
  end if;
  if msg is not null and char_length(msg) > 140 then
    raise exception 'Keep nudges under 140 characters';
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

  insert into public.group_nudges (group_id, sender, target, message) values (p_group, uid, p_target, msg);
end $$;

drop function public.my_nudges();

-- The caller's unseen nudges from the last week, with their messages.
create function public.my_nudges()
returns table (id uuid, group_id uuid, group_name text, sender_name text, created_at timestamptz, message text)
language sql stable security definer set search_path = '' as $$
  select n.id, n.group_id, g.name, coalesce(m.display_name, 'Someone'), n.created_at, n.message
    from public.group_nudges n
    join public.groups g on g.id = n.group_id
    left join public.group_members m on m.group_id = n.group_id and m.user_id = n.sender
   where n.target = app.uid()
     and n.seen_at is null
     and n.created_at > now() - interval '7 days'
     and public.is_group_member(n.group_id)
   order by n.created_at desc;
$$;

do $$
declare f text;
begin
  foreach f in array array['send_nudge(uuid, text, text)', 'my_nudges()'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
