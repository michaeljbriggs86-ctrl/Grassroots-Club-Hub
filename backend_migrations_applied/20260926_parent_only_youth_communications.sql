-- Applied to the Shooters Hill pilot. Keep alongside the live function changes.
-- Selkent U7–U16 football alerts go to linked parents; U17+ player alerts remain.
-- Older youth alerts are hidden at read time.

CREATE OR REPLACE FUNCTION public.notify_fixture_change(p_team_id uuid, p_fixture_key text, p_body text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me public.profiles; t public.teams; r record; sent integer:=0;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or not public.can_edit_team(p_team_id) then raise exception 'Coach access required'; end if;
  select * into t from public.teams where id=p_team_id and club_id=me.club_id;
  if t.id is null then raise exception 'Team not available'; end if;
  for r in select distinct p.user_id
    from public.profiles p
    where p.club_id=t.club_id
      and ((p.role='parent' and exists (
        select 1 from public.parent_player_links l
        where l.parent_user_id=p.user_id and l.team_id=p_team_id
      )) or (p.role='player' and p.team_id=p_team_id
        and not (public.team_player_age(t.age_group,t.selkent_label) between 7 and 16))) loop
    insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key,created_at,read_at)
    values(t.club_id,p_team_id,r.user_id,'fixture_changed','Fixture changed',left(coalesce(p_body,'Fixture details have changed.'),1200),
           'fixture-change:'||p_team_id::text||':'||p_fixture_key,now(),null)
    on conflict(recipient_user_id,type,entity_key) where entity_key is not null
    do update set body=excluded.body,created_at=now(),read_at=null;
    sent:=sent+1;
  end loop;
  return sent;
end $function$;

