-- Rolled-back test for drafts 015 + 016. Paste the WHOLE file into the SQL editor and run. It applies 015 then 016 inside this run,
-- checks them, then ends with an error on purpose so NOTHING is kept. Every line should start PASS.
begin;
-- 015: one login, two capacities (staff + parent). DRAFT, not applied. Apply only on Mike's "Apply 015".
--
-- Why: most coaches and admins are also parents. They should not need a second account/email to see their own child.
-- How (mirrors the multi-team design in 012):
--   * A coach / assistant coach / Club Admin may have parent_player_links (their own children).
--   * profiles.acting_as_parent says which capacity they are using right now. It defaults to false, so nothing
--     changes for anyone until they switch.
--   * While acting as a parent, the account is treated EXACTLY as a parent by every parent-facing read path
--     (private.effective_role). Staff-only actions still check the real role; the app simply does not offer them.
--     This is a mistake-prevention switch, not a security boundary: the person is entitled to their staff access anyway.
--   * Linking a child: request_child_link creates a request; it can NEVER be approved by the requester.
--     Club Admins (any team) or the coach of that team can approve. Approving never changes a staff member's role or team.
--
-- Safety: no existing parent, player, coach or admin sees any difference while acting_as_parent is false.

-- 1. Which capacity is the person using right now
alter table public.profiles add column if not exists acting_as_parent boolean not null default false;

-- 2. The single place that decides "what role am I acting as"
create or replace function private.effective_role(p public.profiles)
returns text language sql stable security definer set search_path to '' as $$
  select case
    when p.acting_as_parent
     and p.role in ('club_admin','coach','assistant_coach')
     and exists(select 1 from public.parent_player_links l where l.parent_user_id=p.user_id)
    then 'parent' else p.role end
$$;

-- 3. RLS helper: policies that use my_role() now follow the acting capacity
create or replace function public.my_role()
returns text language sql stable security definer set search_path to 'public' as $$
  select private.effective_role(p) from public.profiles p where p.user_id=auth.uid()
$$;

