-- 008: club owner flag, Club Admin sign-up requests, and retiring adult invite codes (Mike, 2026-10-10).
-- Decisions: no invite codes for any adult; a second Club Admin signs up by email and only the club owner approves.
-- is_owner has no write policy and no RPC sets it, so nobody can grant it to themselves.
-- Verified before drafting: profiles has RLS on with a SELECT-only policy; 0 live adult invites; 1 Club Admin.
-- Rollback: restore functions from 003 and the claim_invite/create_invite bodies in 002_claim_invite_proposed_fix.sql,
--           alter table public.profiles drop column is_owner; restore coach_access_requests role check to coach/assistant_coach.
begin;
alter table public.profiles add column if not exists is_owner boolean not null default false;
update public.profiles p set is_owner=true
  where p.role='club_admin' and p.user_id=(select id from auth.users where lower(email)='michaeljbriggs86@gmail.com');
alter table public.coach_access_requests drop constraint if exists coach_access_requests_requested_role_check;
alter table public.coach_access_requests add constraint coach_access_requests_requested_role_check
  check (requested_role in ('coach','assistant_coach','club_admin'));

create or replace function public.request_coach_access(p_team_id uuid, p_role text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  me public.profiles; target public.teams; req public.coach_access_requests;
  v_email text; v_meta jsonb; person text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_role is null or p_role not in ('coach','assistant_coach','club_admin') then raise exception 'Choose Coach, Assistant Coach or Club Admin'; end if;
  select * into me from public.profiles where user_id=auth.uid() for update;
  if me.user_id is null then raise exception 'No profile found'; end if;
  if me.role not in ('pending','pending_coach') then raise exception 'This account cannot request coaching access'; end if;
  select u.email, u.raw_user_meta_data into v_email, v_meta from auth.users u where u.id=auth.uid();
  if coalesce(v_meta->>'invite_access','')='true' or coalesce(v_email,'') ~* '@access[.][^@]+[.]app$' then
    raise exception 'Coaching access needs a normal email account'; end if;
  select * into target from public.teams where id=p_team_id and active=true;
  if target.id is null then raise exception 'Team not available'; end if;
  if me.club_id is not null and me.club_id<>target.club_id then raise exception 'This account belongs to another club'; end if;

  update public.profiles set club_id=target.club_id, team_id=coalesce(team_id,target.id), role='pending_coach',
    access_method='email', approved_at=null, approved_by=null, updated_at=now()
  where user_id=auth.uid() returning full_name into person;

  insert into public.coach_access_requests(user_id,club_id,team_id,requested_role,status,updated_at)
  values(auth.uid(),target.club_id,target.id,p_role,'pending',now())
  on conflict (user_id,team_id,requested_role) do update set status='pending',updated_at=now(),reviewed_at=null,reviewed_by=null
  returning * into req;

  insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key)
  select target.club_id,target.id,a.user_id,'coach_access_request','Coach access request',
         coalesce(nullif(person,''),'Someone')||' requested '||replace(p_role,'_',' ')||' access. Review before approving.',
         'coach-access-request:'||req.id::text
  from public.profiles a where a.club_id=target.club_id and a.role='club_admin' and (p_role<>'club_admin' or a.is_owner)
  on conflict(recipient_user_id,type,entity_key) where entity_key is not null
  do update set created_at=now(),read_at=null,body=excluded.body;

  return jsonb_build_object('ok',true,'request_id',req.id,'team_id',target.id,'requested_role',p_role,'status','pending');
end $function$;

