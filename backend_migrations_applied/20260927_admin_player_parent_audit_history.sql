-- Keep Audit history limited to Club Admin and player/parent changes.
-- Historical match, formation, and other routine records remain stored, but
-- are no longer returned to the browser. Do not expose full change snapshots.
create or replace function public.list_audit_history(
  p_team_id uuid default null::uuid,
  p_limit integer default 100
)
returns table(
  id bigint, team_id uuid, team_name text, user_id uuid, user_name text,
  action text, entity_type text, entity_id text, summary text,
  before_value jsonb, after_value jsonb, created_at timestamptz
)
language plpgsql
stable security definer
set search_path = ''
as $$
declare me public.profiles; v_limit integer;
begin
  select profile.* into me from public.profiles profile where profile.user_id=auth.uid();
  if me.user_id is null or me.role <> 'club_admin' then
    raise exception 'Club Admin access required';
  end if;
  v_limit:=greatest(1,least(coalesce(p_limit,100),250));
  return query
  select a.id,a.team_id,t.name,a.user_id,coalesce(p.full_name,'System'),
         a.action,a.entity_type,a.entity_id,a.summary,
         null::jsonb,null::jsonb,a.created_at
  from public.audit_log a
  left join public.teams t on t.id=a.team_id
  left join public.profiles p on p.user_id=a.user_id
  where a.club_id=me.club_id
    and (p_team_id is null or a.team_id=p_team_id)
    and (a.entity_type in ('squad','player','parent','parent_access','player_link','safeguarding',
                          'attendance','award','matchday_squad')
      or (a.entity_type='access' and (a.action ~ '^(parent_|player_)'
        or a.action in ('access_removed','pin_reset'))))
  order by a.created_at desc,a.id desc
  limit v_limit;
end
$$;
