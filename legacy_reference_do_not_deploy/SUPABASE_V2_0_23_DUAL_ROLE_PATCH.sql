-- AI COLLABORATION PROTOCOL NOTE — 2026-09-19
-- STATUS: WRITTEN historical reference only; DO NOT DEPLOY.
-- Any older 'live'/'deployed' wording below is a historical note and is not a current deployment claim.

-- v2.0.23 dual Club Admin + Coach support
-- Applied to the live project on 2026-09-14.
-- Dual-role Club Admins keep role='club_admin' and store their coaching team in coach_team_id.

create or replace function public.list_club_coaches()
returns table(user_id uuid, full_name text, role text, team_id uuid, team_name text, age_group integer, access_method text, created_at timestamptz)
language plpgsql security definer set search_path to 'public'
as $$
declare me public.profiles;
begin
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.role<>'club_admin' then raise exception 'Club Admin access required'; end if;
  return query
  select p.user_id,p.full_name,p.role,
         case when p.role='club_admin' then p.coach_team_id else p.team_id end,
         t.name,t.age_group,p.access_method,p.created_at
  from public.profiles p
  left join public.teams t on t.id=case when p.role='club_admin' then p.coach_team_id else p.team_id end
  where p.club_id=me.club_id
    and ((p.role in ('coach','assistant_coach') and p.team_id is not null)
      or (p.role='club_admin' and p.coach_team_id is not null))
  order by t.age_group,t.name,case p.role when 'club_admin' then 0 when 'coach' then 1 else 2 end,p.full_name;
end $$;

create or replace function public.list_team_members(p_team_id uuid default null)
returns table(user_id uuid, full_name text, role text, access_method text, created_at timestamptz, approved_at timestamptz)
language plpgsql stable security definer set search_path to 'public'
as $$
declare me public.profiles; target_team uuid;
begin
  select * into me from public.profiles where profiles.user_id=auth.uid();
  if me.role not in ('club_admin','coach','assistant_coach') then raise exception 'Coaching staff or Club Admin access required'; end if;
  target_team=coalesce(p_team_id,me.team_id,me.coach_team_id);
  if target_team is null then raise exception 'Choose a team'; end if;
  if me.role in ('coach','assistant_coach') and target_team<>me.team_id then raise exception 'You can only manage your own team'; end if;
  if not exists(select 1 from public.teams t where t.id=target_team and t.club_id=me.club_id) then raise exception 'Team not available'; end if;
  return query
    select p.user_id,p.full_name,p.role,p.access_method,p.created_at,p.approved_at
    from public.profiles p
    where (p.team_id=target_team and p.role in ('coach','assistant_coach','parent','pending_parent'))
       or (p.coach_team_id=target_team and p.role='club_admin')
    order by case p.role when 'pending_parent' then 0 when 'club_admin' then 1 when 'coach' then 2 when 'assistant_coach' then 3 else 4 end,p.full_name;
end $$;


create or replace function public.remove_club_coach(p_user_id uuid)
returns boolean
language plpgsql security definer set search_path to 'public'
as $$
declare me public.profiles; target public.profiles;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role<>'club_admin' then raise exception 'Club Admin access required'; end if;
  select * into target from public.profiles where user_id=p_user_id for update;
  if target.user_id is null or target.club_id<>me.club_id then raise exception 'Coaching access not found'; end if;
  if target.role='club_admin' then
    if target.coach_team_id is null then raise exception 'This Club Admin has no coaching assignment'; end if;
    update public.profiles set coach_team_id=null,updated_at=now() where user_id=p_user_id;
  elsif target.role in ('coach','assistant_coach') then
    update public.profiles set role='revoked',team_id=null,coach_team_id=null,approved_at=null,approved_by=auth.uid(),updated_at=now() where user_id=p_user_id;
  else
    raise exception 'Coaching access not found';
  end if;
  return true;
end $$;
