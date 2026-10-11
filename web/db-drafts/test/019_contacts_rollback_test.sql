-- Synthetic integration test, local throwaway PostgreSQL only, after stub + 019.
-- All user/contact fixtures are rolled back. No real member records involved.
begin;
insert into auth.users select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,12) n;
insert into public.teams values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Team A',9,true),
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Team B',10,true),
 ('10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Other club',9,true);
insert into public.profiles(user_id,club_id,full_name,role)
 select id,case when right(id::text,12)::int=6 then '20000000-0000-0000-0000-000000000002'::uuid else '20000000-0000-0000-0000-000000000001'::uuid end,
 'Synthetic member '||right(id::text,12)::int,
 case right(id::text,12)::int when 1 then 'club_admin' when 2 then 'coach' when 7 then 'coach' when 8 then 'assistant_coach' when 9 then 'pending_parent' when 10 then 'player' when 11 then 'revoked' when 12 then 'coach' else 'parent' end
 from auth.users;
insert into public.coach_team_assignments
 select ('00000000-0000-0000-0000-'||lpad(u::text,12,'0'))::uuid,t.id,t.club_id from (values(2,1),(2,2),(7,2),(8,1),(12,2)) v(u,n) join public.teams t on right(t.id::text,12)::int=n;
insert into public.parent_player_links
 select ('00000000-0000-0000-0000-'||lpad(u::text,12,'0'))::uuid,t.id,t.club_id,'Synthetic child '||u from (values(3,1),(4,1),(5,2),(6,3),(9,1),(10,1),(11,1),(12,1)) v(u,n) join public.teams t on right(t.id::text,12)::int=n;
