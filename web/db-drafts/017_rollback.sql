-- REQUIRES separate explicit approval. This deletes qualification metadata/audit rows.
-- Export a protected backup first if 017 has received real records. Never use for routine undo.
drop function if exists public.save_coach_qualifications(uuid,jsonb,bigint);
drop function if exists public.get_coach_qualifications(uuid);
drop function if exists private.coach_qualification_club(uuid,boolean);
drop table if exists private.coach_qualification_audit;
drop table if exists private.coach_qualification_profiles;
