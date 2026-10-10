-- 009: Club job titles for Club Admins, and a guard so the club is never left with no owner.
-- Mike (10 Oct 2026): James Runacre is Director; Jacky Greenleas will be Club Secretary. Both are Club Admins.
-- Titles are labels only. They do not change what an admin can see or do. The owner flag still decides who approves new Club Admins.
-- Not applied until Mike says "Apply 009".
begin;

alter table public.profiles add column if not exists club_title text;
alter table public.profiles drop constraint if exists profiles_club_title_check;
alter table public.profiles add constraint profiles_club_title_check
  check (club_title is null or club_title in ('Director','Club Secretary'));

update public.profiles p set club_title='Director'
from auth.users a where a.id=p.user_id and a.email='michaeljbriggs8@gmail.com' and p.role='club_admin';

-- Only an owner can set or clear a title, and only on a Club Admin in the same club.
create or replace function public.set_admin_title(p_user_id uuid, p_title text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare me public.profiles; target public.profiles; t text:=nullif(btrim(coalesce(p_title,'')),'');
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role<>'club_admin' or me.is_owner is not true then raise exception 'Owner access required'; end if;
  select * into target from public.profiles where user_id=p_user_id;
  if target.user_id is null or target.club_id is distinct from me.club_id or target.role<>'club_admin' then raise exception 'Choose a Club Admin in your club'; end if;
  if t is not null and t not in ('Director','Club Secretary') then raise exception 'Title must be Director or Club Secretary'; end if;
  update public.profiles set club_title=t, updated_at=now() where user_id=p_user_id;
  return jsonb_build_object('ok',true,'user_id',p_user_id,'club_title',t);
end $function$;
revoke all on function public.set_admin_title(uuid,text) from public, anon;
grant execute on function public.set_admin_title(uuid,text) to authenticated;

-- Staff list now returns the title.
drop function if exists public.list_club_access_accounts();
create function public.list_club_access_accounts()
 returns table(user_id uuid, full_name text, role text, team_id uuid, coach_team_id uuid, team_name text, age_group integer, access_method text, approved_at timestamptz, created_at timestamptz, club_title text, is_owner boolean)
 language plpgsql security definer set search_path to 'public' as $function$
declare me public.profiles;
begin
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.role<>'club_admin' then raise exception 'Club Admin access required'; end if;
  return query select p.user_id,p.full_name,p.role,p.team_id,p.coach_team_id,coalesce(t.name,ct.name),coalesce(t.age_group,ct.age_group),p.access_method,p.approved_at,p.created_at,p.club_title,p.is_owner
  from public.profiles p left join public.teams t on t.id=p.team_id left join public.teams ct on ct.id=p.coach_team_id
  where p.club_id=me.club_id and p.role in ('club_admin','coach','assistant_coach','parent','pending_parent','player')
  order by case p.role when 'club_admin' then 0 when 'coach' then 1 when 'assistant_coach' then 2 when 'pending_parent' then 3 when 'player' then 4 else 5 end,coalesce(t.age_group,ct.age_group) nulls last,coalesce(t.name,ct.name) nulls last,p.full_name;
end $function$;
revoke all on function public.list_club_access_accounts() from public, anon;
grant execute on function public.list_club_access_accounts() to authenticated;

-- A club must always keep at least one owner: block removing the last owner flag.
create or replace function public.guard_last_owner() returns trigger language plpgsql as $function$
begin
  if old.is_owner is true and new.is_owner is not true then
    if not exists (select 1 from public.profiles p where p.club_id=old.club_id and p.is_owner is true and p.user_id<>old.user_id) then
      raise exception 'A club must keep at least one owner';
    end if;
  end if;
  return new;
end $function$;
drop trigger if exists trg_guard_last_owner on public.profiles;
create trigger trg_guard_last_owner before update of is_owner on public.profiles for each row execute function public.guard_last_owner();

commit;
