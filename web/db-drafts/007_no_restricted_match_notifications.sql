-- 007 (revised 2026-10-10 after Mike's instruction): nobody is notified about match report changes.
-- Mike: "Only changes in upcoming matches require automatic notifications. No one needs to be told about match report changes."
-- Part 1: notify_match_report and notify_match_reopened become no-ops that return 0 (signatures and grants unchanged,
--         so the app keeps working; the app also stops calling them).
-- Part 2: remove existing match_report notification rows (notification rows only, no match or child data).
-- notify_fixture_change (upcoming fixture changes) is NOT touched.
-- Rollback for part 1: restore the previous bodies from the live definitions captured in the PR description.
begin;
create or replace function public.notify_match_report(p_team_id uuid, p_match_id text, p_opponent text, p_score text)
returns integer language plpgsql security definer set search_path to 'public' as $function$
begin return 0; end $function$;
create or replace function public.notify_match_reopened(p_team_id uuid, p_match_id text, p_opponent text)
returns integer language plpgsql security definer set search_path to 'public' as $function$
begin return 0; end $function$;
delete from public.app_notifications where type='match_report';
commit;