-- 4. Switch capacity (staff only; parent capacity needs at least one approved child)
create or replace function public.set_my_capacity(p_parent boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me public.profiles;
begin
  select * into me from public.profiles where user_id=auth.uid() for update;
  if me.user_id is null then raise exception 'Sign in first'; end if;
  if me.role not in ('club_admin','coach','assistant_coach') then raise exception 'Only coaching staff and Club Admins have two capacities'; end if;
  if p_parent and not exists(select 1 from public.parent_player_links l where l.parent_user_id=me.user_id) then
    raise exception 'Link your child first. A Club Admin or the team coach must approve it.';
  end if;
  update public.profiles set acting_as_parent=coalesce(p_parent,false), updated_at=now() where user_id=me.user_id;
  return jsonb_build_object('ok',true,'acting_as_parent',coalesce(p_parent,false));
end $$;

-- 5. Staff ask to link their own child (needs approval by SOMEONE ELSE)
create or replace function public.request_child_link(p_team_id uuid, p_child_name text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  me public.profiles; target public.teams; nm text:=regexp_replace(trim(coalesce(p_child_name,'')),'\s+',' ','g');
  req public.parent_access_requests;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into me from public.profiles where user_id=auth.uid() for update;
  if me.user_id is null or me.role not in ('club_admin','coach','assistant_coach') then
    raise exception 'This is for coaches and Club Admins. Parents use the parent sign-up.';
  end if;
  if length(nm)<2 or length(nm)>80 then raise exception 'Enter your child''s name'; end if;
  select * into target from public.teams where id=p_team_id and active=true;
  if target.id is null or target.club_id is distinct from me.club_id then raise exception 'Team not available'; end if;
  if exists(select 1 from public.parent_player_links l where l.parent_user_id=me.user_id and l.team_id=target.id
            and public.team_identity_norm(l.player_name)=public.team_identity_norm(nm)) then
    raise exception 'That child is already linked to your account';
  end if;

  insert into public.parent_access_requests(user_id,club_id,team_id,child_name,status,updated_at,reviewed_at,reviewed_by)
  values(me.user_id,target.club_id,target.id,nm,'pending',now(),null,null)
  on conflict (user_id,team_id,child_name)
  do update set status='pending',updated_at=now(),reviewed_at=null,reviewed_by=null
  returning * into req;

  insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key)
  select target.club_id,target.id,staff.user_id,'parent_access_request','Child link request',
         coalesce(nullif(me.full_name,''),'A coach')||' asked to link their child '||nm||'. Someone other than them must approve it.',
         'parent-access-request:'||req.id::text
  from public.profiles staff
  where staff.club_id=target.club_id and staff.user_id<>me.user_id
    and staff.role in ('club_admin','coach','assistant_coach')
    and (staff.role='club_admin' or coalesce(staff.coach_team_id,staff.team_id)=target.id)
  on conflict(recipient_user_id,type,entity_key) where entity_key is not null
  do update set created_at=now(),read_at=null,body=excluded.body;

  return jsonb_build_object('ok',true,'request_id',req.id,'team_id',target.id,'child_name',nm,'status','pending');
end $$;

-- 6. Approving: never your own request; staff requesters keep their role and coaching team
create or replace function public.approve_parent_request(p_request_id uuid, p_player_name text)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  me public.profiles; req public.parent_access_requests; target public.profiles; ts public.team_state; canonical_name text;
  staff_requester boolean;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role not in ('club_admin','coach','assistant_coach') then
    raise exception 'Coach, Assistant Coach or Club Admin access required';
  end if;

  select * into req from public.parent_access_requests where id=p_request_id and status='pending' for update;
  if req.id is null then raise exception 'Pending parent request not found'; end if;
  if req.club_id<>me.club_id then raise exception 'Parent request belongs to another club'; end if;
  if req.user_id=auth.uid() then raise exception 'You cannot approve your own request. Ask a Club Admin or the team coach.'; end if;
  if me.role in ('coach','assistant_coach') and req.team_id<>coalesce(me.coach_team_id,me.team_id) then
    raise exception 'You can only review parent requests for your own team';
  end if;

  select * into target from public.profiles where user_id=req.user_id for update;
  if target.user_id is null or target.role not in ('pending_parent','parent','coach','assistant_coach','club_admin') then
    raise exception 'Parent account is not available for approval';
  end if;
  if target.club_id<>req.club_id then raise exception 'Parent account club does not match request'; end if;
  staff_requester:=target.role in ('coach','assistant_coach','club_admin');

  select * into ts from public.team_state where team_id=req.team_id;
  if ts.team_id is null then raise exception 'Team squad is not available'; end if;

  select squad_player->>'name' into canonical_name
  from jsonb_array_elements(case when jsonb_typeof(ts.state->'squad')='array' then ts.state->'squad' else '[]'::jsonb end) squad_player
  where coalesce(squad_player->>'status','active')='active'
    and public.team_identity_norm(squad_player->>'name')=public.team_identity_norm(p_player_name)
  limit 1;
  if canonical_name is null then raise exception 'Select an active player from this team before approving the request'; end if;

  insert into public.parent_player_links(club_id,team_id,parent_user_id,player_name,shirt_number,created_by)
  values(req.club_id,req.team_id,req.user_id,left(canonical_name,80),null,auth.uid())
  on conflict (team_id,parent_user_id,player_name) do update set created_by=excluded.created_by;

  update public.parent_access_requests set status='approved',reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=req.id;

  if staff_requester then
    -- Coaching role, active team and approval history stay exactly as they were.
    update public.profiles set updated_at=now() where user_id=req.user_id;
  else
    update public.profiles
    set role='parent',access_method='email',team_id=coalesce(team_id,req.team_id),
        approved_at=coalesce(approved_at,now()),approved_by=coalesce(approved_by,auth.uid()),updated_at=now()
    where user_id=req.user_id;
  end if;

  insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key)
  values(req.club_id,req.team_id,req.user_id,'access_approved','Child access approved',
         canonical_name||' has been linked to your '||case when staff_requester then 'account. Use "Switch team or profile" to open the parent view.' else 'parent account for this team.' end,
         'access-approved-request:'||req.id::text)
  on conflict(recipient_user_id,type,entity_key) where entity_key is not null
  do update set created_at=now(),read_at=null,body=excluded.body;

  return jsonb_build_object('ok',true,'request_id',req.id,'team_id',req.team_id,'player_name',canonical_name,'parent_user_id',req.user_id);