select set_config('app.uid','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.save_member_contact_details('00000000-0000-0000-0000-000000000003','parent@example.invalid','+44 7700 900123');
select public.test_contact_assert((public.list_contact_directory()->'contacts') @> '[{"user_id":"00000000-0000-0000-0000-000000000003","email":"parent@example.invalid"}]','admin can populate and read parent contact');
select public.test_contact_assert(jsonb_array_length(public.list_contact_directory()->'contacts')=9,'admin sees all approved adults and team memberships only');
select public.test_contact_assert(jsonb_array_length(public.list_contact_directory('10000000-0000-0000-0000-000000000002')->'contacts')=4,'admin team filter');
select set_config('app.uid','00000000-0000-0000-0000-000000000003',true);
select public.test_contact_assert(jsonb_array_length(public.list_contact_directory()->'contacts')=2,'parent sees only A coaches');
select public.test_contact_assert(not (public.list_contact_directory()->'contacts') @> '[{"kind":"parent"}]','parent never sees another parent');
select public.test_contact_assert(public.list_contact_directory()->'self'->>'email'='parent@example.invalid','parent sees own contact separately');
select public.save_member_contact_details('00000000-0000-0000-0000-000000000003','new@example.invalid','020 7946 0123');
select public.test_contact_assert(public.list_contact_directory()->'self'->>'email'='new@example.invalid','self update');
do $$ begin
  begin perform public.list_contact_directory('10000000-0000-0000-0000-000000000002'); raise exception 'FAIL: other team accepted'; exception when others then if sqlerrm='FAIL: other team accepted' then raise; end if; end;
  begin perform public.save_member_contact_details('00000000-0000-0000-0000-000000000004','stolen@example.invalid',''); raise exception 'FAIL: parent edited another'; exception when others then if sqlerrm='FAIL: parent edited another' then raise; end if; end;
  begin perform * from private.member_contact_details; raise exception 'FAIL: direct table readable'; exception when insufficient_privilege then null; end;
end $$;
select set_config('app.uid','00000000-0000-0000-0000-000000000002',true);
select public.test_contact_assert(jsonb_array_length(public.list_contact_directory('10000000-0000-0000-0000-000000000001')->'contacts')=4,'coach sees A parents and assistant, including linked staff parent');
select public.test_contact_assert(jsonb_array_length(public.list_contact_directory('10000000-0000-0000-0000-000000000002')->'contacts')=3,'assigned second team contacts');
select public.test_contact_assert((public.list_contact_directory()->'contacts') @> '[{"user_id":"00000000-0000-0000-0000-000000000003","player_names":["Synthetic child 3"]}]','staff can associate parent with child on team');
do $$ begin
  begin perform public.save_member_contact_details('00000000-0000-0000-0000-000000000003','',''); raise exception 'FAIL: coach edited parent'; exception when others then if sqlerrm='FAIL: coach edited parent' then raise; end if; end;
  begin perform public.list_contact_directory('10000000-0000-0000-0000-000000000003'); raise exception 'FAIL: foreign club readable'; exception when others then if sqlerrm='FAIL: foreign club readable' then raise; end if; end;
end $$;
reset role;
update public.profiles set acting_as_parent=true where user_id='00000000-0000-0000-0000-000000000012';
set local role authenticated;
select set_config('app.uid','00000000-0000-0000-0000-000000000012',true);
select public.test_contact_assert(jsonb_array_length(public.list_contact_directory()->'contacts')=2,'staff parent capacity sees own child team coaches only');
select public.test_contact_assert(public.list_contact_directory()->>'can_manage'='false','parent capacity cannot manage others');
do $$ begin
  begin perform public.list_contact_directory('10000000-0000-0000-0000-000000000002'); raise exception 'FAIL: staff parent capacity leaked coaching team'; exception when others then if sqlerrm='FAIL: staff parent capacity leaked coaching team' then raise; end if; end;
end $$;
select set_config('app.uid','00000000-0000-0000-0000-000000000001',true);
do $$ begin
  begin perform public.save_member_contact_details('00000000-0000-0000-0000-000000000006','',''); raise exception 'FAIL: cross-club admin write'; exception when others then if sqlerrm='FAIL: cross-club admin write' then raise; end if; end;
  begin perform public.save_member_contact_details('00000000-0000-0000-0000-000000000003','bad',''); raise exception 'FAIL: invalid email'; exception when others then if sqlerrm='FAIL: invalid email' then raise; end if; end;
  begin perform public.save_member_contact_details('00000000-0000-0000-0000-000000000003','','1 Road, London'); raise exception 'FAIL: address in phone'; exception when others then if sqlerrm='FAIL: address in phone' then raise; end if; end;
end $$;
select public.save_member_contact_details('00000000-0000-0000-0000-000000000003','','');
select set_config('app.uid','00000000-0000-0000-0000-000000000003',true);
select public.test_contact_assert(public.list_contact_directory()->'self'->>'phone'='','blank clears contact');
reset role;
update public.profiles set role='revoked' where user_id='00000000-0000-0000-0000-000000000003';
set local role authenticated;
do $$ begin
  begin perform public.list_contact_directory(); raise exception 'FAIL: revoked access'; exception when others then if sqlerrm='FAIL: revoked access' then raise; end if; end;
end $$;
select set_config('app.uid','00000000-0000-0000-0000-000000000002',true);
select public.test_contact_assert(not (public.list_contact_directory()->'contacts') @> '[{"user_id":"00000000-0000-0000-0000-000000000003"}]','revoked contact disappears immediately');
reset role;
update public.teams set active=false where id='10000000-0000-0000-0000-000000000001';
set local role authenticated;
select public.test_contact_assert(jsonb_array_length(public.list_contact_directory()->'contacts')=3,'inactive team excluded');
reset role;
select public.test_contact_assert(not has_function_privilege('anon','public.list_contact_directory(uuid)','execute'),'anon RPC denied');
select public.test_contact_assert(not has_table_privilege('authenticated','private.member_contact_details','select'),'no direct table grants');
select public.test_contact_assert(not has_schema_privilege('authenticated','private','usage'),'private schema remains closed');
set local role authenticated;
do $$ declare u integer; begin
  foreach u in array array[9,10,11] loop
    perform set_config('app.uid',('00000000-0000-0000-0000-'||lpad(u::text,12,'0')),true);
    begin perform public.list_contact_directory(); raise exception 'FAIL: unapproved/player access'; exception when others then if sqlerrm='FAIL: unapproved/player access' then raise; end if; end;
    begin perform public.save_member_contact_details(auth.uid(),'test@example.invalid',''); raise exception 'FAIL: unapproved/player write'; exception when others then if sqlerrm='FAIL: unapproved/player write' then raise; end if; end;
  end loop;
  perform set_config('app.uid','',true);
  begin perform public.list_contact_directory(); raise exception 'FAIL: null user access'; exception when others then if sqlerrm='FAIL: null user access' then raise; end if; end;
end $$;
reset role;
select 'PASS: contacts role/team/privacy/write/capacity/revocation assertions; transaction rolling back' as result;
rollback;
select public.test_contact_assert((select count(*)=0 from private.member_contact_details),'contacts fixtures rolled back');
