-- Stand-ins plus verbatim copies of the real helper functions. Throwaway Postgres only.
create schema if not exists private;
alter table public.teams add column if not exists selkent_label text, add column if not exists season text;
create table public.parent_player_links(id uuid primary key default gen_random_uuid(), club_id uuid, team_id uuid, parent_user_id uuid, player_name text, shirt_number int);
create table private.player_season_identity(id uuid primary key default gen_random_uuid(), club_id uuid, team_id uuid, season text, player_name text, shirt_number int);
create table public.team_state(team_id uuid primary key, state jsonb, revision bigint default 1, updated_at timestamptz default now());
create function public.team_identity_norm(p_name text) returns text language sql immutable as $$ select lower(regexp_replace(btrim(coalesce(p_name,'')),'\s+',' ','g')) $$;
create function public.team_player_age(p_age_group integer, p_selkent_label text) returns integer language sql immutable as $$
  select case when coalesce(p_selkent_label,'') ~* '^Under[[:space:]]*(8|10|12|14)X' then greatest(7,coalesce(p_age_group,0)-1) else coalesce(p_age_group,0) end $$;
create function public.can_read_team(p_team uuid) returns boolean language sql stable security definer as $$
  select exists(select 1 from public.profiles p join public.teams t on t.id=p_team where p.user_id=auth.uid() and p.club_id=t.club_id
   and (p.role='club_admin' or (p.role in ('coach','assistant_coach') and p_team=coalesce(p.coach_team_id,p.team_id)) or (p.role='player' and p.team_id=p_team)
   or (p.role='parent' and exists(select 1 from public.parent_player_links ppl where ppl.parent_user_id=p.user_id and ppl.team_id=p_team)))) $$;
create function private.hydrate_u11_staff_state(p_team uuid, p_state jsonb) returns jsonb language sql as $$ select p_state || '{"hydrated":true}'::jsonb $$;
CREATE OR REPLACE FUNCTION public.sanitize_mini_soccer_state(p_state jsonb, p_age_group integer) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $function$
declare v jsonb:=coalesce(p_state,'{}'::jsonb); cleaned jsonb;
begin
  if p_age_group is null or p_age_group<7 or p_age_group>11 then return v; end if;
  select coalesce(jsonb_agg((m - 'gf' - 'ga' - 'score' - 'result' - 'outcome' - 'points' - 'won' - 'drawn' - 'lost' - 'goalDifference' - 'winRate' - 'notes') || jsonb_build_object('resultRestricted',true) order by ord),'[]'::jsonb)
  into cleaned from jsonb_array_elements(coalesce(v->'matches','[]'::jsonb)) with ordinality q(m,ord);
  v:=jsonb_set(v,'{matches}',cleaned,true);
  v:=jsonb_set(v,'{goals}','[]'::jsonb,true); v:=jsonb_set(v,'{assists}','[]'::jsonb,true); v:=jsonb_set(v,'{bookings}','[]'::jsonb,true);
  v:=jsonb_set(v,'{leagueResults}','[]'::jsonb,true);
  select coalesce(jsonb_agg(s - 'number' order by ord),'[]'::jsonb) into cleaned from jsonb_array_elements(coalesce(v->'squad','[]'::jsonb)) with ordinality q(s,ord);
  v:=jsonb_set(v,'{squad}',cleaned,true);
  return v;
end $function$;