end $$;

-- 7. Approver queue shows staff requesters too (labelled)
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
  select r.id,r.user_id,
         (p.full_name||case when p.role in ('coach','assistant_coach','club_admin') then ' (coach/admin, own child)' else '' end)::text,
         u.email::text,r.child_name::text,r.created_at
  from public.parent_access_requests r
  join public.profiles p on p.user_id=r.user_id
  join auth.users u on u.id=r.user_id
  where r.team_id=target and r.status='pending'
    and p.role in ('pending_parent','parent','coach','assistant_coach','club_admin')
    and p.club_id=me.club_id and r.user_id<>auth.uid()
  order by r.created_at asc;
end $$;

-- 8. Parent-facing read paths follow the acting capacity -----------------------------------------------------

create or replace function public.can_read_team(p_team uuid)
 returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists(
    select 1
    from public.profiles p
    join public.teams t on t.id=p_team
    cross join lateral (select private.effective_role(p) as r) e
    where p.user_id=auth.uid() and p.club_id=t.club_id
      and (
        e.r='club_admin'
        or (e.r in ('coach','assistant_coach') and p_team=coalesce(p.coach_team_id,p.team_id))
        or (e.r='player' and p.team_id=p_team)
        or (e.r='parent' and exists(select 1 from public.parent_player_links ppl where ppl.parent_user_id=p.user_id and ppl.team_id=p_team))
      )
  )
$$;

create or replace function public.get_team_state_for_me(p_team_id uuid default null::uuid)
 returns table(team_id uuid, state jsonb, revision bigint, updated_at timestamp with time zone, restricted boolean)
 language plpgsql stable security definer set search_path to 'public' as $$
declare me public.profiles; target uuid; tm public.teams; ts public.team_state; age int; eff text;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null then raise exception 'Authentication required'; end if;
  eff:=private.effective_role(me);
  target:=coalesce(p_team_id,me.coach_team_id,me.team_id);
  if eff='parent' and me.role<>'parent' then
    -- A coach/admin using the parent capacity opens their child's team, never their coaching team.
    target:=coalesce(p_team_id,(select l.team_id from public.parent_player_links l where l.parent_user_id=me.user_id order by l.created_at limit 1));
  end if;
  if target is null then raise exception 'Team id is required'; end if;
  if not public.can_read_team(target) then raise exception 'You do not have read access to this team'; end if;
  select * into tm from public.teams where id=target;
  select * into ts from public.team_state where public.team_state.team_id=target;
  if ts.team_id is null then return; end if;
  age:=public.team_player_age(tm.age_group,tm.selkent_label);
  team_id:=target; revision:=ts.revision; updated_at:=ts.updated_at;
  state:=private.state_for_viewer(ts.state,target,auth.uid(),eff,age);
  restricted:=((age is null or age between 7 and 11) and eff in ('parent','player'));
  return next;
end $$;

create or replace function public.get_my_context()
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  p public.profiles; t public.teams; ct public.teams; c public.clubs; target uuid; ts public.team_state;
  safe_state jsonb; is_restricted boolean:=false; target_age integer; real_role text;
begin
  select * into p from public.profiles where user_id=auth.uid();
  if p.user_id is null then return null; end if;
  real_role:=p.role;
  p.role:=private.effective_role(p);
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
      is_restricted:=((target_age is null or target_age between 7 and 11) and p.role in ('parent','player'));
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
    'inbox_allowed',p.role in ('club_admin','coach','assistant_coach','parent'),
    'real_role',real_role,
    'acting_as_parent',(p.role='parent' and real_role<>'parent'),
    'can_have_children',real_role in ('club_admin','coach','assistant_coach'),
    'has_children',exists(select 1 from public.parent_player_links l where l.parent_user_id=p.user_id)
  );
end $$;

create or replace function public.list_parent_player_links(p_parent_user_id uuid default null::uuid, p_team_id uuid default null::uuid)
 returns table(id uuid, club_id uuid, team_id uuid, parent_user_id uuid, player_name text, shirt_number integer, created_at timestamp with time zone)
 language plpgsql stable security definer set search_path to 'public' as $$
