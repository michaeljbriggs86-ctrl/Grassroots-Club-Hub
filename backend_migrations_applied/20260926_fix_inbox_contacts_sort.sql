-- Profiles and teams have primary keys on user_id and id respectively.
-- The join cannot duplicate contacts; DISTINCT caused the role-sort expression
-- to fail at runtime with SQLSTATE 42P10.
create or replace function public.list_message_contacts()
returns table(user_id uuid, full_name text, role text, team_id uuid, team_name text, age_group integer)
language plpgsql
security definer
set search_path = ''
as $$
declare me public.profiles;
begin
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.role not in ('club_admin','coach','assistant_coach','parent') then return; end if;

  return query
  select p.user_id,
    p.full_name,
    p.role,
    coalesce(p.coach_team_id,p.team_id),
    t.name,
    t.age_group
  from public.profiles p
  left join public.teams t on t.id=coalesce(p.coach_team_id,p.team_id)
  where p.club_id=me.club_id
    and p.user_id<>me.user_id
    and p.role in ('club_admin','coach','assistant_coach','parent')
    and private.can_message_user(p.user_id)
  order by case p.role when 'club_admin' then 0 when 'coach' then 1 when 'assistant_coach' then 2 else 3 end,
           t.age_group nulls last,t.name nulls last,p.full_name;
end
$$;

-- The contact endpoint is needed by signed-in members only. Keep the same
-- access boundary as the other club message functions.
revoke all on function public.list_message_contacts() from public, anon;
grant execute on function public.list_message_contacts() to authenticated, service_role;
