
begin;


create table if not exists public.coach_team_assignments(
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(user_id,team_id)
);
alter table public.coach_team_assignments enable row level security;
revoke all on table public.coach_team_assignments from anon, authenticated;
grant select on table public.coach_team_assignments to authenticated;
grant all on table public.coach_team_assignments to service_role;
drop policy if exists coach_team_assignments_read on public.coach_team_assignments;
create policy coach_team_assignments_read on public.coach_team_assignments for select to authenticated
  using (user_id=auth.uid() or exists(select 1 from public.profiles me where me.user_id=auth.uid() and me.role='club_admin' and me.club_id=coach_team_assignments.club_id));

-- Existing coaches and coaching Club Admins keep exactly the team they have now.
insert into public.coach_team_assignments(user_id,team_id,club_id)
select p.user_id, case when p.role='club_admin' then p.coach_team_id else p.team_id end, p.club_id
from public.profiles p
where ((p.role in ('coach','assistant_coach') and p.team_id is not null) or (p.role='club_admin' and p.coach_team_id is not null))
  and p.club_id is not null
on conflict do nothing;

-- Any approval path that sets a coach's team also records the assignment, so no approval function needs changing.
create or replace function public.record_coach_team_assignment() returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare t uuid;
begin
  t:=case when new.role='club_admin' then new.coach_team_id when new.role in ('coach','assistant_coach') then new.team_id else null end;
  if t is not null and new.club_id is not null then
    insert into public.coach_team_assignments(user_id,team_id,club_id) values(new.user_id,t,new.club_id) on conflict do nothing;
  end if;
  return new;
end $function$;
drop trigger if exists trg_record_coach_team_assignment on public.profiles;
create trigger trg_record_coach_team_assignment after insert or update of team_id, coach_team_id, role on public.profiles
  for each row execute function public.record_coach_team_assignment();

