-- Rollback for 016: restores request_parent_access (live version) and the 015 list_announcements_for_me, drops the helper.
create or replace function public.request_parent_access(p_team_id uuid, p_child_name text)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  me public.profiles;
  target public.teams;
  nm text:=regexp_replace(trim(coalesce(p_child_name,'')),'\s+',' ','g');
  req public.parent_access_requests;
  parent_name text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;

  select * into me from public.profiles where user_id=auth.uid() for update;
  if me.user_id is null then raise exception 'No profile found'; end if;
  if me.role not in ('pending','pending_parent','parent') then
    raise exception 'This account cannot request parent access';
  end if;
  if length(nm)<2 or length(nm)>80 then
    raise exception 'Enter the child or player name';
  end if;

  select * into target from public.teams where id=p_team_id and active=true;
  if target.id is null then raise exception 'Team not available'; end if;

  if me.club_id is not null and me.club_id<>target.club_id then
    raise exception 'All children on one parent account must belong to the same club';
  end if;

  if me.role='pending' then
    update public.profiles
    set club_id=target.club_id,
        team_id=target.id,
        role='pending_parent',
        access_method='email',
        approved_at=null,
        approved_by=null,
        updated_at=now()
    where user_id=auth.uid()
    returning full_name into parent_name;
  elsif me.role='pending_parent' then
    update public.profiles
    set club_id=coalesce(club_id,target.club_id),
        team_id=coalesce(team_id,target.id),
        access_method='email',
        updated_at=now()
    where user_id=auth.uid()
    returning full_name into parent_name;
  else
    update public.profiles
    set updated_at=now()
    where user_id=auth.uid()
    returning full_name into parent_name;
  end if;

  insert into public.parent_access_requests(
    user_id,club_id,team_id,child_name,status,updated_at,reviewed_at,reviewed_by
  )
  values(auth.uid(),target.club_id,target.id,nm,'pending',now(),null,null)
  on conflict (user_id,team_id,child_name)
  do update set status='pending',updated_at=now(),reviewed_at=null,reviewed_by=null
  returning * into req;

  insert into public.app_notifications(
    club_id,team_id,recipient_user_id,type,title,body,entity_key
  )
  select
    target.club_id,
    target.id,
    staff.user_id,
    'parent_access_request',
    'Parent access request',
    coalesce(nullif(parent_name,''),'A parent') || ' requested access for ' || nm || '. Review Team access before approving.',
    'parent-access-request:' || req.id::text
  from public.profiles staff
  where staff.club_id=target.club_id
    and staff.role in ('club_admin','coach','assistant_coach')
    and (
      staff.role='club_admin'
      or coalesce(staff.coach_team_id,staff.team_id)=target.id
    )
  on conflict(recipient_user_id,type,entity_key) where entity_key is not null
  do update set created_at=now(),read_at=null,body=excluded.body;

  return jsonb_build_object(
    'ok',true,
    'request_id',req.id,
    'club_id',target.club_id,
    'team_id',target.id,
    'child_name',nm,
    'status','pending'
  );
end $$;

