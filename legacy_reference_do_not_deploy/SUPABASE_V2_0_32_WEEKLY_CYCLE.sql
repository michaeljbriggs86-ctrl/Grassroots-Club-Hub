-- AI COLLABORATION PROTOCOL NOTE — 2026-09-19
-- STATUS: WRITTEN historical reference only; DO NOT DEPLOY.
-- Any older 'live'/'deployed' wording below is a historical note and is not a current deployment claim.

-- v2.0.32 weekly cycle: deadlines, notifications and appearance aggregates

alter table public.match_attendance drop constraint if exists match_attendance_status_check;
alter table public.match_attendance add constraint match_attendance_status_check
  check (status = any (array['selected'::text,'attended'::text,'started'::text,'substitute'::text,'unavailable'::text,'no_show'::text]));

create table if not exists public.fixture_availability_settings (
  team_id uuid not null references public.teams(id) on delete cascade,
  fixture_key text not null,
  deadline timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (team_id, fixture_key)
);
alter table public.fixture_availability_settings enable row level security;
drop policy if exists fixture_availability_settings_read on public.fixture_availability_settings;
create policy fixture_availability_settings_read on public.fixture_availability_settings for select to authenticated
  using (public.can_read_team(team_id));
drop policy if exists fixture_availability_settings_insert on public.fixture_availability_settings;
create policy fixture_availability_settings_insert on public.fixture_availability_settings for insert to authenticated
  with check (public.can_edit_team(team_id));
drop policy if exists fixture_availability_settings_update on public.fixture_availability_settings;
create policy fixture_availability_settings_update on public.fixture_availability_settings for update to authenticated
  using (public.can_edit_team(team_id)) with check (public.can_edit_team(team_id));
grant select,insert,update on public.fixture_availability_settings to authenticated;

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null check (char_length(title) between 1 and 140),
  body text not null default '' check (char_length(body) <= 1200),
  entity_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists app_notifications_recipient_created_idx on public.app_notifications(recipient_user_id,created_at desc);
create unique index if not exists app_notifications_recipient_type_entity_uq on public.app_notifications(recipient_user_id,type,entity_key) where entity_key is not null;
alter table public.app_notifications enable row level security;
revoke all on public.app_notifications from anon, authenticated;

create or replace function public.list_notifications_for_me()
returns jsonb
language sql
stable security definer
set search_path='public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',n.id,'type',n.type,'title',n.title,'body',n.body,'entity_key',n.entity_key,
    'team_id',n.team_id,'created_at',n.created_at,'read_at',n.read_at
  ) order by n.created_at desc),'[]'::jsonb)
  from public.app_notifications n
  where n.recipient_user_id=auth.uid()
    and n.created_at > now()-interval '180 days'
  limit 100
$$;
revoke all on function public.list_notifications_for_me() from public, anon;
grant execute on function public.list_notifications_for_me() to authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path='public'
as $$
begin
  update public.app_notifications set read_at=coalesce(read_at,now())
   where id=p_notification_id and recipient_user_id=auth.uid();
  return found;
end $$;
revoke all on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.set_availability_deadline(p_team_id uuid,p_fixture_key text,p_deadline timestamptz)
returns boolean
language plpgsql
security definer
set search_path='public'
as $$
declare
  me public.profiles;
  t public.teams;
  r record;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or not public.can_edit_team(p_team_id) then raise exception 'Coach access required'; end if;
  select * into t from public.teams where id=p_team_id and club_id=me.club_id;
  if t.id is null then raise exception 'Team not available'; end if;
  if length(trim(coalesce(p_fixture_key,'')))<2 then raise exception 'Fixture is required'; end if;

  insert into public.fixture_availability_settings(team_id,fixture_key,deadline,updated_by,updated_at)
  values(p_team_id,p_fixture_key,p_deadline,auth.uid(),now())
  on conflict(team_id,fixture_key) do update set deadline=excluded.deadline,updated_by=excluded.updated_by,updated_at=now();

  if p_deadline is not null then
    for r in
      select distinct p.user_id
      from public.profiles p
      where p.team_id=p_team_id and p.role in ('parent','player')
        and (
          (p.role='parent' and exists(select 1 from public.parent_player_links l where l.team_id=p_team_id and l.parent_user_id=p.user_id))
          or
          (p.role='player' and exists(select 1 from public.player_account_links l where l.team_id=p_team_id and l.user_id=p.user_id))
        )
    loop
      insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key,created_at,read_at)
      values(t.club_id,p_team_id,r.user_id,'availability_request','Match availability requested',
             'Please confirm availability by '||to_char(p_deadline at time zone 'Europe/London','Dy DD Mon, HH24:MI')||'.',
             'availability:'||p_team_id::text||':'||p_fixture_key,now(),null)
      on conflict(recipient_user_id,type,entity_key) where entity_key is not null
      do update set title=excluded.title,body=excluded.body,created_at=now(),read_at=null;
    end loop;
  end if;
  return true;