create or replace function public.list_pending_coach_requests()
returns table(request_id uuid, user_id uuid, person_name text, person_email text, requested_role text, team_id uuid, team_name text, requested_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $function$
declare me public.profiles;
begin
  select * into me from public.profiles where profiles.user_id=auth.uid();
  if me.user_id is null or me.role<>'club_admin' then raise exception 'Club Admin access required'; end if;
  return query
  select r.id, r.user_id, p.full_name::text, u.email::text, r.requested_role::text, r.team_id, t.name::text, r.created_at
  from public.coach_access_requests r
  join public.profiles p on p.user_id=r.user_id
  join auth.users u on u.id=r.user_id
  join public.teams t on t.id=r.team_id
  where r.status='pending' and (r.requested_role<>'club_admin' or me.is_owner) and r.club_id=me.club_id and p.role='pending_coach' and p.club_id=me.club_id
  order by r.created_at;
end $function$;

create or replace function public.review_coach_request(p_request_id uuid, p_approve boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare me public.profiles; req public.coach_access_requests; target public.profiles;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role<>'club_admin' then raise exception 'Club Admin access required'; end if;
  select * into req from public.coach_access_requests where id=p_request_id and status='pending' for update;
  if req.id is null then raise exception 'Pending coach request not found'; end if;
  if req.requested_role='club_admin' and not coalesce(me.is_owner,false) then raise exception 'Only the club owner can approve a new Club Admin'; end if;
  if req.club_id<>me.club_id then raise exception 'Request belongs to another club'; end if;
  select * into target from public.profiles where user_id=req.user_id for update;
  if target.user_id is null or target.role<>'pending_coach' or target.club_id<>req.club_id then
    raise exception 'Account is not available for approval'; end if;

  update public.coach_access_requests set status=case when p_approve then 'approved' else 'rejected' end,
    reviewed_at=now(), reviewed_by=auth.uid(), updated_at=now() where id=req.id;

  if p_approve then
    update public.profiles set role=req.requested_role, team_id=case when req.requested_role='club_admin' then null else req.team_id end, access_method='email',
      approved_at=now(), approved_by=auth.uid(), updated_at=now() where user_id=req.user_id;
  else
    update public.profiles set role='pending', team_id=null, club_id=null, updated_at=now() where user_id=req.user_id;
  end if;

  insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key)
  values(req.club_id,req.team_id,req.user_id,
         case when p_approve then 'access_approved' else 'access_declined' end,
         case when p_approve then 'Access approved' else 'Access declined' end,
         case when p_approve then 'Your '||replace(req.requested_role,'_',' ')||' access has been approved.'
              else 'Your coaching access request was declined.' end,
         'coach-access-review:'||req.id::text)
  on conflict(recipient_user_id,type,entity_key) where entity_key is not null
  do update set created_at=now(),read_at=null,body=excluded.body;

  return jsonb_build_object('ok',true,'request_id',req.id,'status',case when p_approve then 'approved' else 'rejected' end);
end $function$;

-- Retire adult invite codes. Player Access codes (U15) are unchanged.
create or replace function public.create_invite(p_team_id uuid, p_role text, p_label text default ''::text, p_expires_hours integer default 168)
returns table(code text, invitation_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path to 'public','extensions' as $function$
declare p public.profiles; t public.teams; v_code text; v_id uuid; v_exp timestamptz;
begin
  select * into p from public.profiles where user_id=auth.uid();
  if p.role not in ('club_admin','coach','assistant_coach') then raise exception 'Coach, Assistant Coach or Club Admin access required'; end if;
  if p_role is distinct from 'player' then raise exception 'Invite codes are only used for U15 player access. Adults sign up with email and password.'; end if;
  select * into t from public.teams where id=p_team_id and club_id=p.club_id and active=true;
  if t.id is null then raise exception 'Team not available'; end if;
  if p.role in ('coach','assistant_coach') and p.team_id<>t.id then raise exception 'Coaching staff can only invite to their own team'; end if;
  if t.age_group<>15 then raise exception 'Player app access is only available to U15 squads'; end if;
  if length(trim(coalesce(p_label,'')))<2 then raise exception 'Choose the player for this invite'; end if;
  v_code='SH-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  v_exp=now()+make_interval(hours=>greatest(1,least(coalesce(p_expires_hours,168),720)));
  insert into public.invitations(club_id,team_id,role,label,code_hash,created_by,expires_at)
  values(p.club_id,t.id,'player',coalesce(p_label,''),extensions.digest(v_code,'sha256'),auth.uid(),v_exp)
  returning id into v_id;
  return query select v_code,v_id,v_exp;
end $function$;

-- claim_invite: add a guard at the top of the role handling so only player codes still work.
do $mig$
declare d text;
begin
  select pg_get_functiondef('public.claim_invite(text)'::regprocedure) into d;
  if position($g$  if inv.id is null then raise exception 'Invite is invalid, expired, or already used'; end if;$g$ in d)=0 then
    raise exception 'claim_invite body changed; review before applying'; end if;
  d:=replace(d,$g$  if inv.id is null then raise exception 'Invite is invalid, expired, or already used'; end if;$g$,
    $g$  if inv.id is null then raise exception 'Invite is invalid, expired, or already used'; end if;
  if inv.role is distinct from 'player' then raise exception 'This invite type is no longer used. Sign up with your email and password.'; end if;$g$);
  execute d;
end $mig$;
commit;
