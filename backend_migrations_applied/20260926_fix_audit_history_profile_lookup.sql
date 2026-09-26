-- The RETURNS TABLE user_id column is a PL/pgSQL output variable.
-- Qualify the profile column so coaches and Club Admin can open Audit History.
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
  if me.user_id is null or me.role not in ('club_admin','coach','assistant_coach') then
    raise exception 'Coaching staff or Club Admin access required';
  end if;
  v_limit:=greatest(1,least(coalesce(p_limit,100),250));
  return query
  select a.id,a.team_id,t.name,a.user_id,coalesce(p.full_name,'System'),
         a.action,a.entity_type,a.entity_id,a.summary,a.before_value,a.after_value,a.created_at
  from public.audit_log a
  left join public.teams t on t.id=a.team_id
  left join public.profiles p on p.user_id=a.user_id
  where a.club_id=me.club_id
    and (case when me.role='club_admin' then (p_team_id is null or a.team_id=p_team_id)
              else a.team_id=me.team_id end)
  order by a.created_at desc
  limit v_limit;
end
$$;
