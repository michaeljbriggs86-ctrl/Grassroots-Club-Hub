-- PROPOSED FIX. NOT APPLIED to Supabase. Differences from the live function:
--  1. 'player' invites map to role 'player' (never 'coach'), only for U15 teams, never auto-approved.
--  2. Any other unrecognised invite role raises instead of becoming an approved coach.
CREATE OR REPLACE FUNCTION public.claim_invite(p_code text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
declare
  inv public.invitations; p public.profiles; t public.teams; v_role text; v_email text; v_meta jsonb; v_access_method text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into inv from public.invitations
  where code_hash=extensions.digest(trim(p_code),'sha256') and used_at is null and expires_at>now()
  order by created_at desc limit 1 for update;
  if inv.id is null then raise exception 'Invite is invalid, expired, or already used'; end if;
  select * into p from public.profiles where user_id=auth.uid() for update;
  if p.user_id is null then raise exception 'No profile found'; end if;
  if p.role='club_admin' then raise exception 'Club Admin accounts cannot claim team invites'; end if;
  select * into t from public.teams where id=inv.team_id;
  if inv.role='player' and (t.id is null or t.age_group is distinct from 15) then
    raise exception 'Player app access is only available to U15 squads'; end if;
  select u.email, u.raw_user_meta_data into v_email, v_meta from auth.users u where u.id=auth.uid();
  if inv.invited_email is not null and lower(trim(inv.invited_email)) <> lower(trim(coalesce(v_email,''))) then
    raise exception 'This invitation was issued to a different email address'; end if;
  v_access_method := case when coalesce(v_meta->>'invite_access','')='true' or coalesce(v_email,'') ~* '@access[.][^@]+[.]app$' then 'invite' else 'email' end;
  if inv.role='club_admin' then
    if p.role is distinct from 'pending' or v_access_method <> 'email' then
      raise exception 'Create a new verified email account to claim a Club Admin invite'; end if;
    if not exists (select 1 from public.profiles issuer where issuer.user_id=inv.created_by and issuer.club_id=inv.club_id and issuer.role='club_admin')
    then raise exception 'Club Admin invitation is no longer valid'; end if;
  end if;
  v_role=case when inv.role='club_admin' then 'club_admin' when inv.role='parent' then 'pending_parent'
              when inv.role='assistant_coach' then 'assistant_coach' when inv.role='coach' then 'coach'
              when inv.role='player' then 'player' else null end;
  if v_role is null then raise exception 'Unsupported invite role'; end if;
  update public.profiles set club_id=inv.club_id, team_id=inv.team_id, role=v_role, access_method=v_access_method,
      approved_at=case when inv.role in ('club_admin','coach','assistant_coach') then now() else null end,
      approved_by=case when inv.role in ('club_admin','coach','assistant_coach') then inv.created_by else null end,
      updated_at=now() where user_id=auth.uid();
  update public.invitations set used_at=now(),used_by=auth.uid() where id=inv.id;
  return jsonb_build_object('role',v_role,'team',to_jsonb(t),'approval_required',inv.role='parent','access_method',v_access_method);
end $function$;