declare me public.profiles; target uuid; team_age integer;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is not null then me.role:=private.effective_role(me); end if;
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
  me.role:=private.effective_role(me);
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

create or replace function private.can_message_user(p_recipient uuid)
 returns boolean language sql stable security definer set search_path to '' as $$
  select exists(
    select 1
    from public.profiles me
    join public.profiles target on target.user_id=p_recipient
    cross join lateral (select private.effective_role(me) as r) er
    cross join lateral (select private.effective_role(target) as r) tr
    where me.user_id=auth.uid() and me.club_id is not null and target.club_id=me.club_id and target.user_id<>me.user_id
      and target.role in ('club_admin','coach','assistant_coach','parent')
      and (
        er.r='club_admin'
        or (er.r in ('coach','assistant_coach') and (
              target.role='club_admin'
              or (tr.r='parent' and exists(select 1 from public.parent_player_links ppl
                    where ppl.parent_user_id=target.user_id and ppl.team_id=coalesce(me.coach_team_id,me.team_id)))))
        or (er.r='parent' and (
              target.role='club_admin'
              or (target.role in ('coach','assistant_coach') and exists(select 1 from public.parent_player_links ppl
                    where ppl.parent_user_id=me.user_id and ppl.team_id=coalesce(target.coach_team_id,target.team_id)))))
      )
  )
$$;

create or replace function public.list_announcements_for_me()
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  me public.profiles; my_age integer; result jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.club_id is null then return '[]'::jsonb; end if;
  me.role:=private.effective_role(me);
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

-- 9. New functions are for signed-in users only
revoke all on function public.set_my_capacity(boolean) from public, anon;
revoke all on function public.request_child_link(uuid,text) from public, anon;
grant execute on function public.set_my_capacity(boolean) to authenticated;
grant execute on function public.request_child_link(uuid,text) to authenticated;

