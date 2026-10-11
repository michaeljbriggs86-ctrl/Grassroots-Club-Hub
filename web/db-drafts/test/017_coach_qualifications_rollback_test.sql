-- THROWAWAY Postgres only. Deliberately refuses an existing profiles schema.
begin;
do $$ begin if to_regclass('public.profiles') is not null then raise exception 'Use an empty throwaway database, never Supabase'; end if; end $$;
create role anon nologin;create role authenticated nologin;
create schema auth;create schema private;
create table public.clubs(id uuid primary key);
create table public.profiles(user_id uuid primary key,club_id uuid references public.clubs,role text not null,acting_as_parent boolean not null default false,full_name text,coach_team_id uuid);
create table public.coach_team_assignments(user_id uuid,team_id uuid,club_id uuid);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.parent_player_links(parent_user_id uuid);
create function private.effective_role(p public.profiles) returns text language sql stable as $$select case when p.acting_as_parent and p.role in ('club_admin','coach','assistant_coach') and exists(select 1 from public.parent_player_links l where l.parent_user_id=p.user_id) then 'parent' else p.role end$$;
grant usage on schema public,auth to authenticated;
insert into public.clubs values('00000000-0000-0000-0000-000000000010'),('00000000-0000-0000-0000-000000000020');
insert into public.profiles(user_id,club_id,role) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','club_admin'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000010','coach'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000010','assistant_coach'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000010','parent'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000020','club_admin'),
 ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000020','coach'),
 ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000010','pending_coach'),
 ('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000010','player');
-- @draft017
-- One admin coach through assignments, another through the legacy coach field.
insert into public.profiles(user_id,club_id,role,full_name,coach_team_id) values
 ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000010','club_admin','Legacy admin coach','00000000-0000-0000-0000-000000000100'),
 ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000010','club_admin','Multi-team admin coach',null);
insert into public.coach_team_assignments values
 ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000010'),
 ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000200','00000000-0000-0000-0000-000000000010');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$declare r jsonb; good jsonb:='[{"kind":"dbs","course":"fa_enhanced_dbs","completed_on":"2023-01-01","expires_on":"2026-01-01","club_checked":true}]';bad jsonb;
