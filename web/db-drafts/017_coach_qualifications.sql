-- DRAFT 017. Not applied. Requires Mike's explicit "Apply 017" and independent review.
-- Metadata only: no certificate uploads/numbers, DBS findings, FAN IDs or free-text notes.
-- RPC-only private storage: Club Admin in staff capacity writes; active staff read only their own.
-- Existing profiles, roles, assignments and effective-capacity helper are unchanged.
create table private.coach_qualification_profiles (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  records jsonb not null default '[]'::jsonb check(jsonb_typeof(records)='array' and jsonb_array_length(records)<=3),
  revision bigint not null default 1 check(revision>0),
  updated_at timestamptz not null default statement_timestamp(),
  updated_by uuid not null,
  primary key(club_id,user_id)
);
alter table private.coach_qualification_profiles enable row level security;
revoke all on private.coach_qualification_profiles from public,anon,authenticated;
create table private.coach_qualification_audit (
  id bigint generated always as identity primary key,
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  actor_user_id uuid not null,
  revision bigint not null,
  previous_records jsonb not null,
  records jsonb not null,
  changed_at timestamptz not null default statement_timestamp()
);
alter table private.coach_qualification_audit enable row level security;
revoke all on private.coach_qualification_audit from public,anon,authenticated;
revoke all on sequence private.coach_qualification_audit_id_seq from public,anon,authenticated;

-- Definer is needed to read protected profiles and RPC-only private tables. Fixed search path,
-- server profile/capacity checks and same-club target checks are mandatory, never client claims.
create function private.coach_qualification_club(p_user_id uuid,p_write boolean)
returns uuid language plpgsql security definer set search_path to '' as $$
declare me public.profiles; target public.profiles; actor_role text;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
  select * into me from public.profiles where user_id=auth.uid();
  actor_role:=private.effective_role(me);
  if me.user_id is null or actor_role not in ('club_admin','coach','assistant_coach')
     or (p_write and actor_role<>'club_admin')
     or (actor_role<>'club_admin' and p_user_id is distinct from me.user_id) then
    raise exception 'Qualification access denied' using errcode='42501';
  end if;
  select * into target from public.profiles where user_id=p_user_id;
  if target.user_id is null or target.club_id is distinct from me.club_id
     or target.role not in ('club_admin','coach','assistant_coach') or me.club_id is null then
    raise exception 'Qualification access denied' using errcode='42501';
  end if;
  return me.club_id;
end $$;
revoke all on function private.coach_qualification_club(uuid,boolean) from public,anon,authenticated;