-- 016: a coach is notified for EVERY team they are assigned to, whichever team is active (Mike, 10 Oct 2026). DRAFT, not applied.
-- REQUIRES 015 to be applied first (it replaces the 015 version of list_announcements_for_me).
-- Permissions are NOT changed: editing, approving and messaging still follow the active team. This only widens who is TOLD.
--  1. private.assigned_team_ids(user): every team the person is assigned to (coach_team_assignments) plus their active team.
--  2. request_parent_access: coaches of the requested team are notified even when another of their teams is active.
--  2b. request_child_link (015): same rule for the 'link my child' request.
--  3. list_announcements_for_me: team and age-group announcements reach staff on any assigned team (and count them as recipients).
-- Not included on purpose (permission changes, need Mike's word): approving requests, and parent/coach messaging for a non-active team.

create or replace function private.assigned_team_ids(p_user uuid)
 returns setof uuid language sql stable security definer set search_path to '' as $$
  select a.team_id from public.coach_team_assignments a where a.user_id=p_user
  union
  select coalesce(p.coach_team_id,p.team_id) from public.profiles p
  where p.user_id=p_user and coalesce(p.coach_team_id,p.team_id) is not null
$$;
revoke all on function private.assigned_team_ids(uuid) from public, anon, authenticated;

create or replace function public.request_parent_access(p_team_id uuid, p_child_name text)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  me public.profiles;
  target public.teams;
  nm text:=regexp_replace(trim(coalesce(p_child_name,'')),'\s+',' ','g');
  req public.parent_access_requests;
  parent_name text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;

  select * into me from public.profiles where user_id=auth.uid() for update;
  if me.user_id is null then raise exception 'No profile found'; end if;
  if me.role not in ('pending','pending_parent','parent') then
    raise exception 'This account cannot request parent access';
  end if;
  if length(nm)<2 or length(nm)>80 then
    raise exception 'Enter the child or player name';
  end if;

  select * into target from public.teams where id=p_team_id and active=true;
  if target.id is null then raise exception 'Team not available'; end if;

  if me.club_id is not null and me.club_id<>target.club_id then
    raise exception 'All children on one parent account must belong to the same club';
  end if;

  if me.role='pending' then
    update public.profiles
    set club_id=target.club_id,
        team_id=target.id,
        role='pending_parent',
        access_method='email',
        approved_at=null,
        approved_by=null,
        updated_at=now()
    where user_id=auth.uid()
    returning full_name into parent_name;
  elsif me.role='pending_parent' then
    update public.profiles
    set club_id=coalesce(club_id,target.club_id),
        team_id=coalesce(team_id,target.id),
        access_method='email',
        updated_at=now()
    where user_id=auth.uid()
    returning full_name into parent_name;
  else
    update public.profiles
    set updated_at=now()
    where user_id=auth.uid()
    returning full_name into parent_name;
  end if;

  insert into public.parent_access_requests(
    user_id,club_id,team_id,child_name,status,updated_at,reviewed_at,reviewed_by
  )
  values(auth.uid(),target.club_id,target.id,nm,'pending',now(),null,null)
  on conflict (user_id,team_id,child_name)
  do update set status='pending',updated_at=now(),reviewed_at=null,reviewed_by=null
  returning * into req;

  insert into public.app_notifications(
    club_id,team_id,recipient_user_id,type,title,body,entity_key
  )
  select
    target.club_id,
    target.id,
    staff.user_id,
    'parent_access_request',
    'Parent access request',
    coalesce(nullif(parent_name,''),'A parent') || ' requested access for ' || nm || '. Review Team access before approving.',
    'parent-access-request:' || req.id::text
  from public.profiles staff
  where staff.club_id=target.club_id
    and staff.role in ('club_admin','coach','assistant_coach')
    and (
      staff.role='club_admin'
      or target.id in (select private.assigned_team_ids(staff.user_id))
    )
  on conflict(recipient_user_id,type,entity_key) where entity_key is not null
  do update set created_at=now(),read_at=null,body=excluded.body;

  return jsonb_build_object(
    'ok',true,
    'request_id',req.id,
    'club_id',target.club_id,
    'team_id',target.id,
    'child_name',nm,
    'status','pending'
  );
end $$;

create or replace function public.list_announcements_for_me()
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  me public.profiles; result jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.club_id is null then return '[]'::jsonb; end if;
  me.role:=private.effective_role(me);
  if me.role='player' and exists (
    select 1 from public.teams t where t.id=me.team_id and t.club_id=me.club_id
      and public.team_player_age(t.age_group,t.selkent_label) between 7 and 16
  ) then return '[]'::jsonb; end if;
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
              or (a.audience='team' and a.team_id in (select private.assigned_team_ids(p2.user_id)))
              or (a.audience='age_group' and exists(select 1 from public.teams ta where ta.id in (select private.assigned_team_ids(p2.user_id)) and ta.age_group=a.age_group)))
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
              or (me.role<>'parent' and a.team_id in (select private.assigned_team_ids(me.user_id)))))
        or (a.audience='age_group' and (
              (me.role='parent' and exists(select 1 from public.parent_player_links ppl join public.teams pt on pt.id=ppl.team_id where ppl.parent_user_id=me.user_id and pt.age_group=a.age_group))
              or (me.role<>'parent' and exists(select 1 from public.teams ta where ta.id in (select private.assigned_team_ids(me.user_id)) and ta.age_group=a.age_group))))
      )
    order by a.pinned desc,a.important desc,a.created_at desc
    limit 50
  ) q;
  return result;
end $$;

