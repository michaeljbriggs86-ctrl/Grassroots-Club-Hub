-- AI COLLABORATION PROTOCOL NOTE — 2026-09-19
-- STATUS: WRITTEN historical reference only; DO NOT DEPLOY.
-- Any older 'live'/'deployed' wording below is a historical note and is not a current deployment claim.

-- Universal Core v1: club configuration, competition rules and provider abstraction.

create table if not exists public.club_settings (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  short_name text not null default '',
  primary_color text not null default '#218a21' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#ffffff' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#218a21' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_asset text not null default 'club-logo.png',
  logo_url text,
  current_season text not null default '2026/27',
  timezone text not null default 'Europe/London',
  country_code text not null default 'GB',
  default_provider_key text not null default 'manual',
  results_publish_from_age integer,
  player_account_age_groups integer[] not null default '{}'::integer[],
  is_demo boolean not null default false,
  active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.competition_rules (
  club_id uuid not null references public.clubs(id) on delete cascade,
  age_group integer not null check (age_group between 5 and 18),
  format text not null,
  players_on_pitch integer not null check (players_on_pitch > 0),
  max_registered integer not null check (max_registered >= players_on_pitch),
  matchday_max integer not null check (matchday_max >= players_on_pitch),
  rolling_substitutions boolean not null default false,
  results_published boolean not null default false,
  player_accounts_allowed boolean not null default false,
  stats_config jsonb not null default '{"goals":true,"assists":true,"awards":true,"bookings":true}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (club_id, age_group)
);

create table if not exists public.competition_providers (
  club_id uuid not null references public.clubs(id) on delete cascade,
  provider_key text not null,
  provider_type text not null,
  enabled boolean not null default true,
  is_primary boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (club_id, provider_key)
);

create unique index if not exists competition_providers_one_primary
  on public.competition_providers(club_id) where is_primary;

alter table public.club_settings enable row level security;
alter table public.competition_rules enable row level security;
alter table public.competition_providers enable row level security;

drop policy if exists club_settings_read on public.club_settings;
create policy club_settings_read on public.club_settings
for select to authenticated
using (club_id = public.my_club_id());

drop policy if exists club_settings_admin_update on public.club_settings;
create policy club_settings_admin_update on public.club_settings
for update to authenticated
using (club_id = public.my_club_id() and public.my_role() = 'club_admin')
with check (club_id = public.my_club_id() and public.my_role() = 'club_admin');

drop policy if exists competition_rules_read on public.competition_rules;
create policy competition_rules_read on public.competition_rules
for select to authenticated
using (club_id = public.my_club_id());

drop policy if exists competition_rules_admin_write on public.competition_rules;
create policy competition_rules_admin_write on public.competition_rules
for all to authenticated
using (club_id = public.my_club_id() and public.my_role() = 'club_admin')
with check (club_id = public.my_club_id() and public.my_role() = 'club_admin');

drop policy if exists competition_providers_read on public.competition_providers;
create policy competition_providers_read on public.competition_providers
for select to authenticated
using (club_id = public.my_club_id());

drop policy if exists competition_providers_admin_write on public.competition_providers;
create policy competition_providers_admin_write on public.competition_providers
for all to authenticated
using (club_id = public.my_club_id() and public.my_role() = 'club_admin')
with check (club_id = public.my_club_id() and public.my_role() = 'club_admin');

grant select on public.club_settings, public.competition_rules, public.competition_providers to authenticated;
grant insert, update, delete on public.competition_rules, public.competition_providers to authenticated;
grant update on public.club_settings to authenticated;

create or replace function public.get_my_club_configuration()
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  me public.profiles;
  result jsonb;
begin
  select * into me from public.profiles where user_id = auth.uid();
  if me.user_id is null or me.club_id is null then return null; end if;

  select jsonb_build_object(
    'club', to_jsonb(c),
    'settings', to_jsonb(cs),
    'rules', coalesce((select jsonb_agg(to_jsonb(r) order by r.age_group) from public.competition_rules r where r.club_id=me.club_id),'[]'::jsonb),
    'providers', coalesce((select jsonb_agg(to_jsonb(p) order by p.is_primary desc,p.provider_key) from public.competition_providers p where p.club_id=me.club_id and p.enabled=true),'[]'::jsonb),
    'teams', coalesce((select jsonb_agg(to_jsonb(t) order by t.age_group,t.name) from public.teams t where t.club_id=me.club_id and t.active=true),'[]'::jsonb)
  ) into result
  from public.clubs c
  left join public.club_settings cs on cs.club_id=c.id
  where c.id=me.club_id;

  return result;
end $$;

revoke all on function public.get_my_club_configuration() from public, anon;
grant execute on function public.get_my_club_configuration() to authenticated;

create or replace function public.get_demo_club_configuration(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  cid uuid;
  result jsonb;
begin
  select club_id into cid from public.club_settings where slug=lower(trim(p_slug)) and is_demo=true and active=true;
  if cid is null then return null; end if;

  select jsonb_build_object(
    'club', jsonb_build_object('id',c.id,'name',c.name),
    'settings', to_jsonb(cs),
    'rules', coalesce((select jsonb_agg(to_jsonb(r) order by r.age_group) from public.competition_rules r where r.club_id=cid),'[]'::jsonb),
    'providers', coalesce((select jsonb_agg(jsonb_build_object('provider_key',p.provider_key,'provider_type',p.provider_type,'enabled',p.enabled,'is_primary',p.is_primary,'config',p.config) order by p.is_primary desc,p.provider_key) from public.competition_providers p where p.club_id=cid and p.enabled=true),'[]'::jsonb),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'age_group',t.age_group,'division',t.division,'season',t.season,'selkent_label',t.selkent_label,'league_name',t.league_name,'active',t.active) order by t.age_group,t.name) from public.teams t where t.club_id=cid and t.active=true),'[]'::jsonb)
  ) into result
  from public.clubs c join public.club_settings cs on cs.club_id=c.id
  where c.id=cid;

  return result;
end $$;

grant execute on function public.get_demo_club_configuration(text) to anon, authenticated;

-- Universal build intentionally includes no club-specific seed data.
-- Clubs and teams are created through self-service onboarding and the master directory.
