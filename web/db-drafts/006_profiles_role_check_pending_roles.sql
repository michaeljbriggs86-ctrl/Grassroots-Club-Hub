-- 006: allow the roles the app already uses. request_coach_access sets role='pending_coach' and
-- the player flow uses 'pending_player'; profiles_role_check does not list them, so the update fails.
-- Widening the allowed set cannot invalidate any existing row.
-- Rollback: restore the previous list (pending, pending_parent, club_admin, coach, assistant_coach, parent, player, revoked)
-- after confirming no row holds pending_coach or pending_player.
begin;
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role = any (array[
  'pending','pending_parent','pending_coach','pending_player','club_admin','coach','assistant_coach','parent','player','revoked'
]::text[]));
commit;
