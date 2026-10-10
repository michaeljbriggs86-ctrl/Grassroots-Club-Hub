-- Rolled-back test for draft 013. Paste the WHOLE file into the Supabase SQL editor and run it.
-- It applies 013 inside this run, checks behaviour, then ends with an error on purpose so NOTHING is kept.
-- The error text is the report: every line should say PASS.
do $$
declare
  uid uuid; r text := ''; n int; ok boolean;
begin
  select user_id into uid from public.profiles where role='club_admin' limit 1;

  -- apply 013 body
  revoke all on all tables in schema public from anon;
  revoke all on all sequences in schema public from anon;
  revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;
  grant insert, update on public.match_availability to authenticated;
  grant insert, update on public.coach_match_notes to authenticated;

  perform set_config('request.jwt.claims', json_build_object('sub',uid,'role','authenticated')::text, true);
  set local role authenticated;

  begin select count(*) into n from public.teams; r := r || E'\n' || case when n>0 then 'PASS' else 'FAIL' end || ' authenticated can read teams (' || n || ')';
  exception when others then r := r || E'\nFAIL read teams: ' || sqlerrm; end;

  begin select count(*) into n from public.match_availability; r := r || E'\nPASS authenticated can read match_availability';
  exception when others then r := r || E'\nFAIL read match_availability: ' || sqlerrm; end;

  begin select count(*) into n from public.list_my_coach_teams(); r := r || E'\nPASS definer function list_my_coach_teams still works (' || n || ' rows)';
  exception when others then r := r || E'\nFAIL list_my_coach_teams: ' || sqlerrm; end;

  begin update public.profiles set full_name = full_name; r := r || E'\nFAIL authenticated could still update profiles';
  exception when insufficient_privilege then r := r || E'\nPASS authenticated cannot update profiles'; when others then r := r || E'\nINFO profiles update: ' || sqlerrm; end;

  begin delete from public.team_state; r := r || E'\nFAIL authenticated could still delete team_state';
  exception when insufficient_privilege then r := r || E'\nPASS authenticated cannot delete team_state'; when others then r := r || E'\nINFO team_state delete: ' || sqlerrm; end;

  reset role;
  set local role anon;
  begin select count(*) into n from public.profiles; r := r || E'\nFAIL anon could still read profiles';
  exception when insufficient_privilege then r := r || E'\nPASS anon cannot read profiles'; when others then r := r || E'\nINFO anon profiles: ' || sqlerrm; end;
  begin select count(*) into n from public.list_login_clubs(); r := r || E'\nPASS anon can still list login clubs (' || n || ')';
  exception when others then r := r || E'\nFAIL anon list_login_clubs: ' || sqlerrm; end;
  reset role;

  raise exception 'TEST RESULTS (nothing was kept):%', r;
end $$;
