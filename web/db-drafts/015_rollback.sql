-- Rollback for 015: restores the functions exactly as they were on 10 Oct 2026 (after 014), then drops the new objects.
-- Run the first line first so nobody is left in parent view.
update public.profiles set acting_as_parent=false where acting_as_parent;

create or replace function public.my_role() returns text language sql stable security definer set search_path to 'public' as $$ select p.role from public.profiles p where p.user_id=auth.uid() $$;

create or replace function public.can_read_team(p_team uuid)
 returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists(
    select 1 from public.profiles p join public.teams t on t.id=p_team
    where p.user_id=auth.uid() and p.club_id=t.club_id
      and (p.role='club_admin'
        or (p.role in ('coach','assistant_coach') and p_team=coalesce(p.coach_team_id,p.team_id))
        or (p.role='player' and p.team_id=p_team)
        or (p.role='parent' and exists(select 1 from public.parent_player_links ppl where ppl.parent_user_id=p.user_id and ppl.team_id=p_team)))
  )
$$;

create or replace function public.get_team_state_for_me(p_team_id uuid default null::uuid)
 returns table(team_id uuid, state jsonb, revision bigint, updated_at timestamp with time zone, restricted boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare me public.profiles; target uuid; tm public.teams; ts public.team_state; age int;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null then raise exception 'Authentication required'; end if;
  target:=coalesce(p_team_id,me.coach_team_id,me.team_id);
  if target is null then raise exception 'Team id is required'; end if;
  if not public.can_read_team(target) then raise exception 'You do not have read access to this team'; end if;
  select * into tm from public.teams where id=target;
  select * into ts from public.team_state where public.team_state.team_id=target;
  if ts.team_id is null then return; end if;
  age:=public.team_player_age(tm.age_group,tm.selkent_label);
  team_id:=target; revision:=ts.revision; updated_at:=ts.updated_at;
  state:=private.state_for_viewer(ts.state,target,auth.uid(),me.role,age);
  restricted:=((age is null or age between 7 and 11) and me.role in ('parent','player'));
  return next;
end $$;;

create or replace function public.get_my_context()
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  p public.profiles; t public.teams; ct public.teams; c public.clubs; target uuid; ts public.team_state;
  safe_state jsonb; is_restricted boolean:=false; target_age integer;
begin
  select * into p from public.profiles where user_id=auth.uid();
  if p.user_id is null then return null; end if;
  if p.role='parent' then
    select linked.id into target
    from public.teams linked
    join public.parent_player_links ppl on ppl.team_id=linked.id and ppl.parent_user_id=p.user_id
    where linked.club_id=p.club_id and linked.active=true
    order by case when linked.id=p.team_id then 0 else 1 end,linked.age_group,linked.name
    limit 1;
    if target is not null then select * into t from public.teams where id=target; end if;
  else
    if p.team_id is not null then select * into t from public.teams where id=p.team_id; end if;
  end if;
  if p.coach_team_id is not null then select * into ct from public.teams where id=p.coach_team_id; end if;
  if p.club_id is not null then select * into c from public.clubs where id=p.club_id; end if;
  if p.role<>'parent' then target:=coalesce(p.coach_team_id,p.team_id); end if;
  target_age:=case
    when p.role='parent' and t.id is not null then public.team_player_age(t.age_group,t.selkent_label)
    when ct.id is not null then public.team_player_age(ct.age_group,ct.selkent_label)
    else public.team_player_age(t.age_group,t.selkent_label)
  end;
  if target is not null then
    select * into ts from public.team_state where team_id=target;
    if ts.team_id is not null then
      safe_state:=private.state_for_viewer(ts.state,target,p.user_id,p.role,target_age);
      is_restricted:=(target_age between 7 and 11 and p.role in ('parent','player'));
    end if;
  end if;
  return jsonb_build_object(
    'profile',to_jsonb(p),
    'team',case when t.id is null then null else to_jsonb(t) end,
    'coach_team',case when ct.id is null then null else to_jsonb(ct) end,
    'club',case when c.id is null then null else to_jsonb(c) end,
    'team_state',safe_state,
    'team_state_revision',case when ts.team_id is null then null else ts.revision end,
    'team_state_restricted',is_restricted,
    'inbox_allowed',p.role in ('club_admin','coach','assistant_coach','parent')
  );
end $$;

create or replace function public.list_parent_player_links(p_parent_user_id uuid default null::uuid, p_team_id uuid default null::uuid)
 returns table(id uuid, club_id uuid, team_id uuid, parent_user_id uuid, player_name text, shirt_number integer, created_at timestamp with time zone)
 language plpgsql stable security definer set search_path to 'public' as $$
declare me public.profiles; target uuid; team_age integer;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role not in ('club_admin','coach','assistant_coach','parent') then raise exception 'Team access required'; end if;
  target:=coalesce(p_team_id,me.coach_team_id,me.team_id);
  if target is null then raise exception 'Choose a team'; end if;
  if not exists(select 1 from public.teams t where t.id=target and t.club_id=me.club_id) then raise exception 'Team not available'; end if;
  if me.role in ('coach','assistant_coach') and target<>coalesce(me.coach_team_id,me.team_id) then raise exception 'You can only access your own team'; end if;
  if me.role='parent' and (p_parent_user_id is null or p_parent_user_id<>auth.uid()) then raise exception 'Parents can only access their own player link'; end if;
  select public.team_player_age(age_group,selkent_label) into team_age from public.teams where public.teams.id=target;
  return query
  select p.id,p.club_id,p.team_id,p.parent_user_id,p.player_name,
         case when team_age between 7 and 11 then null else p.shirt_number end,p.created_at
  from public.parent_player_links p
  where p.team_id=target and (p_parent_user_id is null or p.parent_user_id=p_parent_user_id)
  order by p.player_name;
end $$;

create or replace function public.list_my_visible_teams()
 returns table(id uuid, club_id uuid, name text, age_group integer, division text, season text, selkent_label text, league_name text, active boolean)
 language plpgsql stable security definer set search_path to 'public' as $$
declare me public.profiles;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null then return; end if;
  if me.role='club_admin' then
    return query select t.id,t.club_id,t.name,t.age_group,t.division,t.season,t.selkent_label,t.league_name,t.active
      from public.teams t where t.club_id=me.club_id and t.active=true order by t.age_group,t.name;
  elsif me.role in ('coach','assistant_coach') then
    return query select t.id,t.club_id,t.name,t.age_group,t.division,t.season,t.selkent_label,t.league_name,t.active
      from public.teams t where t.club_id=me.club_id and t.id=coalesce(me.coach_team_id,me.team_id) and t.active=true;
  elsif me.role='parent' then
    return query select distinct t.id,t.club_id,t.name,t.age_group,t.division,t.season,t.selkent_label,t.league_name,t.active
      from public.teams t join public.parent_player_links ppl on ppl.team_id=t.id and ppl.parent_user_id=auth.uid()
      where t.club_id=me.club_id and t.active=true order by t.age_group,t.name;
  elsif me.role='player' then
    return query select t.id,t.club_id,t.name,t.age_group,t.division,t.season,t.selkent_label,t.league_name,t.active
      from public.teams t where t.id=me.team_id and t.club_id=me.club_id and t.active=true;
  end if;
end $$;

create or replace function public.list_announcements_for_me()
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  me public.profiles; my_age integer; result jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.club_id is null then return '[]'::jsonb; end if;
  if me.role='player' and exists (
    select 1 from public.teams t where t.id=me.team_id and t.club_id=me.club_id
      and public.team_player_age(t.age_group,t.selkent_label) between 7 and 16
  ) then return '[]'::jsonb; end if;
  if me.role<>'parent' and me.team_id is not null then
    select t.age_group into my_age from public.teams t where t.id=me.team_id;
  end if;
  select coalesce(jsonb_agg(x order by (x->>'pinned')::boolean desc,(x->>'important')::boolean desc,x->>'created_at' desc),'[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'id',a.id,'title',a.title,'body',a.body,'audience',a.audience,'age_group',a.age_group,'team_id',a.team_id,
      'pinned',a.pinned,'important',a.important,'created_at',a.created_at,'expires_at',a.expires_at,'read_at',r.read_at,
      'read_count',(select count(*) from public.announcement_reads rr where rr.announcement_id=a.id),
      'target_count',(
        select count(distinct target_user) from (
          select p2.user_id as target_user
          from public.profiles p2
          left join public.teams t2 on t2.id=coalesce(p2.coach_team_id,p2.team_id)
          where p2.club_id=a.club_id and p2.role in ('club_admin','coach','assistant_coach','player')
            and (p2.role<>'player' or public.team_player_age(t2.age_group,t2.selkent_label) not between 7 and 16)
            and (a.audience='whole_club'
              or (a.audience='coaches' and p2.role in ('coach','assistant_coach','club_admin'))
              or (a.audience='team' and coalesce(p2.coach_team_id,p2.team_id)=a.team_id)
              or (a.audience='age_group' and t2.age_group=a.age_group))
          union
          select p3.user_id from public.profiles p3
          where p3.club_id=a.club_id and p3.role='parent'
            and (a.audience in ('whole_club','parents')
              or (a.audience='team' and exists(select 1 from public.parent_player_links ppl where ppl.parent_user_id=p3.user_id and ppl.team_id=a.team_id))
              or (a.audience='age_group' and exists(select 1 from public.parent_player_links ppl join public.teams pt on pt.id=ppl.team_id where ppl.parent_user_id=p3.user_id and pt.age_group=a.age_group)))
        ) recipients
      )
    ) x
    from public.club_announcements a
    left join public.announcement_reads r on r.announcement_id=a.id and r.user_id=auth.uid()
    where a.club_id=me.club_id
      and (a.expires_at is null or a.expires_at>now() or me.role='club_admin')
      and (
        me.role='club_admin'
        or a.audience='whole_club'
        or (a.audience='coaches' and me.role in ('coach','assistant_coach'))
        or (a.audience='parents' and me.role='parent')
        or (a.audience='team' and (
              (me.role='parent' and exists(select 1 from public.parent_player_links ppl where ppl.parent_user_id=me.user_id and ppl.team_id=a.team_id))
              or (me.role<>'parent' and a.team_id=coalesce(me.coach_team_id,me.team_id))))
        or (a.audience='age_group' and (
              (me.role='parent' and exists(select 1 from public.parent_player_links ppl join public.teams pt on pt.id=ppl.team_id where ppl.parent_user_id=me.user_id and pt.age_group=a.age_group))
              or (me.role<>'parent' and a.age_group=my_age)))
      )
    order by a.pinned desc,a.important desc,a.created_at desc
    limit 50
  ) q;
  return result;
