-- Throwaway local PostgreSQL only. Synthetic fixtures; never run on Supabase.
create role anon; create role authenticated;
create schema auth; create schema private;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.uid',true),'')::uuid
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create table auth.users(id uuid primary key);
create table public.profiles(user_id uuid primary key references auth.users(id),club_id uuid,team_id uuid,coach_team_id uuid,
  full_name text,role text,acting_as_parent boolean default false);
create table public.teams(id uuid primary key,club_id uuid,name text,age_group int,active boolean default true);
create table public.coach_team_assignments(user_id uuid,team_id uuid,club_id uuid,primary key(user_id,team_id));
create table public.parent_player_links(parent_user_id uuid,team_id uuid,club_id uuid,player_name text);
create function private.effective_role(p public.profiles) returns text language sql stable security definer set search_path='' as $$
  select case when p.acting_as_parent and p.role in ('club_admin','coach','assistant_coach')
    and exists(select 1 from public.parent_player_links l where l.parent_user_id=p.user_id) then 'parent' else p.role end
$$;
revoke all on function private.effective_role(public.profiles) from public;
create function public.test_contact_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