-- Club Admin adds a team to a coach (same authority as the existing coach management).
create or replace function public.assign_coach_team(p_user_id uuid, p_team_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare me public.profiles; target public.profiles; tm public.teams;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role<>'club_admin' then raise exception 'Club Admin access required'; end if;
  select * into target from public.profiles where user_id=p_user_id for update;
  if target.user_id is null or target.club_id is distinct from me.club_id or target.role not in ('coach','assistant_coach','club_admin') then raise exception 'Choose a coach or Club Admin in your club'; end if;
  select * into tm from public.teams where id=p_team_id and club_id=me.club_id and active=true;
  if tm.id is null then raise exception 'Team not available'; end if;
  insert into public.coach_team_assignments(user_id,team_id,club_id,assigned_by) values(p_user_id,p_team_id,me.club_id,auth.uid()) on conflict do nothing;
  -- A person with no active team yet starts on this one.
  if target.role='club_admin' and target.coach_team_id is null then update public.profiles set coach_team_id=p_team_id,updated_at=now() where user_id=p_user_id;
  elsif target.role in ('coach','assistant_coach') and target.team_id is null then update public.profiles set team_id=p_team_id,updated_at=now() where user_id=p_user_id; end if;
  return jsonb_build_object('ok',true,'user_id',p_user_id,'team_id',p_team_id);
end $function$;

-- Club Admin takes one team away. A coach cannot be left with none (use Remove for that).
create or replace function public.unassign_coach_team(p_user_id uuid, p_team_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare me public.profiles; target public.profiles; nxt uuid; remaining int;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role<>'club_admin' then raise exception 'Club Admin access required'; end if;
  select * into target from public.profiles where user_id=p_user_id for update;
  if target.user_id is null or target.club_id is distinct from me.club_id then raise exception 'Coaching access not found'; end if;
  select count(*) into remaining from public.coach_team_assignments where user_id=p_user_id and team_id<>p_team_id;
  if target.role in ('coach','assistant_coach') and remaining=0 then raise exception 'A coach needs at least one team. Use Remove to withdraw coaching access.'; end if;
  delete from public.coach_team_assignments where user_id=p_user_id and team_id=p_team_id;
  select team_id into nxt from public.coach_team_assignments where user_id=p_user_id order by created_at limit 1;
  if target.role='club_admin' and target.coach_team_id=p_team_id then update public.profiles set coach_team_id=nxt,updated_at=now() where user_id=p_user_id;
  elsif target.role in ('coach','assistant_coach') and (target.team_id=p_team_id or target.coach_team_id=p_team_id) then update public.profiles set team_id=nxt,coach_team_id=case when coach_team_id is null then null else nxt end,updated_at=now() where user_id=p_user_id; end if;
  return jsonb_build_object('ok',true);
end $function$;

-- A person switches the team they are working on. Only teams they are assigned to are accepted.
create or replace function public.switch_my_active_team(p_team_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare me public.profiles;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role not in ('coach','assistant_coach','club_admin') then raise exception 'Coaching access required'; end if;
  if not exists(select 1 from public.coach_team_assignments a join public.teams t on t.id=a.team_id and t.active=true where a.user_id=auth.uid() and a.team_id=p_team_id and a.club_id=me.club_id) then
    raise exception 'You are not assigned to that team'; end if;
  if me.role='club_admin' then update public.profiles set coach_team_id=p_team_id,updated_at=now() where user_id=auth.uid();
  else update public.profiles set team_id=p_team_id,coach_team_id=case when coach_team_id is null then null else p_team_id end,updated_at=now() where user_id=auth.uid(); end if;
  return jsonb_build_object('ok',true,'team_id',p_team_id);
end $function$;

create or replace function public.list_my_coach_teams()
returns table(team_id uuid, age_group integer, name text, selkent_label text, is_active boolean)
language sql stable security definer set search_path to 'public' as $function$
  select t.id,t.age_group,t.name,t.selkent_label,
         (t.id=case when me.role='club_admin' then me.coach_team_id else me.team_id end)
  from public.profiles me
  join public.coach_team_assignments a on a.user_id=me.user_id and a.club_id=me.club_id
  join public.teams t on t.id=a.team_id and t.active=true
  where me.user_id=auth.uid() and me.role in ('coach','assistant_coach','club_admin')
  order by t.age_group,t.name
$function$;

-- The coaching list shows every assigned team, not just the active one.
drop function if exists public.list_club_coaches();
create function public.list_club_coaches()
 returns table(user_id uuid, full_name text, role text, team_id uuid, team_name text, age_group integer, access_method text, created_at timestamptz, club_title text)
 language plpgsql security definer set search_path to 'public' as $function$
declare me public.profiles;
begin
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.role<>'club_admin' then raise exception 'Club Admin access required'; end if;
  return query
  select p.user_id, p.full_name, p.role, t.id, t.name, t.age_group, p.access_method, p.created_at, p.club_title
  from public.profiles p
  join public.coach_team_assignments a on a.user_id=p.user_id and a.club_id=p.club_id
  join public.teams t on t.id=a.team_id
  where p.club_id=me.club_id and p.role in ('coach','assistant_coach','club_admin')
  order by t.age_group,t.name,case p.role when 'club_admin' then 0 when 'coach' then 1 else 2 end,p.full_name;
end $function$;

-- Withdrawing coaching access also clears the assignment list.
create or replace function public.remove_club_coach(p_user_id uuid)
returns boolean language plpgsql security definer set search_path to 'public' as $function$
declare me public.profiles; target public.profiles;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role<>'club_admin' then raise exception 'Club Admin access required'; end if;
  select * into target from public.profiles where user_id=p_user_id for update;
  if target.user_id is null or target.club_id<>me.club_id then raise exception 'Coaching access not found'; end if;
  if target.role='club_admin' then
    if target.coach_team_id is null then raise exception 'This Club Admin has no coaching assignment'; end if;
    update public.profiles set coach_team_id=null,updated_at=now() where user_id=p_user_id;
  elsif target.role in ('coach','assistant_coach') then
    update public.profiles set role='revoked',team_id=null,coach_team_id=null,approved_at=null,approved_by=auth.uid(),updated_at=now() where user_id=p_user_id;
  else
    raise exception 'Coaching access not found';
  end if;
  delete from public.coach_team_assignments where user_id=p_user_id;
  return true;
end $function$;

revoke all on function public.assign_coach_team(uuid,uuid), public.unassign_coach_team(uuid,uuid), public.switch_my_active_team(uuid), public.list_my_coach_teams(), public.list_club_coaches(), public.record_coach_team_assignment() from public, anon;
grant execute on function public.assign_coach_team(uuid,uuid), public.unassign_coach_team(uuid,uuid), public.switch_my_active_team(uuid), public.list_my_coach_teams(), public.list_club_coaches() to authenticated, service_role;


create temp table t_out(step text, result text);
grant all on t_out to authenticated;
do $$
declare mike uuid:=(select id from auth.users where email='michaeljbriggs86@gmail.com'); james uuid:=(select id from auth.users where email='michaeljbriggs8@gmail.com'); u14 uuid:='007e45d7-51d2-4f5e-b656-17779141f5c8'; u15 uuid:='ed25bf07-56ee-413d-a271-b48d1f5a5432'; val uuid:='24ce341d-fb7d-4367-9f9c-6e875a0493a0';
begin
  insert into t_out select 'backfill_rows', count(*)::text from public.coach_team_assignments;
  perform set_config('request.jwt.claims', json_build_object('sub',mike,'role','authenticated')::text, true);
  set local role authenticated;
  perform public.assign_coach_team(james,u14);
  perform public.assign_coach_team(james,u15);
  insert into t_out select 'james_assigned', count(*)::text from public.coach_team_assignments where user_id=james;
  insert into t_out select 'james_active_after_assign', (select coach_team_id::text from public.profiles where user_id=james);
  insert into t_out select 'coach_list_rows', count(*)::text from public.list_club_coaches();
  perform set_config('request.jwt.claims', json_build_object('sub',james,'role','authenticated')::text, true);
  insert into t_out select 'james_teams', string_agg(age_group||' '||name||case when is_active then '*' else '' end, ', ') from public.list_my_coach_teams();
  perform public.switch_my_active_team(u15);
  insert into t_out select 'after_switch_u15', (select coach_team_id=u15 from public.profiles where user_id=james)::text;
  insert into t_out select 'can_edit_u15', public.can_edit_team(u15)::text;
  insert into t_out select 'can_edit_u14_while_u15_active', public.can_edit_team(u14)::text;
  begin perform public.switch_my_active_team(val); insert into t_out values('switch_unassigned','NOT BLOCKED (bad)'); exception when others then insert into t_out values('switch_unassigned','blocked: '||sqlerrm); end;
  perform set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='mbriggs.engineer@gmail.com'),'role','authenticated')::text, true);
  begin perform public.switch_my_active_team(u14); insert into t_out values('parent_switch','NOT BLOCKED (bad)'); exception when others then insert into t_out values('parent_switch','blocked: '||sqlerrm); end;
  begin perform public.assign_coach_team(james,u14); insert into t_out values('parent_assign','NOT BLOCKED (bad)'); exception when others then insert into t_out values('parent_assign','blocked: '||sqlerrm); end;
  begin insert into t_out select 'parent_reads_assignments', count(*)::text from public.coach_team_assignments; end;
  reset role;
end $$;
select * from t_out;
rollback;
