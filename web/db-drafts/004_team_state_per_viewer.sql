-- Step 3: one function decides what team state each viewer gets; both read paths use it.
-- Rules (Mike, 2026-10-10): a parent sees only data strictly related to their own children (name, goals, awards); no other
-- player names; U11 and under keep the existing scoreless rules; tactics are staff only;
-- coach notes are never sent to parents. Unknown or pending roles get NO state (default deny).
-- Fixes a hole: get_my_context returned the raw team state to ANY non-parent role with a team_id,
-- including pending_parent, pending_coach (added in step 1) and pending_player.
-- Rollback: restore get_my_context and get_team_state_for_me from test/04_originals.sql, then
--           drop function private.state_for_viewer.
create or replace function private.state_for_viewer(p_state jsonb, p_team uuid, p_user uuid, p_role text, p_age integer)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v jsonb; own_norm text[]; own_nums int[]; k text; t public.teams;
begin
  if p_state is null then return null; end if;

  if p_role in ('club_admin','coach','assistant_coach') then
    if p_age between 7 and 11 then return private.hydrate_u11_staff_state(p_team,p_state); end if;
    return p_state;
  end if;

  if p_role = 'player' then
    -- U15 player: teammates by first name only (Mike, 2026-10-10); no tactics; no coach notes
    -- (the U15 privacy working copy excludes private coach notes).
    v := case when p_age between 7 and 11 then public.sanitize_mini_soccer_state(p_state,p_age) else p_state end;
    v := v - 'tactics';
    if jsonb_typeof(v->'squad')='array' then
      v := jsonb_set(v,'{squad}',coalesce((select jsonb_agg(case when e ? 'name' then jsonb_set(e,'{name}',to_jsonb(split_part(btrim(e->>'name'),' ',1))) else e end)
           from jsonb_array_elements(v->'squad') e),'[]'::jsonb));
    end if;
    if jsonb_typeof(v->'tournaments')='array' then
      v := jsonb_set(v,'{tournaments}',coalesce((select jsonb_agg(case when jsonb_typeof(e->'playerNames')='array'
           then jsonb_set(e,'{playerNames}',coalesce((select jsonb_agg(split_part(btrim(n #>> '{}'),' ',1)) from jsonb_array_elements(e->'playerNames') n),'[]'::jsonb)) else e end)
           from jsonb_array_elements(v->'tournaments') e),'[]'::jsonb));
    end if;
    if jsonb_typeof(v->'matches')='array' then
      v := jsonb_set(v,'{matches}',coalesce((select jsonb_agg(e - 'notes') from jsonb_array_elements(v->'matches') e),'[]'::jsonb));
    end if;
    return v;
  end if;

  if p_role <> 'parent' then return null; end if;

  -- parent
  v := case when p_age between 7 and 11 then public.sanitize_mini_soccer_state(p_state,p_age) else p_state end;
  v := v - 'tactics';
  select * into t from public.teams where id=p_team;

  select coalesce(array_agg(public.team_identity_norm(l.player_name)),'{}') into own_norm
  from public.parent_player_links l where l.parent_user_id=p_user and l.team_id=p_team;

  select coalesce(array_agg(i.shirt_number),'{}') into own_nums
  from private.player_season_identity i
  where i.team_id=p_team and i.season=coalesce(t.season,'Unknown')
    and public.team_identity_norm(i.player_name)=any(own_norm) and i.shirt_number is not null;

  -- squad: own children only
  if jsonb_typeof(v->'squad')='array' then
    v := jsonb_set(v,'{squad}',coalesce((select jsonb_agg(e) from jsonb_array_elements(v->'squad') e
         where public.team_identity_norm(e->>'name')=any(own_norm)),'[]'::jsonb));
  end if;
  -- tournaments: no player name lists
  if jsonb_typeof(v->'tournaments')='array' then
    v := jsonb_set(v,'{tournaments}',coalesce((select jsonb_agg(e - 'playerNames') from jsonb_array_elements(v->'tournaments') e),'[]'::jsonb));
  end if;
  -- matches: never send coach notes to parents
  if jsonb_typeof(v->'matches')='array' then
    v := jsonb_set(v,'{matches}',coalesce((select jsonb_agg(e - 'notes') from jsonb_array_elements(v->'matches') e),'[]'::jsonb));
  end if;
  -- A parent only ever sees data strictly about their own children (Mike, 2026-10-10).
  -- Awards: own children only, at every age (matched by shirt number, own number comes from the club's records).
  -- Goals, assists and bookings: own children only for U12 and above (U7-U11 are already emptied above).
  foreach k in array case when p_age >= 12 then array['goals','assists','bookings','awards'] else array['awards'] end loop
    if jsonb_typeof(v->k)='array' then
      v := jsonb_set(v,array[k],coalesce((select jsonb_agg(e) from jsonb_array_elements(v->k) e
           where (e->>'shirtNumber') ~ '^[0-9]+$' and (e->>'shirtNumber')::int = any(own_nums)),'[]'::jsonb));
    end if;
  end loop;
  return v;
end $function$;
revoke all on function private.state_for_viewer(jsonb,uuid,uuid,text,integer) from public, anon, authenticated;

create or replace function public.get_team_state_for_me(p_team_id uuid DEFAULT NULL::uuid)
returns table(team_id uuid, state jsonb, revision bigint, updated_at timestamp with time zone, restricted boolean)
language plpgsql stable security definer set search_path to 'public' as $function$
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
  restricted:=(age between 7 and 11 and me.role in ('parent','player'));
  return next;
end $function$;

create or replace function public.get_my_context()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
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
end $function$;