create or replace function public.request_child_link(p_team_id uuid, p_child_name text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  me public.profiles; target public.teams; nm text:=regexp_replace(trim(coalesce(p_child_name,'')),'\s+',' ','g');
  req public.parent_access_requests;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into me from public.profiles where user_id=auth.uid() for update;
  if me.user_id is null or me.role not in ('club_admin','coach','assistant_coach') then
    raise exception 'This is for coaches and Club Admins. Parents use the parent sign-up.';
  end if;
  if length(nm)<2 or length(nm)>80 then raise exception 'Enter your child''s name'; end if;
  select * into target from public.teams where id=p_team_id and active=true;
  if target.id is null or target.club_id is distinct from me.club_id then raise exception 'Team not available'; end if;
  if exists(select 1 from public.parent_player_links l where l.parent_user_id=me.user_id and l.team_id=target.id
            and public.team_identity_norm(l.player_name)=public.team_identity_norm(nm)) then
    raise exception 'That child is already linked to your account';
  end if;

  insert into public.parent_access_requests(user_id,club_id,team_id,child_name,status,updated_at,reviewed_at,reviewed_by)
  values(me.user_id,target.club_id,target.id,nm,'pending',now(),null,null)
  on conflict (user_id,team_id,child_name)
  do update set status='pending',updated_at=now(),reviewed_at=null,reviewed_by=null
  returning * into req;

  insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key)
  select target.club_id,target.id,staff.user_id,'parent_access_request','Child link request',
         coalesce(nullif(me.full_name,''),'A coach')||' asked to link their child '||nm||'. Someone other than them must approve it.',
         'parent-access-request:'||req.id::text
  from public.profiles staff
  where staff.club_id=target.club_id and staff.user_id<>me.user_id
    and staff.role in ('club_admin','coach','assistant_coach')
    and (staff.role='club_admin' or target.id in (select private.assigned_team_ids(staff.user_id)))
  on conflict(recipient_user_id,type,entity_key) where entity_key is not null
  do update set created_at=now(),read_at=null,body=excluded.body;

  return jsonb_build_object('ok',true,'request_id',req.id,'team_id',target.id,'child_name',nm,'status','pending');
end $$;

do $$
declare
  r text := ''; c record; o uuid; act uuid; d record; par record; res jsonb; rid text; n int; cnt int; ann uuid; seen boolean; cl uuid;
