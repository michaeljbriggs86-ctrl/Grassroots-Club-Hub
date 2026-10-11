-- Local throwaway database only, after stub + both 019 drafts.
begin;
insert into auth.users select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,7) n;
insert into public.profiles(user_id,club_id,full_name,role)
 select id,case when right(id::text,12)::int=6 then '20000000-0000-0000-0000-000000000002'::uuid else '20000000-0000-0000-0000-000000000001'::uuid end,
 'Synthetic member '||right(id::text,12)::int,
 case right(id::text,12)::int when 1 then 'club_admin' when 2 then 'coach' when 7 then 'revoked' else 'parent' end from auth.users;
select set_config('app.uid','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.save_member_contact_details('00000000-0000-0000-0000-000000000003','old@example.invalid','07700 900123');
select public.test_contact_assert(public.import_member_contact_details('[{"user_id":"00000000-0000-0000-0000-000000000003","email":"new@example.invalid"},{"user_id":"00000000-0000-0000-0000-000000000004","phone":"020 7946 0123"}]')->>'imported'='2','bulk imports two contacts');
select public.test_contact_assert((public.list_contact_directory()->'contacts') @> '[{"user_id":"00000000-0000-0000-0000-000000000003","email":"new@example.invalid","phone":"07700 900123"}]','omitted phone preserved');
select public.import_member_contact_details('[{"user_id":"00000000-0000-0000-0000-000000000003","email":""}]');
select public.test_contact_assert((public.list_contact_directory()->'contacts') @> '[{"user_id":"00000000-0000-0000-0000-000000000003","email":"","phone":"07700 900123"}]','explicit empty string clears email only');
do $$ declare batch jsonb; begin
 foreach batch in array array[
  'null'::jsonb,'{}'::jsonb,'[]'::jsonb,'[1]'::jsonb,
  '[{"user_id":"00000000-0000-0000-0000-000000000003","address":"1 Road","email":"a@example.invalid"}]'::jsonb,
  '[{"user_id":"00000000-0000-0000-0000-000000000003","email":null}]'::jsonb,
  '[{"user_id":"00000000-0000-0000-0000-000000000003","phone":123}]'::jsonb,
  '[{"user_id":"00000000-0000-0000-0000-000000000003"}]'::jsonb,
  '[{"user_id":"invalid","email":"a@example.invalid"}]'::jsonb,
  '[{"user_id":"00000000-0000-0000-0000-000000000003","phone":"1 Road"}]'::jsonb,
  '[{"user_id":"00000000-0000-0000-0000-000000000003","email":"first@example.invalid"},{"user_id":"00000000-0000-0000-0000-000000000003","email":"second@example.invalid"}]'::jsonb,
  '[{"user_id":"00000000-0000-0000-0000-000000000003","email":"would-save@example.invalid"},{"user_id":"00000000-0000-0000-0000-000000000004","email":"bad"}]'::jsonb,
  '[{"user_id":"00000000-0000-0000-0000-000000000003","email":"would-save@example.invalid"},{"user_id":"00000000-0000-0000-0000-000000000006","email":"foreign@example.invalid"}]'::jsonb,
  '[{"user_id":"00000000-0000-0000-0000-000000000003","email":"would-save@example.invalid"},{"user_id":"00000000-0000-0000-0000-000000000007","email":"revoked@example.invalid"}]'::jsonb,
  (select jsonb_agg(jsonb_build_object('user_id','00000000-0000-0000-0000-000000000003','email','a@example.invalid')) from generate_series(1,501))
 ] loop
  begin perform public.import_member_contact_details(batch);raise exception 'FAIL: invalid batch accepted';
  exception when others then if sqlerrm='FAIL: invalid batch accepted' then raise; end if; end;
  perform public.test_contact_assert((public.list_contact_directory()->'contacts') @> '[{"user_id":"00000000-0000-0000-0000-000000000003","email":"","phone":"07700 900123"}]','invalid batch rolls back earlier rows');
 end loop;
end $$;
do $$ declare u integer; begin
 foreach u in array array[2,3,7] loop
  perform set_config('app.uid',('00000000-0000-0000-0000-'||lpad(u::text,12,'0')),true);
  begin perform public.import_member_contact_details('[{"user_id":"00000000-0000-0000-0000-000000000003","email":"a@example.invalid"}]');raise exception 'FAIL: non-admin import accepted';
  exception when others then if sqlerrm='FAIL: non-admin import accepted' then raise; end if; end;
 end loop;
 perform set_config('app.uid','',true);
 begin perform public.import_member_contact_details('[]');raise exception 'FAIL: unsigned import accepted';
 exception when others then if sqlerrm='FAIL: unsigned import accepted' then raise; end if; end;
end $$;
reset role;
insert into public.parent_player_links values('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Synthetic child');
update public.profiles set acting_as_parent=true where user_id='00000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('app.uid','00000000-0000-0000-0000-000000000001',true);
do $$ begin
 begin perform public.import_member_contact_details('[{"user_id":"00000000-0000-0000-0000-000000000003","email":"a@example.invalid"}]');raise exception 'FAIL: parent capacity import accepted';
 exception when others then if sqlerrm='FAIL: parent capacity import accepted' then raise; end if; end;
end $$;
reset role;
select public.test_contact_assert(not has_function_privilege('anon','public.import_member_contact_details(jsonb)','execute'),'anon import denied');
select public.test_contact_assert(not has_schema_privilege('authenticated','private','usage'),'private schema stays closed');
rollback;
select public.test_contact_assert((select count(*)=0 from private.member_contact_details),'import fixtures rolled back');