end $$;
revoke all on function public.set_availability_deadline(uuid,text,timestamptz) from public, anon;
grant execute on function public.set_availability_deadline(uuid,text,timestamptz) to authenticated;

create or replace function public.send_availability_reminder(p_team_id uuid,p_fixture_key text)
returns integer
language plpgsql
security definer
set search_path='public'
as $$
declare
  me public.profiles;
  t public.teams;
  r record;
  sent integer:=0;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or not public.can_edit_team(p_team_id) then raise exception 'Coach access required'; end if;
  select * into t from public.teams where id=p_team_id and club_id=me.club_id;
  if t.id is null then raise exception 'Team not available'; end if;

  for r in
    with links as (
      select l.parent_user_id user_id,l.player_name from public.parent_player_links l where l.team_id=p_team_id
      union all
      select l.user_id,l.player_name from public.player_account_links l where l.team_id=p_team_id
    )
    select distinct links.user_id
    from links
    join public.profiles p on p.user_id=links.user_id and p.role in ('parent','player')
    where not exists(
      select 1 from public.match_availability a
      where a.team_id=p_team_id and a.fixture_key=p_fixture_key and lower(trim(a.player_name))=lower(trim(links.player_name))
    )
  loop
    insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key,created_at,read_at)
    values(t.club_id,p_team_id,r.user_id,'availability_reminder','Availability reminder',
           'Your coaching staff are still waiting for a response for the upcoming match.',
           'availability-reminder:'||p_team_id::text||':'||p_fixture_key,now(),null)
    on conflict(recipient_user_id,type,entity_key) where entity_key is not null
    do update set created_at=now(),read_at=null,body=excluded.body;
    sent:=sent+1;
  end loop;
  return sent;
end $$;
revoke all on function public.send_availability_reminder(uuid,text) from public, anon;
grant execute on function public.send_availability_reminder(uuid,text) to authenticated;

create or replace function public.notify_fixture_change(p_team_id uuid,p_fixture_key text,p_body text)
returns integer
language plpgsql
security definer
set search_path='public'
as $$
declare me public.profiles; t public.teams; r record; sent integer:=0;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or not public.can_edit_team(p_team_id) then raise exception 'Coach access required'; end if;
  select * into t from public.teams where id=p_team_id and club_id=me.club_id;
  if t.id is null then raise exception 'Team not available'; end if;
  for r in select p.user_id from public.profiles p where p.team_id=p_team_id and p.role in ('parent','player') loop
    insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key,created_at,read_at)
    values(t.club_id,p_team_id,r.user_id,'fixture_changed','Fixture changed',left(coalesce(p_body,'Fixture details have changed.'),1200),
           'fixture-change:'||p_team_id::text||':'||p_fixture_key,now(),null)
    on conflict(recipient_user_id,type,entity_key) where entity_key is not null
    do update set body=excluded.body,created_at=now(),read_at=null;
    sent:=sent+1;
  end loop;
  return sent;
end $$;
revoke all on function public.notify_fixture_change(uuid,text,text) from public, anon;
grant execute on function public.notify_fixture_change(uuid,text,text) to authenticated;

