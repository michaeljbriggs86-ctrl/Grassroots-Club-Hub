-- 007: stop telling parents and players that a restricted age group's match report changed (Mike, 2026-10-10).
-- U7 to U11 results are never published to parents, so these notifications only ever say "restricted".
-- Part 1 stops new ones. Part 2 removes the existing ones (19 rows at drafting time, match_report type, U7-U11 teams only).
-- Rollback for part 1: restore the two function bodies from git history of the live definitions (captured in the PR).
-- Part 2 deletes notification rows only, no match or child data.
begin;
do $mig$
declare d text; g text; fnname text;
begin
  foreach fnname in array array['public.notify_match_report(uuid,text,text,text)','public.notify_match_reopened(uuid,text,text)'] loop
    select pg_get_functiondef(fnname::regprocedure) into d;
    -- the two live bodies format this check differently, so match whichever is present
    g := case when position($g$  if t.id is null then raise exception 'Team not available'; end if;$g$ in d)>0
              then $g$  if t.id is null then raise exception 'Team not available'; end if;$g$
              when position(E'  if t.id is null then\n    raise exception \'Team not available\';\n  end if;' in d)>0
              then E'  if t.id is null then\n    raise exception \'Team not available\';\n  end if;'
              else null end;
    if g is null then raise exception '% body changed; review before applying', fnname; end if;
    d:=replace(d,g,g||E'\n  if public.team_player_age(t.age_group,t.selkent_label) between 7 and 11 then return 0; end if;');
    execute d;
  end loop;
end $mig$;
delete from public.app_notifications n using public.teams t
 where n.team_id=t.id and n.type='match_report'
   and public.team_player_age(t.age_group,t.selkent_label) between 7 and 11;
commit;