end $$;

create or replace function private.can_message_user(p_recipient uuid)
 returns boolean language sql stable security definer set search_path to '' as $$
  select exists(
    select 1 from public.profiles me join public.profiles target on target.user_id=p_recipient
    where me.user_id=auth.uid() and me.club_id is not null and target.club_id=me.club_id and target.user_id<>me.user_id
      and target.role in ('club_admin','coach','assistant_coach','parent')
      and (
        me.role='club_admin'
        or (me.role in ('coach','assistant_coach') and (
            target.role='club_admin'
            or (target.role='parent' and exists(select 1 from public.parent_player_links ppl where ppl.parent_user_id=target.user_id and ppl.team_id=coalesce(me.coach_team_id,me.team_id)))))
        or (me.role='parent' and (
            target.role='club_admin'
            or (target.role in ('coach','assistant_coach') and exists(select 1 from public.parent_player_links ppl where ppl.parent_user_id=me.user_id and ppl.team_id=coalesce(target.coach_team_id,target.team_id)))))
      )
  )
$$;

create or replace function public.approve_parent_request(p_request_id uuid, p_player_name text)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me public.profiles; req public.parent_access_requests; target public.profiles; ts public.team_state; canonical_name text;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role not in ('club_admin','coach','assistant_coach') then raise exception 'Coach, Assistant Coach or Club Admin access required'; end if;
  select * into req from public.parent_access_requests where id=p_request_id and status='pending' for update;
  if req.id is null then raise exception 'Pending parent request not found'; end if;
  if req.club_id<>me.club_id then raise exception 'Parent request belongs to another club'; end if;
  if me.role in ('coach','assistant_coach') and req.team_id<>coalesce(me.coach_team_id,me.team_id) then raise exception 'You can only review parent requests for your own team'; end if;
  select * into target from public.profiles where user_id=req.user_id for update;
  if target.user_id is null or target.role not in ('pending_parent','parent') then raise exception 'Parent account is not available for approval'; end if;
  if target.club_id<>req.club_id then raise exception 'Parent account club does not match request'; end if;
  select * into ts from public.team_state where team_id=req.team_id;
  if ts.team_id is null then raise exception 'Team squad is not available'; end if;
  select squad_player->>'name' into canonical_name
  from jsonb_array_elements(case when jsonb_typeof(ts.state->'squad')='array' then ts.state->'squad' else '[]'::jsonb end) squad_player
  where coalesce(squad_player->>'status','active')='active' and public.team_identity_norm(squad_player->>'name')=public.team_identity_norm(p_player_name) limit 1;
  if canonical_name is null then raise exception 'Select an active player from this team before approving the request'; end if;
  insert into public.parent_player_links(club_id,team_id,parent_user_id,player_name,shirt_number,created_by)
  values(req.club_id,req.team_id,req.user_id,left(canonical_name,80),null,auth.uid())
  on conflict (team_id,parent_user_id,player_name) do update set created_by=excluded.created_by;
  update public.parent_access_requests set status='approved',reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=req.id;
  update public.profiles set role='parent',access_method='email',team_id=coalesce(team_id,req.team_id),approved_at=coalesce(approved_at,now()),approved_by=coalesce(approved_by,auth.uid()),updated_at=now() where user_id=req.user_id;
  insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key)
  values(req.club_id,req.team_id,req.user_id,'access_approved','Child access approved',canonical_name || ' has been linked to your parent account for this team.','access-approved-request:'||req.id::text)
  on conflict(recipient_user_id,type,entity_key) where entity_key is not null do update set created_at=now(),read_at=null,body=excluded.body;
  return jsonb_build_object('ok',true,'request_id',req.id,'team_id',req.team_id,'player_name',canonical_name,'parent_user_id',req.user_id);
