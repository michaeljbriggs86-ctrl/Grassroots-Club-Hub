-- 011: the coach list at the top of Club Overview shows the same title as the access list (Developer, Director, Club Secretary).
-- Same permissions as before: signed-in users and service role only. Not applied until Mike runs it.
drop function if exists public.list_club_coaches();
create function public.list_club_coaches()
 returns table(user_id uuid, full_name text, role text, team_id uuid, team_name text, age_group integer, access_method text, created_at timestamptz, club_title text)
 language plpgsql security definer set search_path to 'public' as $function$
declare me public.profiles;
begin
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.role<>'club_admin' then raise exception 'Club Admin access required'; end if;
  return query
  select p.user_id,
         p.full_name,
         case when p.role='club_admin' then 'club_admin' else p.role end,
         case when p.role='club_admin' then p.coach_team_id else p.team_id end,
         t.name,
         t.age_group,
         p.access_method,
         p.created_at,
         p.club_title
  from public.profiles p
  left join public.teams t on t.id=case when p.role='club_admin' then p.coach_team_id else p.team_id end
  where p.club_id=me.club_id
    and ((p.role in ('coach','assistant_coach') and p.team_id is not null)
      or (p.role='club_admin' and p.coach_team_id is not null))
  order by t.age_group,t.name,
           case p.role when 'club_admin' then 0 when 'coach' then 1 else 2 end,
           p.full_name;
end $function$;
revoke all on function public.list_club_coaches() from public, anon;
grant execute on function public.list_club_coaches() to authenticated, service_role;
