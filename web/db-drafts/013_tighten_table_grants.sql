-- 013: tighten table grants (safeguarding gate G6). DRAFT, not applied. Apply only on Mike's "Apply 013".
--
-- Today anon and authenticated hold full DML (insert/update/delete/truncate...) on most public tables.
-- Row Level Security already blocks misuse, so this is defence in depth: if one policy is ever
-- mistaken or a table is added without RLS, the API role still cannot write or empty it.
--
-- The browser app only talks to tables directly in these places (checked in cloud.js):
--   teams (read), selkent_team_directory (read), match_attendance (read), fixture_availability_settings (read),
--   match_availability (read + upsert), coach_match_notes (read + upsert).
-- Everything else goes through SECURITY DEFINER functions, which are unaffected by table grants.
-- Policies that look at other tables need SELECT, so authenticated keeps SELECT everywhere.

begin;

-- 1. Signed-out visitors: no direct table access at all (login lists use definer functions).
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 2. Signed-in users: keep SELECT (RLS decides which rows), remove every write-type privilege.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;

-- 3. Give back only the two tables the app writes to directly (RLS policies still apply).
grant insert, update on public.match_availability to authenticated;
grant insert, update on public.coach_match_notes to authenticated;

-- 4. Future tables do not get open grants by default.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from authenticated;

commit;

-- Verification (run after applying; expect: anon_tables_with_any_grant = 0, auth_write_tables = 2)
-- select count(distinct table_name) as anon_tables_with_any_grant
--   from information_schema.role_table_grants where table_schema='public' and grantee='anon';
-- select count(distinct table_name) as auth_write_tables
--   from information_schema.role_table_grants where table_schema='public' and grantee='authenticated'
--   and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
--
-- Rollback (if anything in the app breaks):
-- grant insert, update, delete on all tables in schema public to authenticated;
