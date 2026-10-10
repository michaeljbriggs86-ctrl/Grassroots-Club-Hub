-- Step 5 (proposed 2026-10-10): the coach "through to next round" marker (team_state key cupProgress) is staff only.
-- It reveals a U7-U11 cup result, so parents and players must never receive it.
-- Method: take the LIVE definition of private.state_for_viewer, replace exactly two occurrences
-- (player branch and parent branch) of  v := v - 'tactics';  with  v := v - 'tactics' - 'cupProgress';  and re-create it.
-- Fails closed if the live text is not exactly as expected (anything but 2 occurrences).
-- Rollback: same statement with the replacement reversed.
do $mig$
declare d text; n int;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace s on s.oid=p.pronamespace
  where s.nspname='private' and p.proname='state_for_viewer';
  n := (length(d) - length(replace(d, $a$v := v - 'tactics';$a$, ''))) / length($a$v := v - 'tactics';$a$);
  if n <> 2 then raise exception 'state_for_viewer changed: expected 2 occurrences, found %', n; end if;
  d := replace(d, $a$v := v - 'tactics';$a$, $b$v := v - 'tactics' - 'cupProgress';$b$);
  execute d;
end $mig$;