create function public.get_coach_qualifications(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare club uuid; result jsonb;
begin
  club:=private.coach_qualification_club(p_user_id,false);
  select jsonb_build_object('records',q.records,'revision',q.revision) into result
    from private.coach_qualification_profiles q where q.club_id=club and q.user_id=p_user_id;
  return coalesce(result,jsonb_build_object('records','[]'::jsonb,'revision',0));
end $$;
revoke all on function public.get_coach_qualifications(uuid) from public,anon;
grant execute on function public.get_coach_qualifications(uuid) to authenticated;

-- Admin-only club matrix. One row per coaching account even with multiple assignments.
-- Pure Club Admins have no coaching obligation inferred from their admin role.
create function public.list_coach_qualifications()
returns table(user_id uuid,full_name text,role text,records jsonb,revision bigint)
language plpgsql security definer set search_path to '' as $$
declare club uuid;
begin
  club:=private.coach_qualification_club(auth.uid(),true);
  return query
    select p.user_id,coalesce(p.full_name,''),p.role,coalesce(q.records,'[]'::jsonb),coalesce(q.revision,0::bigint)
    from public.profiles p
    left join private.coach_qualification_profiles q on q.user_id=p.user_id and q.club_id=club
    where p.club_id=club and (
      p.role in ('coach','assistant_coach') or
      (p.role='club_admin' and (p.coach_team_id is not null or exists(
        select 1 from public.coach_team_assignments a where a.user_id=p.user_id and a.club_id=club
      )))
    ) order by lower(coalesce(p.full_name,'')),p.user_id;
end $$;
revoke all on function public.list_coach_qualifications() from public,anon;
grant execute on function public.list_coach_qualifications() to authenticated;

create function public.save_coach_qualifications(p_user_id uuid,p_records jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare club uuid; locked_club uuid; old private.coach_qualification_profiles;
  item jsonb; previous jsonb; clean jsonb:='[]'::jsonb; entry jsonb;
  kind text; course text; completed date; expiry date; checked boolean;
  seen text[]:='{}'; new_revision bigint; today date:=(statement_timestamp() at time zone 'Europe/London')::date;
begin
  club:=private.coach_qualification_club(p_user_id,true);
  -- Serialise creation as well as updates; re-check authorisation after acquiring the target lock.
  select p.club_id into locked_club from public.profiles p where p.user_id=p_user_id for update;
  if private.coach_qualification_club(p_user_id,true) is distinct from club or locked_club is distinct from club then
    raise exception 'Qualification access denied' using errcode='42501';
  end if;
  select * into old from private.coach_qualification_profiles q where q.club_id=club and q.user_id=p_user_id for update;
  if p_expected_revision is null or p_expected_revision<>coalesce(old.revision,0) then
    raise exception 'Qualifications changed. Reload before saving.' using errcode='40001';
  end if;
  if p_records is null or jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)>3 then
    raise exception 'Invalid qualification records' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_records) loop
    if jsonb_typeof(item)<>'object' then raise exception 'Invalid qualification record' using errcode='22023'; end if;
    if exists(select 1 from jsonb_object_keys(item) k where k not in ('kind','course','completed_on','expires_on','club_checked'))
       or not(item ?& array['kind','course','completed_on','expires_on','club_checked'])
       or jsonb_typeof(item->'club_checked')<>'boolean' then
      raise exception 'Only qualification type, dates and club check may be recorded' using errcode='22023';
    end if;
    kind:=item->>'kind';course:=item->>'course';
    if kind=any(seen) or kind is null or course is null or not(
      (kind='dbs' and course='fa_enhanced_dbs') or
      (kind='safeguarding' and course in ('fa_safeguarding_children','fa_safeguarding_recertification')) or
      (kind='first_aid' and course in ('fa_ifaif','fa_efaif','other_first_aid'))
    ) then raise exception 'Invalid or duplicate qualification type' using errcode='22023'; end if;
    seen:=array_append(seen,kind);
    if coalesce(item->>'completed_on','') !~ '^\d{4}-\d{2}-\d{2}$'
       or ((item->>'expires_on') is not null and (item->>'expires_on') !~ '^\d{4}-\d{2}-\d{2}$') then
      raise exception 'Use valid qualification dates' using errcode='22023';
    end if;
    begin completed:=(item->>'completed_on')::date;expiry:=(item->>'expires_on')::date;
    exception when datetime_field_overflow or invalid_datetime_format then raise exception 'Use valid qualification dates' using errcode='22023'; end;
    if completed>today or completed<'1900-01-01'::date or expiry is null or (expiry is not null and expiry<=completed) then
      raise exception 'Check completion and expiry dates' using errcode='22023';
    end if;
    checked:=(item->>'club_checked')::boolean;
    entry:=jsonb_build_object('kind',kind,'course',course,'completed_on',completed,'expires_on',expiry,'club_checked',checked);
    select value into previous from jsonb_array_elements(coalesce(old.records,'[]'::jsonb)) where value->>'kind'=kind;
    if checked then
      -- Keep the original check only when the qualification and its dates are unchanged.
      if previous->>'course'=course and previous->>'completed_on'=completed::text
         and (previous->>'expires_on') is not distinct from expiry::text and previous->>'club_checked'='true' then
        entry:=entry||jsonb_build_object('checked_by',previous->'checked_by','checked_at',previous->'checked_at');
      else entry:=entry||jsonb_build_object('checked_by',auth.uid(),'checked_at',statement_timestamp()); end if;
    end if;
    clean:=clean||jsonb_build_array(entry);
  end loop;
  new_revision:=coalesce(old.revision,0)+1;
  insert into private.coach_qualification_profiles(club_id,user_id,records,revision,updated_by)
    values(club,p_user_id,clean,new_revision,auth.uid())
    on conflict(club_id,user_id) do update set records=excluded.records,revision=excluded.revision,
      updated_at=statement_timestamp(),updated_by=excluded.updated_by;
  insert into private.coach_qualification_audit(club_id,user_id,actor_user_id,revision,previous_records,records)
    values(club,p_user_id,auth.uid(),new_revision,coalesce(old.records,'[]'::jsonb),clean);
  return jsonb_build_object('records',clean,'revision',new_revision);
end $$;
revoke all on function public.save_coach_qualifications(uuid,jsonb,bigint) from public,anon;
grant execute on function public.save_coach_qualifications(uuid,jsonb,bigint) to authenticated;
