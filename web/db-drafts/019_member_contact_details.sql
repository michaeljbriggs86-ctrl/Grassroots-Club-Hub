-- 019: team-scoped adult contact directory. DRAFT / NOT APPLIED.
-- Requires 012 (coach assignments) and 015 (effective parent capacity).
-- No existing account email is copied from auth.users. Club Admin or the
-- member deliberately supplies the contact email and phone. No addresses.
-- Apply only after Mike explicitly names this database change.
create table private.member_contact_details (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  email text not null default '' check (length(email)<=254),
  phone text not null default '' check (length(phone)<=40),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table private.member_contact_details enable row level security;
revoke all on private.member_contact_details from public, anon, authenticated;

-- The private table has no browser grants or permissive RLS policies.
-- Only these narrowly checked private functions may read/write its rows.
create function private.contact_directory(p_team_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me public.profiles; acting_role text; own_contact jsonb; rows jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  acting_role:=private.effective_role(me);
  if me.user_id is null or me.club_id is null or acting_role is null or acting_role not in ('club_admin','coach','assistant_coach','parent') then
    raise exception 'Approved adult access required';
  end if;
  if p_team_id is not null and not exists (
    select 1 from public.teams t where t.id=p_team_id and t.club_id=me.club_id and t.active
      and (acting_role='club_admin'
        or (acting_role in ('coach','assistant_coach') and exists (
          select 1 from public.coach_team_assignments a where a.user_id=me.user_id and a.team_id=t.id and a.club_id=me.club_id))
        or (acting_role='parent' and exists (
          select 1 from public.parent_player_links l where l.parent_user_id=me.user_id and l.team_id=t.id and l.club_id=me.club_id)))
  ) then raise exception 'Team not available'; end if;

  select jsonb_build_object('user_id',me.user_id,'full_name',me.full_name,
    'email',coalesce(c.email,''),'phone',coalesce(c.phone,'')) into own_contact
  from (select 1) seed left join private.member_contact_details c on c.user_id=me.user_id;

  with visible_teams as (
    select t.id,t.name,t.age_group from public.teams t
    where t.club_id=me.club_id and t.active and (p_team_id is null or t.id=p_team_id)
      and (acting_role='club_admin'
        or (acting_role in ('coach','assistant_coach') and exists (
          select 1 from public.coach_team_assignments a where a.user_id=me.user_id and a.team_id=t.id and a.club_id=me.club_id))
        or (acting_role='parent' and exists (
          select 1 from public.parent_player_links l where l.parent_user_id=me.user_id and l.team_id=t.id and l.club_id=me.club_id)))
  ), memberships as (
    select p.user_id,p.full_name,p.role,t.id team_id,t.name team_name,t.age_group,
      'staff'::text kind,'[]'::jsonb player_names
    from public.profiles p
    join public.coach_team_assignments a on a.user_id=p.user_id and a.club_id=p.club_id
    join visible_teams t on t.id=a.team_id
    where p.club_id=me.club_id and p.role in ('club_admin','coach','assistant_coach')
    union all
    select p.user_id,p.full_name,'parent',t.id,t.name,t.age_group,'parent',
      jsonb_agg(distinct l.player_name order by l.player_name)
    from public.profiles p
    join public.parent_player_links l on l.parent_user_id=p.user_id and l.club_id=p.club_id
    join visible_teams t on t.id=l.team_id
    where acting_role<>'parent' and p.club_id=me.club_id
      and p.role in ('parent','club_admin','coach','assistant_coach')
    group by p.user_id,p.full_name,t.id,t.name,t.age_group
    union all
    -- Admin can also populate approved adult accounts without an active team.
    select p.user_id,p.full_name,p.role,null::uuid,null::text,null::integer,
      case when p.role='parent' then 'parent' else 'staff' end,'[]'::jsonb
    from public.profiles p
    where acting_role='club_admin' and p_team_id is null and p.club_id=me.club_id
      and p.role in ('parent','club_admin','coach','assistant_coach')
      and not exists (select 1 from public.coach_team_assignments a join visible_teams t on t.id=a.team_id where a.user_id=p.user_id and a.club_id=me.club_id)
      and not exists (select 1 from public.parent_player_links l join visible_teams t on t.id=l.team_id where l.parent_user_id=p.user_id and l.club_id=me.club_id)
  ) select coalesce(jsonb_agg(jsonb_build_object(
      'user_id',m.user_id,'full_name',m.full_name,'role',m.role,'kind',m.kind,
      'team_id',m.team_id,'team_name',m.team_name,'age_group',m.age_group,
      'player_names',m.player_names,'email',coalesce(c.email,''),'phone',coalesce(c.phone,''))
      order by m.age_group nulls last,m.team_name nulls last,m.kind,m.full_name),'[]'::jsonb) into rows
    from memberships m left join private.member_contact_details c on c.user_id=m.user_id
    where m.user_id<>me.user_id;
  return jsonb_build_object('self',own_contact,'contacts',rows,'can_manage',acting_role='club_admin');
end $$;

create function private.save_contact_details(p_user_id uuid,p_email text,p_phone text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me public.profiles; target public.profiles; er text;
  email_value text:=btrim(coalesce(p_email,'')); phone_value text:=btrim(coalesce(p_phone,''));
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select p.* into me from public.profiles p where p.user_id=auth.uid() for update;
  er:=private.effective_role(me);
  if me.user_id is null or me.club_id is null or er is null or er not in ('club_admin','coach','assistant_coach','parent') then raise exception 'Approved adult access required'; end if;
  if p_user_id is distinct from me.user_id and er<>'club_admin' then raise exception 'Club Admin access required'; end if;
  select p.* into target from public.profiles p where p.user_id=p_user_id for update;
  if target.user_id is null or target.club_id is distinct from me.club_id
    or target.role not in ('club_admin','coach','assistant_coach','parent') then raise exception 'Contact not available'; end if;
  if length(email_value)>254 or (email_value<>'' and email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Enter a valid contact email'; end if;
  if length(phone_value)>40 or (phone_value<>'' and (phone_value !~ '^[+0-9() .-]+$' or length(regexp_replace(phone_value,'[^0-9]','','g'))<6)) then raise exception 'Enter a valid phone number'; end if;
  insert into private.member_contact_details(user_id,email,phone,updated_by)
    values(target.user_id,email_value,phone_value,me.user_id)
  on conflict(user_id) do update set email=excluded.email,phone=excluded.phone,updated_at=now(),updated_by=excluded.updated_by;
  return jsonb_build_object('ok',true);
end $$;

-- Public Data API wrappers are invokers. Privileged logic stays unexposed.
-- SQL-standard bodies bind private function references at creation; they do
-- not require opening private schema USAGE to authenticated users.
create function public.list_contact_directory(p_team_id uuid default null)
returns jsonb language sql stable security invoker set search_path=''
begin atomic
  select private.contact_directory(p_team_id);
end;
create function public.save_member_contact_details(p_user_id uuid,p_email text,p_phone text)
returns jsonb language sql security invoker set search_path=''
begin atomic
  select private.save_contact_details(p_user_id,p_email,p_phone);
end;
revoke all on function private.contact_directory(uuid),private.save_contact_details(uuid,text,text),
  public.list_contact_directory(uuid),public.save_member_contact_details(uuid,text,text) from public,anon,authenticated;
grant execute on function private.contact_directory(uuid),private.save_contact_details(uuid,text,text),
  public.list_contact_directory(uuid),public.save_member_contact_details(uuid,text,text) to authenticated;
