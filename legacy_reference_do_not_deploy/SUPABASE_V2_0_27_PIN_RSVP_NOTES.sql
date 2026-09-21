-- AI COLLABORATION PROTOCOL NOTE — 2026-09-19
-- STATUS: WRITTEN historical reference only; DO NOT DEPLOY.
-- Any older 'live'/'deployed' wording below is a historical note and is not a current deployment claim.

-- v2.0.27 database additions. Applied to live Supabase project 2026-09-14.
-- Adds approved-parent PIN status fields, secure match availability and coaching-only notes.
-- See live migration: pin_access_availability_coach_notes.

alter table public.profiles add column if not exists pin_set_at timestamptz;
alter table public.profiles add column if not exists pin_reset_required boolean not null default false;
alter table public.profiles add column if not exists pin_failed_attempts integer not null default 0;
alter table public.profiles add column if not exists pin_locked_until timestamptz;
alter table public.profiles add column if not exists pin_last_reset_at timestamptz;

-- The live migration also creates:
-- public.list_team_members_v2(uuid)
-- public.match_availability with RLS
-- public.coach_match_notes with RLS