create or replace function public.notify_selected_squad(p_team_id uuid,p_fixture_key text,p_player_names jsonb)
returns integer
language plpgsql
security definer
set search_path='public'
as $$
declare me public.profiles; t public.teams; r record; sent integer:=0;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or not public.can_edit_team(p_team_id) then raise exception 'Coach access required'; end if;
  select * into t from public.teams where id=p_team_id and club_id=me.club_id;
  if t.id is null then raise exception 'Team not available'; end if;
  for r in
    with names as (select trim(value #>> '{}') player_name from jsonb_array_elements(coalesce(p_player_names,'[]'::jsonb))),
    recipients as (
      select l.parent_user_id user_id from public.parent_player_links l join names n on lower(trim(l.player_name))=lower(n.player_name) where l.team_id=p_team_id
      union
      select l.user_id from public.player_account_links l join names n on lower(trim(l.player_name))=lower(n.player_name) where l.team_id=p_team_id
    )
    select distinct user_id from recipients
  loop
    insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key,created_at,read_at)
    values(t.club_id,p_team_id,r.user_id,'squad_selected','Matchday squad selected','The matchday squad has been selected. Open the app to check the upcoming fixture.',
           'squad:'||p_team_id::text||':'||p_fixture_key,now(),null)
    on conflict(recipient_user_id,type,entity_key) where entity_key is not null
    do update set created_at=now(),read_at=null;
    sent:=sent+1;
  end loop;
  return sent;
end $$;
revoke all on function public.notify_selected_squad(uuid,text,jsonb) from public, anon;
grant execute on function public.notify_selected_squad(uuid,text,jsonb) to authenticated;

create or replace function public.list_player_appearance_stats()
returns table(player_name text, appearances bigint, starts bigint, substitutes bigint, present bigint, unavailable bigint, no_shows bigint, recorded bigint)
language plpgsql
stable security definer
set search_path='public'
as $$
declare me public.profiles; target uuid;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role not in ('club_admin','coach','assistant_coach','parent','player') then raise exception 'Team access required'; end if;
  target:=coalesce(me.team_id,me.coach_team_id);
  if me.role='club_admin' and target is null then return; end if;
  if target is null or not public.can_read_team(target) then raise exception 'Team access required'; end if;
  return query
    select a.player_name,
      count(*) filter(where a.status in ('attended','started','substitute')) as appearances,
      count(*) filter(where a.status='started') as starts,
      count(*) filter(where a.status='substitute') as substitutes,
      count(*) filter(where a.status='attended') as present,
      count(*) filter(where a.status='unavailable') as unavailable,
      count(*) filter(where a.status='no_show') as no_shows,
      count(*) as recorded
    from public.match_attendance a
    where a.team_id=target
    group by a.player_name
    order by a.player_name;
end $$;
revoke all on function public.list_player_appearance_stats() from public, anon;
grant execute on function public.list_player_appearance_stats() to authenticated;

-- Notify a parent when approval is granted.
create or replace function public.approve_parent(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path='public'
as $$
declare me public.profiles; target public.profiles;
begin
  select * into me from public.profiles where profiles.user_id=auth.uid();
  if me.role not in ('club_admin','coach','assistant_coach') then raise exception 'Coach, Assistant Coach or Club Admin access required'; end if;
  select * into target from public.profiles where profiles.user_id=p_user_id for update;
  if target.user_id is null or target.role<>'pending_parent' then raise exception 'Pending parent not found'; end if;
  if target.club_id<>me.club_id then raise exception 'Parent belongs to another club'; end if;
  if me.role in ('coach','assistant_coach') and target.team_id<>me.team_id then raise exception 'You can only approve parents for your own team'; end if;
  update public.profiles set role='parent',approved_at=now(),approved_by=auth.uid(),updated_at=now() where user_id=p_user_id;
  insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key)
  values(target.club_id,target.team_id,target.user_id,'access_approved','Access approved','Your parent access has been approved. You can now sign in with your 6-digit PIN.','access-approved:'||target.user_id::text)
  on conflict(recipient_user_id,type,entity_key) where entity_key is not null
  do update set created_at=now(),read_at=null,body=excluded.body;
  return true;
end $$;

-- Final v2.0.32 refinements: team-scoped appearance stats and match-report notifications.
drop function if exists public.list_player_appearance_stats();
create or replace function public.list_player_appearance_stats(p_team_id uuid default null)
returns table(player_name text, appearances bigint, starts bigint, substitutes bigint, present bigint, unavailable bigint, no_shows bigint, recorded bigint)
language plpgsql stable security definer set search_path='public'
as $$
declare me public.profiles; target uuid;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role not in ('club_admin','coach','assistant_coach','parent','player') then raise exception 'Team access required'; end if;
  target:=coalesce(p_team_id,me.team_id,me.coach_team_id);
  if target is null or not public.can_read_team(target) then raise exception 'Team access required'; end if;
  return query select a.player_name,
    count(*) filter(where a.status in ('attended','started','substitute')),
    count(*) filter(where a.status='started'),
    count(*) filter(where a.status='substitute'),
    count(*) filter(where a.status='attended'),
    count(*) filter(where a.status='unavailable'),
    count(*) filter(where a.status='no_show'),
    count(*) filter(where a.status in ('attended','started','substitute','unavailable','no_show'))
  from public.match_attendance a where a.team_id=target group by a.player_name order by a.player_name;
end $$;
revoke all on function public.list_player_appearance_stats(uuid) from public, anon;
grant execute on function public.list_player_appearance_stats(uuid) to authenticated;

create or replace function public.notify_match_report(p_team_id uuid,p_match_id text,p_opponent text,p_score text)
returns integer language plpgsql security definer set search_path='public'
as $$
declare me public.profiles; t public.teams; r record; sent integer:=0;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or not public.can_edit_team(p_team_id) then raise exception 'Coach access required'; end if;
  select * into t from public.teams where id=p_team_id and club_id=me.club_id;
  if t.id is null then raise exception 'Team not available'; end if;
  for r in select p.user_id from public.profiles p where p.team_id=p_team_id and p.role in ('parent','player') loop
    insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key,created_at,read_at)
    values(t.club_id,p_team_id,r.user_id,'match_report','Match report updated',
      'The match report'||case when coalesce(trim(p_opponent),'')<>'' then ' against '||trim(p_opponent) else '' end||case when coalesce(trim(p_score),'')<>'' then ' ('||trim(p_score)||')' else '' end||' has been updated. Player statistics and attendance are now available.',
      'match-report:'||p_team_id::text||':'||coalesce(p_match_id,''),now(),null)
    on conflict(recipient_user_id,type,entity_key) where entity_key is not null
    do update set body=excluded.body,created_at=now(),read_at=null;
    sent:=sent+1;
  end loop;
  return sent;
end $$;
revoke all on function public.notify_match_report(uuid,text,text,text) from public, anon;
grant execute on function public.notify_match_report(uuid,text,text,text) to authenticated;
