Directory subsystem: dormant, not in current scope
This covers the directory_* tables and the functions built around them, including provision_club_from_fa_import and seed_findfootball_*.
STATUS AS OF 2026-09-18:
Not called by any scheduled cron job (verified against cron.job and cron.job_run_details).
Not used by the current onboarding path. create_club_onboarding_internal explicitly rejects any provider other than 'selkent' or 'manual'. Team lookups run through selkent_team_directory, a separate table this subsystem does not touch.
Built as scaffolding for a possible future multi-league national directory. It is not part of the current Selkent-only product and should not be assumed to be tested, current, or safe to call.
Data currently in directory_clubs/directory_teams/directory_leagues:
directory_clubs: provider_key=findfootball -> 623 rows
directory_clubs: provider_key=fulltime -> 33 rows
directory_clubs: provider_key=selkent -> 125 rows
directory_leagues: provider_key=fulltime -> 451 rows
directory_leagues: provider_key=selkent -> 1 row
directory_teams: provider_key=fulltime -> 481 rows
directory_teams: provider_key=selkent -> 1061 rows
LIVE ACL RE-CHECK ON 2026-09-18:
The earlier statement that every function in this subsystem grants EXECUTE only to postgres and service_role is not strictly true in the live database. No grants were changed by this documentation task.
The exact requested export filter (directory_* plus provision_club_from_fa_import and seed_findfootball_*) currently matches 11 live functions.
Four of those literal directory_* functions currently show broader ACLs: directory_auto_route_failed_crawl, directory_norm, directory_population_completion_qa_trigger, and directory_queue_browser_from_fallback.
A broader dependency scan also finds directory-related functions with authenticated/public EXECUTE outside the literal directory_* name prefix, including directory search/read helpers. Treat "dormant" as "not in the current product flow", not as proof that no authenticated RPC can reach any directory-related helper.
EDGE FUNCTION STATUS ON 2026-09-18:
directory-source-acquire is still deployed and ACTIVE in Supabase Functions, version 5, with verify_jwt=false.
It is not safe to describe the endpoint as having no caller: public.dispatch_directory_crawl_job(uuid) performs net.http_post directly to the live directory-source-acquire URL.
public.dispatch_queued_directory_crawls(integer) calls dispatch_directory_crawl_job(uuid).
No cron job currently calls directory-source-acquire, dispatch_directory_crawl_job, or dispatch_queued_directory_crawls, and no additional SQL caller of dispatch_queued_directory_crawls was found.
No other currently deployed Edge Function source directly references the directory-source-acquire slug.
The endpoint has therefore been left untouched. Removing a deployed live endpoint is a separate decision from documenting dormant SQL.
BEFORE THIS IS EVER ACTIVATED:
Re-verify every function against current data protection and FA-rules requirements at that time.
Re-check execute grants: this subsystem must stay inaccessible to authenticated unless a deliberate decision is made otherwise.
Confirm whether the directory-source-acquire Edge Function is still deployed and what it currently does.
DO NOT:
Grant authenticated execute rights on any function in this list without a fresh review.
Add a cron job calling anything in this subsystem without the same.
Assume this data is current.
ARCHIVAL NOTE:
directory_subsystem_reference.sql beside this file is a snapshot of the full SQL definitions returned by the exact requested pg_proc / pg_get_functiondef name filter as of 2026-09-18.
It is reference material only. Do not deploy it as a migration.
This documentation/export task did not drop any table or function and did not change any EXECUTE grant.