end $$;

create or replace function public.list_pending_parent_requests(p_team_id uuid default null::uuid)
 returns table(request_id uuid, user_id uuid, parent_name text, parent_email text, child_name text, requested_at timestamp with time zone)
 language plpgsql stable security definer set search_path to 'public' as $$
declare me public.profiles; target uuid;
begin
  select pr.* into me from public.profiles pr where pr.user_id=auth.uid();
  if me.user_id is null or me.role not in ('club_admin','coach','assistant_coach') then raise exception 'Coach or Club Admin access required'; end if;
  target:=coalesce(p_team_id,me.coach_team_id,me.team_id);
  if target is null then raise exception 'Choose a team'; end if;
  if not exists(select 1 from public.teams t where t.id=target and t.club_id=me.club_id and t.active=true) then raise exception 'Team not available'; end if;
  if me.role in ('coach','assistant_coach') and target<>coalesce(me.coach_team_id,me.team_id) then raise exception 'You can only manage your own team'; end if;
  return query
  select r.id,r.user_id,p.full_name::text,u.email::text,r.child_name::text,r.created_at
  from public.parent_access_requests r join public.profiles p on p.user_id=r.user_id join auth.users u on u.id=r.user_id
  where r.team_id=target and r.status='pending' and p.role in ('pending_parent','parent') and p.club_id=me.club_id
  order by r.created_at asc;
end $$;

drop function if exists public.request_child_link(uuid,text);
drop function if exists public.set_my_capacity(boolean);
drop function if exists private.effective_role(public.profiles);
-- Column is kept (harmless, defaults false). To remove: alter table public.profiles drop column acting_as_parent;
