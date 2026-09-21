-- AI COLLABORATION PROTOCOL NOTE — 2026-09-19
-- STATUS: WRITTEN historical reference only; DO NOT DEPLOY.
-- Any older 'live'/'deployed' wording below is a historical note and is not a current deployment claim.

-- v2.0.28 migrations applied live to Supabase
-- 1) parent_player_links_v1: adds coach-controlled parent↔player links with RLS.
-- 2) match_availability_per_player: changes RSVP uniqueness to team+fixture+parent+player.
-- 3) match_availability_require_linked_player: RLS requires the RSVP player to be linked to the parent account.