CREATE OR REPLACE FUNCTION public.notify_match_reopened(p_team_id uuid, p_match_id text, p_opponent text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me public.profiles;
  t public.teams;
  r record;
  sent integer := 0;
  body_text text;
begin
  select * into me from public.profiles where user_id = auth.uid();
  if me.user_id is null or not public.can_edit_team(p_team_id) then
    raise exception 'Coach access required';
  end if;

  select * into t from public.teams
  where id = p_team_id and club_id = me.club_id;
  if t.id is null then
    raise exception 'Team not available';
  end if;

  body_text :=
    'The match'
    || case when coalesce(trim(p_opponent),'') <> '' then ' against ' || trim(p_opponent) else '' end
    || ' has been returned to Scheduled. Previous match-report details were removed.';

  for r in
    select distinct p.user_id
    from public.profiles p
    where p.club_id=t.club_id
      and ((p.role='parent' and exists (
        select 1 from public.parent_player_links l
        where l.parent_user_id=p.user_id and l.team_id=p_team_id
      )) or (p.role='player' and p.team_id=p_team_id
        and not (public.team_player_age(t.age_group,t.selkent_label) between 7 and 16)))
  loop
    insert into public.app_notifications(
      club_id,team_id,recipient_user_id,type,title,body,entity_key,created_at,read_at
    )
    values(
      t.club_id,p_team_id,r.user_id,'match_report','Match report corrected',
      body_text,
      'match-report:' || p_team_id::text || ':' || coalesce(p_match_id,''),
      now(),null
    )
    on conflict(recipient_user_id,type,entity_key) where entity_key is not null
    do update set
      title=excluded.title,
      body=excluded.body,
      created_at=now(),
      read_at=null;

    sent := sent + 1;
  end loop;

  return sent;
end
$function$;

CREATE OR REPLACE FUNCTION public.notify_match_report(p_team_id uuid, p_match_id text, p_opponent text, p_score text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me public.profiles;
  t public.teams;
  r record;
  sent integer:=0;
  body_text text;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or not public.can_edit_team(p_team_id) then
    raise exception 'Coach access required';
  end if;

  select * into t from public.teams where id=p_team_id and club_id=me.club_id;
  if t.id is null then raise exception 'Team not available'; end if;

  if public.team_player_age(t.age_group,t.selkent_label) between 7 and 11 then
    body_text :=
      'Match information'
      || case when coalesce(trim(p_opponent),'')<>'' then ' against '||trim(p_opponent) else '' end
      || ' has been updated. Scores and results are restricted for this age group.';
  else
    body_text :=
      'The match report'
      || case when coalesce(trim(p_opponent),'')<>'' then ' against '||trim(p_opponent) else '' end
      || case when coalesce(trim(p_score),'')<>'' then ' ('||trim(p_score)||')' else '' end
      || ' has been updated.';
  end if;

  for r in
    select distinct p.user_id
    from public.profiles p
    where p.club_id=t.club_id
      and ((p.role='parent' and exists (
        select 1 from public.parent_player_links l
        where l.parent_user_id=p.user_id and l.team_id=p_team_id
      )) or (p.role='player' and p.team_id=p_team_id
        and not (public.team_player_age(t.age_group,t.selkent_label) between 7 and 16)))
  loop
    insert into public.app_notifications(
      club_id,team_id,recipient_user_id,type,title,body,entity_key,created_at,read_at
    )
    values(
      t.club_id,p_team_id,r.user_id,'match_report','Match report updated',
      body_text,
      'match-report:'||p_team_id::text||':'||coalesce(p_match_id,''),
      now(),null
    )
    on conflict(recipient_user_id,type,entity_key) where entity_key is not null
    do update set body=excluded.body,created_at=now(),read_at=null;
    sent:=sent+1;
  end loop;

  return sent;
end
$function$;

CREATE OR REPLACE FUNCTION public.notify_selected_squad(p_team_id uuid, p_fixture_key text, p_player_names jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      select l.user_id from public.player_account_links l join names n on lower(trim(l.player_name))=lower(n.player_name) where l.team_id=p_team_id and not (public.team_player_age(t.age_group,t.selkent_label) between 7 and 16)
    )
    select distinct recipients.user_id from recipients join public.profiles p on p.user_id=recipients.user_id and p.club_id=t.club_id and p.role in ('parent','player')
  loop
    insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key,created_at,read_at)
    values(t.club_id,p_team_id,r.user_id,'squad_selected','Matchday squad selected','The matchday squad has been selected. Open the app to check the upcoming fixture.',
           'squad:'||p_team_id::text||':'||p_fixture_key,now(),null)
    on conflict(recipient_user_id,type,entity_key) where entity_key is not null
    do update set created_at=now(),read_at=null;
    sent:=sent+1;
  end loop;
  return sent;
end $function$;

CREATE OR REPLACE FUNCTION public.send_availability_reminder(p_team_id uuid, p_fixture_key text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      select l.user_id,l.player_name from public.player_account_links l where l.team_id=p_team_id and not (public.team_player_age(t.age_group,t.selkent_label) between 7 and 16)
    )
    select distinct links.user_id
    from links
    join public.profiles p on p.user_id=links.user_id and p.club_id=t.club_id and p.role in ('parent','player')
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
end $function$;

CREATE OR REPLACE FUNCTION public.set_availability_deadline(p_team_id uuid, p_fixture_key text, p_deadline timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      where p.club_id=t.club_id and p.role in ('parent','player') and (p.role='parent' or not (public.team_player_age(t.age_group,t.selkent_label) between 7 and 16))
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
end $function$;

CREATE OR REPLACE FUNCTION public.list_announcements_for_me()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me public.profiles;
  my_age integer;
  result jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.club_id is null then return '[]'::jsonb; end if;
  -- Selkent U7–U16 communications are addressed to adults through parents.
  if me.role='player' and exists (
    select 1 from public.teams t
    where t.id=me.team_id and t.club_id=me.club_id
      and public.team_player_age(t.age_group,t.selkent_label) between 7 and 16
  ) then return '[]'::jsonb; end if;

  if me.role<>'parent' and me.team_id is not null then
    select t.age_group into my_age from public.teams t where t.id=me.team_id;
  end if;

  select coalesce(
    jsonb_agg(x order by (x->>'pinned')::boolean desc,(x->>'important')::boolean desc,x->>'created_at' desc),
    '[]'::jsonb
  ) into result
  from (
    select jsonb_build_object(
      'id',a.id,
      'title',a.title,
      'body',a.body,
      'audience',a.audience,
      'age_group',a.age_group,
      'team_id',a.team_id,
      'pinned',a.pinned,
      'important',a.important,
      'created_at',a.created_at,
      'expires_at',a.expires_at,
      'read_at',r.read_at,
      'read_count',(select count(*) from public.announcement_reads rr where rr.announcement_id=a.id),
      'target_count',(
        select count(distinct target_user)
        from (
          select p2.user_id as target_user
          from public.profiles p2
          left join public.teams t2 on t2.id=coalesce(p2.coach_team_id,p2.team_id)
          where p2.club_id=a.club_id
            and p2.role in ('club_admin','coach','assistant_coach','player')
            and (p2.role<>'player' or public.team_player_age(t2.age_group,t2.selkent_label) not between 7 and 16)
            and (
              a.audience='whole_club'
              or (a.audience='coaches' and p2.role in ('coach','assistant_coach','club_admin'))
              or (a.audience='team' and coalesce(p2.coach_team_id,p2.team_id)=a.team_id)
              or (a.audience='age_group' and t2.age_group=a.age_group)
            )
          union
          select p3.user_id
          from public.profiles p3
          where p3.club_id=a.club_id
            and p3.role='parent'
            and (
              a.audience in ('whole_club','parents')
              or (
                a.audience='team'
                and exists(
                  select 1 from public.parent_player_links ppl
                  where ppl.parent_user_id=p3.user_id and ppl.team_id=a.team_id
                )
              )
              or (
                a.audience='age_group'
                and exists(
                  select 1
                  from public.parent_player_links ppl
                  join public.teams pt on pt.id=ppl.team_id
                  where ppl.parent_user_id=p3.user_id and pt.age_group=a.age_group
                )
              )
            )
        ) recipients
      )
    ) x
    from public.club_announcements a
    left join public.announcement_reads r
      on r.announcement_id=a.id and r.user_id=auth.uid()
    where a.club_id=me.club_id
      and (a.expires_at is null or a.expires_at>now() or me.role='club_admin')
      and (
        me.role='club_admin'
        or a.audience='whole_club'
        or (a.audience='coaches' and me.role in ('coach','assistant_coach'))
        or (a.audience='parents' and me.role='parent')
        or (
          a.audience='team'
          and (
            (me.role='parent' and exists(
              select 1 from public.parent_player_links ppl
              where ppl.parent_user_id=me.user_id and ppl.team_id=a.team_id
            ))
            or (
              me.role<>'parent'
              and a.team_id=coalesce(me.coach_team_id,me.team_id)
            )
          )
        )
        or (
          a.audience='age_group'
          and (
            (me.role='parent' and exists(
              select 1
              from public.parent_player_links ppl
              join public.teams pt on pt.id=ppl.team_id
              where ppl.parent_user_id=me.user_id and pt.age_group=a.age_group
            ))
            or (me.role<>'parent' and a.age_group=my_age)
          )
        )
      )
    order by a.pinned desc,a.important desc,a.created_at desc
    limit 50
  ) q;

  return result;
end
$function$;

CREATE OR REPLACE FUNCTION public.list_notifications_for_me()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',n.id,'type',n.type,'title',n.title,'body',n.body,'entity_key',n.entity_key,
    'team_id',n.team_id,'created_at',n.created_at,'read_at',n.read_at
  ) order by n.created_at desc),'[]'::jsonb)
  from public.app_notifications n
  where n.recipient_user_id=auth.uid()
    and n.created_at > now()-interval '180 days'
    -- Hide previously issued football alerts as well as future ones for U7–U16 players.
    and not exists (
      select 1 from public.profiles p
      join public.teams t on t.id=n.team_id and t.club_id=p.club_id
      where p.user_id=auth.uid() and p.role='player'
        and public.team_player_age(t.age_group,t.selkent_label) between 7 and 16
    )
  limit 100
$function$;