begin
  -- a coach assigned to two or more teams, with a team that is NOT their active one
  select p.user_id, p.club_id, coalesce(p.coach_team_id,p.team_id) as act into c
  from public.profiles p
  where p.role='coach' and p.club_id is not null
    and (select count(distinct a.team_id) from public.coach_team_assignments a where a.user_id=p.user_id)>=2
  order by p.created_at limit 1;
  if c.user_id is null then raise exception 'TEST SETUP: no coach with two assigned teams found'; end if;
  act:=c.act;
  select a.team_id into o from public.coach_team_assignments a where a.user_id=c.user_id and a.team_id<>act limit 1;
  r := r || E'\nINFO coach ' || left(c.user_id::text,8) || ' active team ' || left(act::text,8) || ', other assigned team ' || left(o::text,8);

  -- a coach/assistant who is NOT assigned to team o (control)
  select p.user_id, p.club_id into d from public.profiles p
  where p.role in ('coach','assistant_coach') and p.club_id=c.club_id and p.user_id<>c.user_id
    and not exists(select 1 from public.coach_team_assignments a where a.user_id=p.user_id and a.team_id=o)
    and coalesce(p.coach_team_id,p.team_id) is distinct from o
  order by p.created_at limit 1;

  r := r || E'\n' || case when o in (select private.assigned_team_ids(c.user_id)) and act in (select private.assigned_team_ids(c.user_id)) then 'PASS assigned_team_ids returns the active and the other assigned team' else 'FAIL assigned_team_ids' end;
  if d.user_id is not null then
    r := r || E'\n' || case when o not in (select private.assigned_team_ids(d.user_id)) then 'PASS assigned_team_ids excludes a team the person is not on' else 'FAIL assigned_team_ids leaks' end;
  end if;

  -- 1. parent access request on the NON-active team notifies the coach
  select p.user_id into par from public.profiles p where p.role='parent' and p.club_id=c.club_id limit 1;
  if par.user_id is null then raise exception 'TEST SETUP: no parent account'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub',par.user_id,'role','authenticated')::text, true);
  set local role authenticated;
  res := public.request_parent_access(o,'Test Child Sixteen');
  reset role;
  rid := 'parent-access-request:'||(res->>'request_id');
  select count(*) into n from public.app_notifications x where x.recipient_user_id=c.user_id and x.entity_key=rid;
  r := r || E'\n' || case when n=1 then 'PASS coach notified of a parent request on their NON-active team' else 'FAIL coach not notified (' || n || ')' end;
  if d.user_id is not null then
    select count(*) into n from public.app_notifications x where x.recipient_user_id=d.user_id and x.entity_key=rid;
    r := r || E'\n' || case when n=0 then 'PASS a coach not on that team is not notified' else 'FAIL unrelated coach notified' end;
  end if;
  select count(*) into n from public.app_notifications x join public.profiles pa on pa.user_id=x.recipient_user_id and pa.role='club_admin' where x.entity_key=rid;
  r := r || E'\n' || case when n>=1 then 'PASS Club Admins still notified' else 'FAIL Club Admins not notified' end;

  -- 2. team announcement for the NON-active team reaches the coach; control: not the unassigned coach
  insert into public.club_announcements(club_id,title,body,audience,team_id) values(c.club_id,'T016 team note','x','team',o) returning id into ann;
  perform set_config('request.jwt.claims', json_build_object('sub',c.user_id,'role','authenticated')::text, true);
  set local role authenticated;
  select exists(select 1 from jsonb_array_elements(public.list_announcements_for_me()) e where e->>'id'=ann::text) into seen;
  reset role;
  r := r || E'\n' || case when seen then 'PASS coach sees a team announcement for a non-active assigned team' else 'FAIL coach does not see it' end;
  if d.user_id is not null then
    perform set_config('request.jwt.claims', json_build_object('sub',d.user_id,'role','authenticated')::text, true);
    set local role authenticated;
    select exists(select 1 from jsonb_array_elements(public.list_announcements_for_me()) e where e->>'id'=ann::text) into seen;
    reset role;
    r := r || E'\n' || case when not seen then 'PASS a coach not on that team does not see it' else 'FAIL unrelated coach sees it' end;
  end if;

  -- 3. the coach's own-team announcement still works (control)
  insert into public.club_announcements(club_id,title,body,audience,team_id) values(c.club_id,'T016 active note','x','team',act) returning id into ann;
  perform set_config('request.jwt.claims', json_build_object('sub',c.user_id,'role','authenticated')::text, true);
  set local role authenticated;
  select exists(select 1 from jsonb_array_elements(public.list_announcements_for_me()) e where e->>'id'=ann::text) into seen;
  reset role;
  r := r || E'\n' || case when seen then 'PASS active-team announcement still shown' else 'FAIL active-team announcement lost' end;

  -- 4. a parent still sees only announcements for their own children's teams
  perform set_config('request.jwt.claims', json_build_object('sub',par.user_id,'role','authenticated')::text, true);
  set local role authenticated;
  select exists(select 1 from jsonb_array_elements(public.list_announcements_for_me()) e where e->>'title' like 'T016%') into seen;
  reset role;
  r := r || E'\n' || case when not seen or exists(select 1 from public.parent_player_links l where l.parent_user_id=par.user_id and l.team_id in (o,act)) then 'PASS parent sees team announcements only for linked teams' else 'FAIL parent sees an unrelated team announcement' end;

  -- 5. own-child link request (015) also reaches every assigned team's coach
  if d.user_id is not null then
    perform set_config('request.jwt.claims', json_build_object('sub',d.user_id,'role','authenticated')::text, true);
    set local role authenticated;
    res := public.request_child_link(o,'Test Child Link Sixteen');
    reset role;
    rid := 'parent-access-request:'||(res->>'request_id');
    select count(*) into n from public.app_notifications x where x.recipient_user_id=c.user_id and x.entity_key=rid;
    r := r || E'\n' || case when n=1 then 'PASS child-link request notifies the other-team coach' else 'FAIL child-link coach not notified' end;
    select count(*) into n from public.app_notifications x where x.recipient_user_id=d.user_id and x.entity_key=rid;
    r := r || E'\n' || case when n=0 then 'PASS requester does not notify themselves' else 'FAIL requester self-notified' end;
  end if;

  -- 6. permissions unchanged: coach still cannot list pending requests for the non-active team
  perform set_config('request.jwt.claims', json_build_object('sub',c.user_id,'role','authenticated')::text, true);
  set local role authenticated;
  begin perform * from public.list_pending_parent_requests(o); r := r || E'\nFAIL coach can now manage a non-active team (permissions changed)';
  exception when others then r := r || E'\nPASS coach still cannot manage a non-active team (permissions unchanged)'; end;
  reset role;

  raise exception 'TEST RESULTS (nothing was kept):%', r;
end $$;
