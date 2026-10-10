-- Coach and assistant coach access by email sign-up plus club admin approval (Mike, 2026-10-10).
-- Additive only: new table, new functions. Mirrors the existing parent_access_requests pattern
-- (RLS on, no policies, no table grants to authenticated; everything goes through the functions).
-- Rollback: drop function request_coach_access, list_pending_coach_requests, review_coach_request;
--           drop table coach_access_requests;
create table if not exists public.coach_access_requests(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  requested_role text not null check (requested_role in ('coach','assistant_coach')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  unique (user_id, team_id, requested_role)
);
alter table public.coach_access_requests enable row level security;
revoke all on public.coach_access_requests from anon, authenticated;

create or replace function public.request_coach_access(p_team_id uuid, p_role text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  me public.profiles; target public.teams; req public.coach_access_requests;
  v_email text; v_meta jsonb; person text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_role is null or p_role not in ('coach','assistant_coach') then raise exception 'Choose Coach or Assistant Coach'; end if;
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
  from public.profiles a where a.club_id=target.club_id and a.role='club_admin'
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
  where r.status='pending' and r.club_id=me.club_id and p.role='pending_coach' and p.club_id=me.club_id
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
  if req.club_id<>me.club_id then raise exception 'Request belongs to another club'; end if;
  select * into target from public.profiles where user_id=req.user_id for update;
  if target.user_id is null or target.role<>'pending_coach' or target.club_id<>req.club_id then
    raise exception 'Account is not available for approval'; end if;

  update public.coach_access_requests set status=case when p_approve then 'approved' else 'rejected' end,
    reviewed_at=now(), reviewed_by=auth.uid(), updated_at=now() where id=req.id;

  if p_approve then
    update public.profiles set role=req.requested_role, team_id=req.team_id, access_method='email',
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

revoke all on function public.request_coach_access(uuid,text), public.list_pending_coach_requests(), public.review_coach_request(uuid,boolean) from public, anon;
grant execute on function public.request_coach_access(uuid,text), public.list_pending_coach_requests(), public.review_coach_request(uuid,boolean) to authenticated;

-- APPLIED to the live database 2026-10-10 as migration coach_access_requests_email_flow (Mike: 'Apply step 1').
