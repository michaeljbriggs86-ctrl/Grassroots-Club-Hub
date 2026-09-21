-- Grassroots Club Hub v2.2.4 — reusable player access credentials
-- STATUS: WRITTEN 2026-09-19. NOT DEPLOYED. DO NOT describe as LIVE/BUILT.
--
-- Purpose:
--   U15-only player access without collecting a player's email address or phone number.
--   A Club Admin / Coach / Assistant Coach generates a reusable code for a named U15 player.
--   The raw code is returned once and is never stored; only a peppered SHA-256 hash is stored.
--   Login is handled only by the `player-access` Edge Function using service-role access.

create table if not exists public.player_access_credentials (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_name text not null,
  player_name_key text not null,
  user_id uuid null references auth.users(id) on delete set null,
  code_hash text not null,
  active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now(),
  last_used_at timestamptz null,
  constraint player_access_name_len check (char_length(btrim(player_name)) between 2 and 120),
  constraint player_access_name_key_len check (char_length(player_name_key) between 2 and 120),
  constraint player_access_hash_shape check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint player_access_team_player_unique unique (team_id, player_name_key),
  constraint player_access_code_hash_unique unique (code_hash)
);

create index if not exists player_access_credentials_club_idx
  on public.player_access_credentials(club_id);

create index if not exists player_access_credentials_user_idx
  on public.player_access_credentials(user_id)
  where user_id is not null;

alter table public.player_access_credentials enable row level security;

-- Deliberately no client-facing policies and no grants to anon/authenticated.
-- The Edge Function owns all reads/writes through the service role after performing
-- its own authorisation and U15 checks.
revoke all on table public.player_access_credentials from anon, authenticated;

comment on table public.player_access_credentials is
  'Server-only U15 reusable player access credentials. Raw access codes are never stored.';
