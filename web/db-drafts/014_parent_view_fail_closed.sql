-- 014: parent/player view fails CLOSED when a team's player age is unknown (safeguarding gate G7). DRAFT, not applied.
--
-- Review of private.state_for_viewer / get_team_state_for_me (live, 10 Oct 2026) found the privacy design is sound:
-- parents never receive tactics, cupProgress, match notes, other children's names/shirt numbers, and U7-U11
-- results/scorers are stripped. One fail-open edge exists: if team_player_age() ever returns NULL (for example a
-- new label format such as "U12X" that the age rule does not recognise) or a value below 7, then
--   (a) U7-U11 result stripping is skipped (age not between 7 and 11), and
--   (b) goals/assists/bookings are not filtered to the parent's own children (only awards are).
-- All 18 live teams currently resolve to a valid age, so nothing is exposed today. This closes the gap before it can bite.
--
-- Changes:
--  1. Parent and player views: unknown age is treated as restricted (U7-U11 rules apply).
--  2. Parent view: goals/assists/bookings/awards are ALWAYS filtered to the parent's own children.
--  3. get_team_state_for_me: 'restricted' flag is true for unknown age as well.

create or replace function private.state_for_viewer(p_state jsonb, p_team uuid, p_user uuid, p_role text, p_age integer)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare
  v jsonb; own_norm text[]; own_nums int[]; k text; t public.teams;
  eff_age int := coalesce(p_age, 7);  -- unknown age: apply the strictest (U7-U11) rules to non-staff
begin
  if p_state is null then return null; end if;

  if p_role in ('club_admin','coach','assistant_coach') then
    if p_age between 7 and 11 then return private.hydrate_u11_staff_state(p_team,p_state); end if;
    return p_state;
  end if;

  if p_role = 'player' then
    v := case when eff_age between 7 and 11 then public.sanitize_mini_soccer_state(p_state,eff_age) else p_state end;
    v := v - 'tactics' - 'cupProgress';
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

  v := case when eff_age between 7 and 11 then public.sanitize_mini_soccer_state(p_state,eff_age) else p_state end;
  v := v - 'tactics' - 'cupProgress';
  select * into t from public.teams where id=p_team;

  select coalesce(array_agg(public.team_identity_norm(l.player_name)),'{}') into own_norm
  from public.parent_player_links l where l.parent_user_id=p_user and l.team_id=p_team;

  select coalesce(array_agg(i.shirt_number),'{}') into own_nums
  from private.player_season_identity i
  where i.team_id=p_team and i.season=coalesce(t.season,'Unknown')
    and public.team_identity_norm(i.player_name)=any(own_norm) and i.shirt_number is not null;

  if jsonb_typeof(v->'squad')='array' then
    v := jsonb_set(v,'{squad}',coalesce((select jsonb_agg(e) from jsonb_array_elements(v->'squad') e
         where public.team_identity_norm(e->>'name')=any(own_norm)),'[]'::jsonb));
  end if;
  if jsonb_typeof(v->'tournaments')='array' then
    v := jsonb_set(v,'{tournaments}',coalesce((select jsonb_agg(e - 'playerNames') from jsonb_array_elements(v->'tournaments') e),'[]'::jsonb));
  end if;
  if jsonb_typeof(v->'matches')='array' then
    v := jsonb_set(v,'{matches}',coalesce((select jsonb_agg(e - 'notes') from jsonb_array_elements(v->'matches') e),'[]'::jsonb));
  end if;
  -- Always filter personal records to the parent's own children, at every age.
  foreach k in array array['goals','assists','bookings','awards'] loop
    if jsonb_typeof(v->k)='array' then
      v := jsonb_set(v,array[k],coalesce((select jsonb_agg(e) from jsonb_array_elements(v->k) e
           where (e->>'shirtNumber') ~ '^[0-9]+$' and (e->>'shirtNumber')::int = any(own_nums)),'[]'::jsonb));
    end if;
  end loop;
  return v;
end $$;

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
end $$;

-- Rollback: re-run the two function definitions from 013's predecessor (see Supabase function history), or ask Claude.
