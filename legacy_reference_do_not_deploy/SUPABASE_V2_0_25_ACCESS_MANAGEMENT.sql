-- AI COLLABORATION PROTOCOL NOTE — 2026-09-19
-- STATUS: WRITTEN historical reference only; DO NOT DEPLOY.
-- Any older 'live'/'deployed' wording below is a historical note and is not a current deployment claim.

-- v2.0.25 Club Admin consolidated access list
create or replace function public.list_club_access_accounts()
returns table(
  user_id uuid,
  full_name text,
  role text,
  team_id uuid,
  coach_team_id uuid,
  team_name text,
  age_group integer,
  access_method text,
  approved_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = 'public'
as $$
declare me public.profiles;
begin
  select p.* into me from public.profiles p where p.user_id = auth.uid();
  if me.user_id is null or me.role <> 'club_admin' then raise exception 'Club Admin access required'; end if;
  return query
  select p.user_id,p.full_name,p.role,p.team_id,p.coach_team_id,coalesce(t.name,ct.name),coalesce(t.age_group,ct.age_group),p.access_method,p.approved_at,p.created_at
  from public.profiles p
  left join public.teams t on t.id=p.team_id
  left join public.teams ct on ct.id=p.coach_team_id
  where p.club_id=me.club_id and p.role in ('club_admin','coach','assistant_coach','parent','pending_parent')
  order by case p.role when 'club_admin' then 0 when 'coach' then 1 when 'assistant_coach' then 2 when 'pending_parent' then 3 else 4 end,
           coalesce(t.age_group,ct.age_group) nulls last,coalesce(t.name,ct.name) nulls last,p.full_name;
end $$;
revoke execute on function public.list_club_access_accounts() from public, anon;
grant execute on function public.list_club_access_accounts() to authenticated;
