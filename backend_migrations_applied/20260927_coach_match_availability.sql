-- Coach and assistant coach corrections to per-player fixture availability.
-- Apply to Supabase before publishing the matching web client.
alter table public.match_availability
  add column if not exists response_source text not null default 'parent';

alter table public.match_availability
  drop constraint if exists match_availability_response_source_check;
alter table public.match_availability
  add constraint match_availability_response_source_check
  check (response_source in ('parent', 'player', 'coach'));

-- Record who actually made the latest change; never trust client-supplied source or user ID.
create or replace function public.stamp_match_availability_response()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.parent_user_id := auth.uid();
  new.response_source := case when public.can_edit_team(new.team_id) then 'coach'
                              when public.my_role() = 'player' then 'player'
                              else 'parent' end;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists stamp_match_availability_response on public.match_availability;
create trigger stamp_match_availability_response
before insert or update on public.match_availability
for each row execute function public.stamp_match_availability_response();

create policy match_availability_coach_insert on public.match_availability
for insert to authenticated
with check (public.can_edit_team(team_id) and parent_user_id = (select auth.uid()) and response_source = 'coach');

create policy match_availability_coach_update on public.match_availability
for update to authenticated
using (public.can_edit_team(team_id))
with check (public.can_edit_team(team_id) and parent_user_id = (select auth.uid()) and response_source = 'coach');