begin
 if(select count(*) from public.list_coach_qualifications())<>4 then raise exception 'matrix must include 4 unique coaching accounts only';end if;
 if exists(select 1 from public.list_coach_qualifications() q where q.user_id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000008')) then raise exception 'matrix includes pure admin, non-coach or another club';end if;
 if public.get_coach_qualifications('00000000-0000-0000-0000-000000000002')->>'revision'<>'0' then raise exception 'new profile must be empty';end if;
 r:=public.save_coach_qualifications('00000000-0000-0000-0000-000000000002',good,0);
 if r->>'revision'<>'1' or r->'records'->0->>'checked_by'<>'00000000-0000-0000-0000-000000000001' then raise exception 'admin save/check attribution failed';end if;
 if(select revision from public.list_coach_qualifications() where user_id='00000000-0000-0000-0000-000000000002')<>1 then raise exception 'matrix omitted saved record';end if;
 begin perform public.save_coach_qualifications('00000000-0000-0000-0000-000000000002',good,0);raise exception 'stale write accepted';exception when serialization_failure then null;end;
 begin perform public.get_coach_qualifications('00000000-0000-0000-0000-000000000006');raise exception 'other club read accepted';exception when insufficient_privilege then null;end;
 begin perform public.save_coach_qualifications('00000000-0000-0000-0000-000000000006',good,0);raise exception 'other club write accepted';exception when insufficient_privilege then null;end;
 begin perform public.get_coach_qualifications('00000000-0000-0000-0000-000000000004');raise exception 'parent target accepted';exception when insufficient_privilege then null;end;
 for bad in select value from jsonb_array_elements(jsonb_build_array(
  good||good,
  jsonb_build_array(good->0||'{"certificate_number":"forbidden"}'::jsonb),
  jsonb_build_array(good->0||'{"criminal_record":"forbidden"}'::jsonb),
  jsonb_build_array(good->0||'{"course":"unknown"}'::jsonb),
  jsonb_build_array(good->0||'{"kind":"unknown"}'::jsonb),
  jsonb_build_array(good->0||'{"kind":"coaching","course":"fa_i2cf"}'::jsonb),
  jsonb_build_array(good->0||'{"kind":"uefa_licence","course":"uefa_c"}'::jsonb),
  jsonb_build_array(good->0||'{"kind":"safeguarding","course":"fa_safeguarding_children","expires_on":null}'::jsonb),
  jsonb_build_array(good->0||'{"kind":"first_aid","course":"fa_ifaif","expires_on":null}'::jsonb),
  jsonb_build_array(good->0||'{"expires_on":null}'::jsonb),
  jsonb_build_array(good->0||'{"completed_on":"2023-02-29"}'::jsonb),
  jsonb_build_array(good->0||'{"completed_on":"2099-01-01","expires_on":"2102-01-01"}'::jsonb),
  jsonb_build_array(good->0||'{"expires_on":"2022-01-01"}'::jsonb),
  jsonb_build_array(good->0||'{"club_checked":"true"}'::jsonb)
 )) loop
  begin perform public.save_coach_qualifications('00000000-0000-0000-0000-000000000002',bad,1);raise exception 'bad data accepted: %',bad;exception when invalid_parameter_value then null;end;
 end loop;
 r:=public.save_coach_qualifications('00000000-0000-0000-0000-000000000002',good,1);
 if r->'records'->0->>'checked_at' is null then raise exception 'verification missing';end if;
 r:=public.save_coach_qualifications('00000000-0000-0000-0000-000000000002','[{"kind":"safeguarding","course":"fa_safeguarding_children","completed_on":"2024-01-01","expires_on":"2026-01-01","club_checked":false},{"kind":"first_aid","course":"fa_ifaif","completed_on":"2024-01-01","expires_on":"2027-01-01","club_checked":false}]',2);
 if r->'records'->0 ? 'checked_by' then raise exception 'unverified record attributed';end if;
 if jsonb_array_length(r->'records')<>2 then raise exception 'safeguarding and first aid not saved';end if;
 r:=public.save_coach_qualifications('00000000-0000-0000-0000-000000000002','[]',3);
 if r->>'revision'<>'4' or jsonb_array_length(r->'records')<>0 then raise exception 'remove record failed';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
do $$begin
 if(select count(*) from public.list_coach_qualifications())<>1 or not exists(select 1 from public.list_coach_qualifications() where user_id='00000000-0000-0000-0000-000000000006') then raise exception 'other admin matrix must be scoped to its own club';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$begin
 begin perform public.list_coach_qualifications();raise exception 'coach listed club matrix';exception when insufficient_privilege then null;end;
 perform public.get_coach_qualifications('00000000-0000-0000-0000-000000000002');
 begin perform public.get_coach_qualifications('00000000-0000-0000-0000-000000000003');raise exception 'coach read colleague';exception when insufficient_privilege then null;end;
 begin perform public.save_coach_qualifications('00000000-0000-0000-0000-000000000002','[]',4);raise exception 'coach self verified';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
do $$begin perform public.get_coach_qualifications('00000000-0000-0000-0000-000000000003');end $$;
do $$declare person text;begin
 foreach person in array array['00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000099',''] loop
  perform set_config('request.jwt.claim.sub',person,true);
  begin perform public.get_coach_qualifications('00000000-0000-0000-0000-000000000002');raise exception 'non-staff read accepted';exception when insufficient_privilege then null;end;
  begin perform public.list_coach_qualifications();raise exception 'non-admin listed matrix';exception when insufficient_privilege then null;end;
 end loop;
end $$;
reset role;
insert into public.parent_player_links values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
update public.profiles set acting_as_parent=true where user_id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
set local role authenticated;
do $$declare person text;begin
 foreach person in array array['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'] loop
  perform set_config('request.jwt.claim.sub',person,true);
  begin perform public.get_coach_qualifications(person::uuid);raise exception 'parent capacity read accepted';exception when insufficient_privilege then null;end;
  begin perform public.save_coach_qualifications('00000000-0000-0000-0000-000000000002','[]',4);raise exception 'parent capacity write accepted';exception when insufficient_privilege then null;end;
  begin perform public.list_coach_qualifications();raise exception 'parent capacity listed matrix';exception when insufficient_privilege then null;end;
 end loop;
end $$;
reset role;
do $$begin
 if has_table_privilege('authenticated','private.coach_qualification_profiles','select') or has_table_privilege('authenticated','private.coach_qualification_profiles','update') or has_table_privilege('anon','private.coach_qualification_audit','select') then raise exception 'direct grant leaked';end if;
 if has_function_privilege('anon','public.list_coach_qualifications()','execute') or not has_function_privilege('authenticated','public.list_coach_qualifications()','execute') then raise exception 'matrix RPC grants incorrect';end if;
 if has_function_privilege('anon','public.get_coach_qualifications(uuid)','execute') or has_function_privilege('anon','public.save_coach_qualifications(uuid,jsonb,bigint)','execute') or has_function_privilege('authenticated','private.coach_qualification_club(uuid,boolean)','execute') then raise exception 'function grant leaked';end if;
 if(select count(*) from private.coach_qualification_audit)<>4 then raise exception 'audit count incorrect';end if;
 if(select revision from private.coach_qualification_profiles)<>4 then raise exception 'rejected writes changed revision';end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname='coach_qualification_profiles' and c.relrowsecurity) then raise exception 'RLS missing';end if;
end $$;
rollback;
