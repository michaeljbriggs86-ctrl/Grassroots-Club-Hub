-- TESTED CANDIDATE. Do not apply live without Mike's explicit approval naming
-- viewer_age_privacy_fail_closed (Architecture section 2.10).
-- Repair the existing nonstaff privacy boundary only. Preserve staff hydration,
-- U12+ parent projection, signatures, owners, ACLs and function configuration.
-- All guards run before any replacement; this single DO statement is atomic.
do $viewer_age_privacy$
declare
  viewer_def text := pg_get_functiondef('private.state_for_viewer(jsonb,uuid,uuid,text,integer)'::regprocedure);
  team_def text := pg_get_functiondef('public.get_team_state_for_me(uuid)'::regprocedure);
  context_def text := pg_get_functiondef('public.get_my_context()'::regprocedure);
begin
  if md5(viewer_def) <> 'f6768a55ce8735767116b0731f24412c' then
    raise exception 'viewer_age_privacy_fail_closed: state_for_viewer changed; review current definition';
  end if;
  if md5(team_def) <> '37cf9b15e0bf2dda4a4cab473b2e4da8' then
    raise exception 'viewer_age_privacy_fail_closed: get_team_state_for_me changed; review current definition';
  end if;
  if md5(context_def) <> 'bb4ef4ca0fe840bf0c9e68d0be6bb8d4' then
    raise exception 'viewer_age_privacy_fail_closed: get_my_context changed; review current definition';
  end if;

  execute replace(viewer_def,
    'eff_age int := coalesce(p_age, 7);',
    'eff_age int := case when p_age is null or p_age<7 then 7 else p_age end;');
  execute replace(team_def,
    'restricted:=((age is null or age between 7 and 11) and eff in (''parent'',''player''));',
    'restricted:=((age is null or age<=11) and eff in (''parent'',''player''));');
  execute replace(context_def,
    'is_restricted:=((target_age is null or target_age between 7 and 11) and p.role in (''parent'',''player''));',
    'is_restricted:=((target_age is null or target_age<=11) and p.role in (''parent'',''player''));');
end
$viewer_age_privacy$;