create or replace function public.list_announcements_for_me()
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  me public.profiles; my_age integer; result jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.club_id is null then return '[]'::jsonb; end if;
  me.role:=private.effective_role(me);
  if me.role='player' and exists (
    select 1 from public.teams t where t.id=me.team_id and t.club_id=me.club_id
      and public.team_player_age(t.age_group,t.selkent_label) between 7 and 16
  ) then return '[]'::jsonb; end if;
  if me.role<>'parent' and me.team_id is not null then
    select t.age_group into my_age from public.teams t where t.id=me.team_id;
  end if;
  select coalesce(jsonb_agg(x order by (x->>'pinned')::boolean desc,(x->>'important')::boolean desc,x->>'created_at' desc),'[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'id',a.id,'title',a.title,'body',a.body,'audience',a.audience,'age_group',a.age_group,'team_id',a.team_id,
      'pinned',a.pinned,'important',a.important,'created_at',a.created_at,'expires_at',a.expires_at,'read_at',r.read_at,
      'read_count',(select count(*) from public.announcement_reads rr where rr.announcement_id=a.id),
      'target_count',(
        select count(distinct target_user) from (
          select p2.user_id as target_user
          from public.profiles p2
          left join public.teams t2 on t2.id=coalesce(p2.coach_team_id,p2.team_id)
          where p2.club_id=a.club_id and p2.role in ('club_admin','coach','assistant_coach','player')
            and (p2.role<>'player' or public.team_player_age(t2.age_group,t2.selkent_label) not between 7 and 16)
            and (a.audience='whole_club'
              or (a.audience='coaches' and p2.role in ('coach','assistant_coach','club_admin'))
              or (a.audience='team' and coalesce(p2.coach_team_id,p2.team_id)=a.team_id)
              or (a.audience='age_group' and t2.age_group=a.age_group))
          union
          select p3.user_id from public.profiles p3
          where p3.club_id=a.club_id and p3.role='parent'
            and (a.audience in ('whole_club','parents')
              or (a.audience='team' and exists(select 1 from public.parent_player_links ppl where ppl.parent_user_id=p3.user_id and ppl.team_id=a.team_id))
              or (a.audience='age_group' and exists(select 1 from public.parent_player_links ppl join public.teams pt on pt.id=ppl.team_id where ppl.parent_user_id=p3.user_id and pt.age_group=a.age_group)))
        ) recipients
      )
    ) x
    from public.club_announcements a
    left join public.announcement_reads r on r.announcement_id=a.id and r.user_id=auth.uid()
    where a.club_id=me.club_id
      and (a.expires_at is null or a.expires_at>now() or me.role='club_admin')
      and (
        me.role='club_admin'
        or a.audience='whole_club'
        or (a.audience='coaches' and me.role in ('coach','assistant_coach'))
        or (a.audience='parents' and me.role='parent')
        or (a.audience='team' and (
              (me.role='parent' and exists(select 1 from public.parent_player_links ppl where ppl.parent_user_id=me.user_id and ppl.team_id=a.team_id))
              or (me.role<>'parent' and a.team_id=coalesce(me.coach_team_id,me.team_id))))
        or (a.audience='age_group' and (
              (me.role='parent' and exists(select 1 from public.parent_player_links ppl join public.teams pt on pt.id=ppl.team_id where ppl.parent_user_id=me.user_id and pt.age_group=a.age_group))
              or (me.role<>'parent' and a.age_group=my_age)))
      )
    order by a.pinned desc,a.important desc,a.created_at desc
    limit 50
  ) q;
  return result;
end $$;
create or replace function public.request_child_link(p_team_id uuid, p_child_name text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  me public.profiles; target public.teams; nm text:=regexp_replace(trim(coalesce(p_child_name,'')),'\s+',' ','g');
  req public.parent_access_requests;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into me from public.profiles where user_id=auth.uid() for update;
  if me.user_id is null or me.role not in ('club_admin','coach','assistant_coach') then
    raise exception 'This is for coaches and Club Admins. Parents use the parent sign-up.';
  end if;
  if length(nm)<2 or length(nm)>80 then raise exception 'Enter your child''s name'; end if;
  select * into target from public.teams where id=p_team_id and active=true;
  if target.id is null or target.club_id is distinct from me.club_id then raise exception 'Team not available'; end if;
  if exists(select 1 from public.parent_player_links l where l.parent_user_id=me.user_id and l.team_id=target.id
            and public.team_identity_norm(l.player_name)=public.team_identity_norm(nm)) then
    raise exception 'That child is already linked to your account';
  end if;

  insert into public.parent_access_requests(user_id,club_id,team_id,child_name,status,updated_at,reviewed_at,reviewed_by)
  values(me.user_id,target.club_id,target.id,nm,'pending',now(),null,null)
  on conflict (user_id,team_id,child_name)
  do update set status='pending',updated_at=now(),reviewed_at=null,reviewed_by=null
  returning * into req;

  insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key)
  select target.club_id,target.id,staff.user_id,'parent_access_request','Child link request',
         coalesce(nullif(me.full_name,''),'A coach')||' asked to link their child '||nm||'. Someone other than them must approve it.',
         'parent-access-request:'||req.id::text
  from public.profiles staff
  where staff.club_id=target.club_id and staff.user_id<>me.user_id
    and staff.role in ('club_admin','coach','assistant_coach')
    and (staff.role='club_admin' or coalesce(staff.coach_team_id,staff.team_id)=target.id)
  on conflict(recipient_user_id,type,entity_key) where entity_key is not null
  do update set created_at=now(),read_at=null,body=excluded.body;

  return jsonb_build_object('ok',true,'request_id',req.id,'team_id',target.id,'child_name',nm,'status','pending');
end $$;
drop function if exists private.assigned_team_ids(uuid);
