-- AI COLLABORATION PROTOCOL NOTE — 2026-09-19
-- STATUS: WRITTEN historical reference only; DO NOT DEPLOY.
-- Any older 'live'/'deployed' wording below is a historical note and is not a current deployment claim.

-- v2.0.33 live migration: player app access is restricted to U15 squads only.
-- Applied to Supabase project obntycksmkcnkprrcutg.
-- create_invite(...) and claim_invite_for_device(...) now reject player-role access unless teams.age_group = 15.
