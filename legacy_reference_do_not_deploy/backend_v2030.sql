-- AI COLLABORATION PROTOCOL NOTE — 2026-09-19
-- STATUS: WRITTEN historical reference only; DO NOT DEPLOY.
-- Any older 'live'/'deployed' wording below is a historical note and is not a current deployment claim.

create table if not exists public.club_announcements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 4000),
  audience text not null check (audience in ('whole_club','coaches','parents','age_group','team')),
  age_group integer,
  team_id uuid references public.teams(id) on delete cascade,
  pinned boolean not null default false,
  important boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint club_announcements_target_check check (
    (audience='age_group' and age_group is not null and team_id is null)
    or (audience='team' and team_id is not null)
    or (audience in ('whole_club','coaches','parents') and age_group is null and team_id is null)
  )
);
create index if not exists club_announcements_club_created_idx on public.club_announcements(club_id, created_at desc);
create index if not exists club_announcements_team_idx on public.club_announcements(team_id) where team_id is not null;
alter table public.club_announcements enable row level security;
revoke all on public.club_announcements from anon, authenticated;

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.club_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id,user_id)
);
create index if not exists announcement_reads_user_idx on public.announcement_reads(user_id, read_at desc);
alter table public.announcement_reads enable row level security;
revoke all on public.announcement_reads from anon, authenticated;

create table if not exists public.match_attendance (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  match_id text not null,
  player_name text not null check (char_length(player_name) between 1 and 120),
  status text not null check (status in ('selected','attended','unavailable','no_show')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(team_id,match_id,player_name)
);
create index if not exists match_attendance_team_match_idx on public.match_attendance(team_id,match_id);
alter table public.match_attendance enable row level security;
grant select,insert,update,delete on public.match_attendance to authenticated;

drop policy if exists match_attendance_read on public.match_attendance;
create policy match_attendance_read on public.match_attendance for select to authenticated
using ((select public.my_role()) in ('club_admin','coach','assistant_coach') and (select public.can_read_team(team_id)));
drop policy if exists match_attendance_insert on public.match_attendance;
create policy match_attendance_insert on public.match_attendance for insert to authenticated
with check ((select public.can_edit_team(team_id)) and updated_by=(select auth.uid()));
drop policy if exists match_attendance_update on public.match_attendance;
create policy match_attendance_update on public.match_attendance for update to authenticated
using ((select public.can_edit_team(team_id)))
with check ((select public.can_edit_team(team_id)) and updated_by=(select auth.uid()));
drop policy if exists match_attendance_delete on public.match_attendance;
create policy match_attendance_delete on public.match_attendance for delete to authenticated
using ((select public.can_edit_team(team_id)));

create or replace function public.list_announcements_for_me()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  me public.profiles;
  my_age integer;
  result jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.club_id is null then return '[]'::jsonb; end if;
  if me.team_id is not null then select t.age_group into my_age from public.teams t where t.id=me.team_id; end if;

  select coalesce(jsonb_agg(x order by (x->>'pinned')::boolean desc, (x->>'important')::boolean desc, x->>'created_at' desc),'[]'::jsonb)
    into result
  from (
    select jsonb_build_object(
      'id',a.id,'title',a.title,'body',a.body,'audience',a.audience,'age_group',a.age_group,'team_id',a.team_id,
      'pinned',a.pinned,'important',a.important,'created_at',a.created_at,'expires_at',a.expires_at,
      'read_at',r.read_at,
      'read_count',(select count(*) from public.announcement_reads rr where rr.announcement_id=a.id),
      'target_count',(
        select count(*) from public.profiles p2
        left join public.teams t2 on t2.id=p2.team_id
        where p2.club_id=a.club_id and p2.role in ('club_admin','coach','assistant_coach','parent')
          and (
            a.audience='whole_club'
            or (a.audience='coaches' and p2.role in ('coach','assistant_coach','club_admin'))
            or (a.audience='parents' and p2.role='parent')
            or (a.audience='team' and (p2.team_id=a.team_id or p2.coach_team_id=a.team_id))
            or (a.audience='age_group' and (t2.age_group=a.age_group or exists(select 1 from public.teams tc where tc.id=p2.coach_team_id and tc.age_group=a.age_group)))
          )
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
        or (a.audience='team' and a.team_id=me.team_id)
        or (a.audience='age_group' and a.age_group=my_age)
      )
    order by a.pinned desc,a.important desc,a.created_at desc
    limit 50
  ) q;
  return result;
end $$;

create or replace function public.create_club_announcement(
  p_title text,p_body text,p_audience text,p_age_group integer default null,p_team_id uuid default null,
  p_pinned boolean default false,p_important boolean default false,p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare me public.profiles; a public.club_announcements;
begin
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.role<>'club_admin' then raise exception 'Club Admin access required'; end if;
  if p_audience not in ('whole_club','coaches','parents','age_group','team') then raise exception 'Invalid audience'; end if;
  if p_audience='team' and not exists(select 1 from public.teams t where t.id=p_team_id and t.club_id=me.club_id and t.active=true) then raise exception 'Team not available'; end if;
  if p_audience='age_group' and (p_age_group is null or p_age_group<5 or p_age_group>21) then raise exception 'Choose an age group'; end if;
  insert into public.club_announcements(club_id,title,body,audience,age_group,team_id,pinned,important,created_by,expires_at)
  values(me.club_id,trim(p_title),trim(p_body),p_audience,case when p_audience='age_group' then p_age_group else null end,case when p_audience='team' then p_team_id else null end,coalesce(p_pinned,false),coalesce(p_important,false),auth.uid(),p_expires_at)
  returning * into a;
  return to_jsonb(a);
end $$;

create or replace function public.mark_announcement_read(p_announcement_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare rows jsonb;
begin
  rows:=public.list_announcements_for_me();
  if not exists(select 1 from jsonb_array_elements(rows) x where (x->>'id')::uuid=p_announcement_id) then raise exception 'Announcement not available'; end if;
  insert into public.announcement_reads(announcement_id,user_id,read_at) values(p_announcement_id,auth.uid(),now())
  on conflict(announcement_id,user_id) do update set read_at=excluded.read_at;
  return true;
end $$;

create or replace function public.delete_club_announcement(p_announcement_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare me public.profiles;
begin
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.role<>'club_admin' then raise exception 'Club Admin access required'; end if;
  delete from public.club_announcements where id=p_announcement_id and club_id=me.club_id;
  return found;
end $$;

revoke execute on function public.list_announcements_for_me() from public,anon;
revoke execute on function public.create_club_announcement(text,text,text,integer,uuid,boolean,boolean,timestamptz) from public,anon;
revoke execute on function public.mark_announcement_read(uuid) from public,anon;
revoke execute on function public.delete_club_announcement(uuid) from public,anon;
grant execute on function public.list_announcements_for_me() to authenticated;
grant execute on function public.create_club_announcement(text,text,text,integer,uuid,boolean,boolean,timestamptz) to authenticated;
grant execute on function public.mark_announcement_read(uuid) to authenticated;
grant execute on function public.delete_club_announcement(uuid) to authenticated;
