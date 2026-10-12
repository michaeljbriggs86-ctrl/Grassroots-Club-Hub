-- Narrow Admin-only action. Existing squad-edit permissions remain unchanged.
-- No child rows are created by applying this migration.
create function private.admin_onboard_player(
  p_team_id uuid, p_player_name text, p_shirt_number integer,
  p_player_role text, p_parent_request_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me public.profiles; tm public.teams; ts public.team_state;
  nm text := btrim(coalesce(p_player_name,''));
  age integer; squad_limit integer; working jsonb; stored jsonb;
  new_revision bigint; stamp timestamptz; approved jsonb;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role<>'club_admin' or to_jsonb(me)->>'acting_as_parent'='true' then raise exception 'Club Admin access required'; end if;
  select * into tm from public.teams where id=p_team_id and club_id=me.club_id and active=true for update;
  if tm.id is null then raise exception 'Team not available'; end if;
  if char_length(nm)<2 or char_length(nm)>80 then raise exception 'Enter a player name between 2 and 80 characters'; end if;
  if nm ~ '[[:cntrl:]]' then raise exception 'Player names cannot contain control characters'; end if;
  if p_shirt_number is null or p_shirt_number not between 1 and 99 then raise exception 'Choose a shirt number from 1 to 99'; end if;
  if p_player_role is null or p_player_role not in ('outfield','goalkeeper') then raise exception 'Choose an outfield player or goalkeeper'; end if;
  age := public.team_player_age(tm.age_group,tm.selkent_label);
  if age is null or age<7 then raise exception 'Team age group needs to be configured first'; end if;
  select max_registered into squad_limit from public.competition_rules where club_id=me.club_id and age_group=age;
  if squad_limit is null or squad_limit<1 then raise exception 'Set the team registration limit in club settings first'; end if;

  select * into ts from public.team_state where team_id=tm.id for update;
  working := coalesce(ts.state,jsonb_build_object('meta',jsonb_build_object('teamName',tm.name,'ageGroup','U'||age::text,'season',tm.season),'squad','[]'::jsonb));
  if jsonb_typeof(working)<>'object' then raise exception 'Team squad needs review'; end if;
  if working ? 'squad' and jsonb_typeof(working->'squad')<>'array' then raise exception 'Team squad needs review'; end if;
  working := jsonb_set(working,'{squad}',coalesce(working->'squad','[]'::jsonb),true);
  if age between 7 and 11 then working := private.hydrate_u11_staff_state(tm.id,working); end if;
  if exists(select 1 from jsonb_array_elements(working->'squad') p where public.team_identity_norm(p->>'name')=public.team_identity_norm(nm)) then
    raise exception 'A player with this name is already in this squad';
  end if;
  if exists(select 1 from jsonb_array_elements(working->'squad') p where p->>'number'=p_shirt_number::text) then
    raise exception 'This shirt number is already assigned';
  end if;
  if (select count(*) from jsonb_array_elements(working->'squad') p where nullif(btrim(p->>'name'),'') is not null)>=squad_limit then
    raise exception 'The squad registration limit has been reached';
  end if;
  -- Validate the optional request before changing the squad.
  if p_parent_request_id is not null and not exists(
    select 1 from public.parent_access_requests r where r.id=p_parent_request_id
      and r.team_id=tm.id and r.club_id=me.club_id and r.status='pending' and r.user_id<>auth.uid()
  ) then raise exception 'This parent request is no longer available for this team'; end if;
  working := jsonb_set(working,'{squad}',(working->'squad')||jsonb_build_array(jsonb_build_object('name',nm,'number',p_shirt_number,'role',p_player_role,'status','active')),true);
  stored := case when age between 7 and 11 then private.normalize_u11_state(tm.id,working) else working end;
  stamp := now();new_revision:=coalesce(ts.revision,-1)+1;
  if ts.team_id is null then
    insert into public.team_state(team_id,state,revision,updated_at,updated_by) values(tm.id,stored,new_revision,stamp,auth.uid());
  else
    insert into public.team_state_history(team_id,revision,state,archived_at,archived_by) values(tm.id,ts.revision,ts.state,stamp,auth.uid());
    update public.team_state set state=stored,revision=new_revision,updated_at=stamp,updated_by=auth.uid() where team_id=tm.id;
    delete from public.team_state_history h where h.team_id=tm.id and h.id not in(
      select h2.id from public.team_state_history h2 where h2.team_id=tm.id order by h2.revision desc,h2.id desc limit 50
    );
  end if;
  -- The existing approval function checks the real active squad player and account.
  -- Any approval failure rolls back the player, identity mapping and history too.
  if p_parent_request_id is not null then approved:=public.approve_parent_request(p_parent_request_id,nm); end if;
  return jsonb_build_object('ok',true,'team_id',tm.id,'player_name',nm,'shirt_number',p_shirt_number,'revision',new_revision,'parent_linked',p_parent_request_id is not null);
end $$;
revoke all on function private.admin_onboard_player(uuid,text,integer,text,uuid) from public,anon,authenticated;

create function public.admin_onboard_player(
  p_team_id uuid, p_player_name text, p_shirt_number integer,
  p_player_role text, p_parent_request_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='club_admin' and coalesce(to_jsonb(p)->>'acting_as_parent','false')<>'true') then
    raise exception 'Club Admin access required';
  end if;
  return private.admin_onboard_player(p_team_id,p_player_name,p_shirt_number,p_player_role,p_parent_request_id);
end $$;
revoke all on function public.admin_onboard_player(uuid,text,integer,text,uuid) from public,anon;
grant execute on function public.admin_onboard_player(uuid,text,integer,text,uuid) to authenticated;
