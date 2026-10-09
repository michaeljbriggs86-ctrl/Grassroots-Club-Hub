-- Live function text as read on 2026-10-10, for rollback and for the local before/after test.
CREATE OR REPLACE FUNCTION public.get_team_state_for_me(p_team_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(team_id uuid, state jsonb, revision bigint, updated_at timestamp with time zone, restricted boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare me public.profiles; target uuid; tm public.teams; ts public.team_state;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null then raise exception 'Authentication required'; end if;
  target:=coalesce(p_team_id,me.coach_team_id,me.team_id);
  if target is null then raise exception 'Team id is required'; end if;
  if not public.can_read_team(target) then raise exception 'You do not have read access to this team'; end if;
  select * into tm from public.teams where id=target;
  select * into ts from public.team_state where public.team_state.team_id=target;
  if ts.team_id is null then return; end if;
  team_id:=target; revision:=ts.revision; updated_at:=ts.updated_at;
  if public.team_player_age(tm.age_group,tm.selkent_label) between 7 and 11 and me.role in ('parent','player') then
    state:=public.sanitize_mini_soccer_state(ts.state,public.team_player_age(tm.age_group,tm.selkent_label));
    restricted:=true;
  elsif public.team_player_age(tm.age_group,tm.selkent_label) between 7 and 11 and me.role in ('club_admin','coach','assistant_coach') then
    state:=private.hydrate_u11_staff_state(target,ts.state);
    restricted:=false;
  else
    state:=ts.state;
    restricted:=false;
  end if;
  return next;
end $function$;

CREATE OR REPLACE FUNCTION public.get_my_context()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  p public.profiles; t public.teams; ct public.teams; c public.clubs; target uuid; ts public.team_state;
  safe_state jsonb; is_restricted boolean:=false; target_age integer;
begin
  select * into p from public.profiles where user_id=auth.uid();
  if p.user_id is null then return null; end if;
  if p.role='parent' then
    select linked.id into target from public.teams linked
    join public.parent_player_links ppl on ppl.team_id=linked.id and ppl.parent_user_id=p.user_id
    where linked.club_id=p.club_id and linked.active=true
    order by case when linked.id=p.team_id then 0 else 1 end,linked.age_group,linked.name limit 1;
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
    else public.team_player_age(t.age_group,t.selkent_label) end;
  if target is not null then
    select * into ts from public.team_state where team_id=target;
    if ts.team_id is not null then
      if target_age between 7 and 11 and p.role in ('parent','player') then
        safe_state:=public.sanitize_mini_soccer_state(ts.state,target_age); is_restricted:=true;
      elsif target_age between 7 and 11 and p.role in ('club_admin','coach','assistant_coach') then
        safe_state:=private.hydrate_u11_staff_state(target,ts.state);
      else safe_state:=ts.state; end if;
    end if;
  end if;
  return jsonb_build_object('profile',to_jsonb(p),'team',case when t.id is null then null else to_jsonb(t) end,
    'coach_team',case when ct.id is null then null else to_jsonb(ct) end,'club',case when c.id is null then null else to_jsonb(c) end,
    'team_state',safe_state,'team_state_revision',case when ts.team_id is null then null else ts.revision end,
    'team_state_restricted',is_restricted,'inbox_allowed',p.role in ('club_admin','coach','assistant_coach','parent'));
end $function$;
