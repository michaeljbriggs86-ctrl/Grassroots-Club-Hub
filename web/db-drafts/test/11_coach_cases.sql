\set ON_ERROR_STOP off
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$ select set_config('app.uid',u::text,false) $$;
create or replace function pg_temp.try(label text, sqltext text) returns text language plpgsql as $$
begin execute sqltext; return label||' -> ok'; exception when others then return label||' -> ERROR: '||sqlerrm; end $$;
do $$ declare c1 uuid:=gen_random_uuid(); c2 uuid:=gen_random_uuid(); t1 uuid:=gen_random_uuid(); t2 uuid:=gen_random_uuid();
 admin1 uuid:=gen_random_uuid(); admin2 uuid:=gen_random_uuid(); coach0 uuid:=gen_random_uuid(); newc uuid:=gen_random_uuid(); inv uuid:=gen_random_uuid(); par uuid:=gen_random_uuid(); rid uuid; r text;
begin
 perform set_config('app.c1',c1::text,false);
 insert into public.clubs values(c1),(c2);
 insert into public.teams(id,club_id,age_group,name) values(t1,c1,12,'A'),(t2,c2,12,'B');
 insert into auth.users(id,email) values(admin1,'a1@x.com'),(admin2,'a2@x.com'),(coach0,'c0@x.com'),(newc,'n@x.com'),(inv,'p@access.club.app'),(par,'par@x.com');
 insert into public.profiles(user_id,club_id,role,full_name) values(admin1,c1,'club_admin','Admin One'),(admin2,c2,'club_admin','Admin Two'),(coach0,c1,'coach','Existing Coach'),(newc,null,'pending','New Coach'),(inv,null,'pending','Invite Acct'),(par,c1,'parent','A Parent');
 perform set_config('app.t1',t1::text,false); perform set_config('app.newc',newc::text,false); perform set_config('app.admin1',admin1::text,false);
 perform set_config('app.admin2',admin2::text,false); perform set_config('app.coach0',coach0::text,false); perform set_config('app.inv',inv::text,false); perform set_config('app.par',par::text,false);
end $$;
select pg_temp.as_user(current_setting('app.inv')::uuid);
select pg_temp.try('invite-style account requests','select public.request_coach_access('''||current_setting('app.t1')||''',''coach'')');
select pg_temp.as_user(current_setting('app.par')::uuid);
select pg_temp.try('existing parent requests coach','select public.request_coach_access('''||current_setting('app.t1')||''',''coach'')');
select pg_temp.as_user(current_setting('app.coach0')::uuid);
select pg_temp.try('existing coach requests again','select public.request_coach_access('''||current_setting('app.t1')||''',''coach'')');
select pg_temp.as_user(current_setting('app.newc')::uuid);
select pg_temp.try('bad role "club_admin"','select public.request_coach_access('''||current_setting('app.t1')||''',''club_admin'')');
select pg_temp.try('new user requests coach','select public.request_coach_access('''||current_setting('app.t1')||''',''coach'')');
select 'profile after request -> role='||role||' approved='||(approved_at is not null) from public.profiles where user_id=current_setting('app.newc')::uuid;
select 'admin notified -> '||count(*) from public.app_notifications where recipient_user_id=current_setting('app.admin1')::uuid and type='coach_access_request';
select pg_temp.as_user(current_setting('app.coach0')::uuid);
select pg_temp.try('coach lists requests','select * from public.list_pending_coach_requests()');
select pg_temp.as_user(current_setting('app.admin2')::uuid);
select 'other-club admin sees -> '||count(*) from public.list_pending_coach_requests();
select set_config('app.rid',(select id::text from public.coach_access_requests limit 1),false);
select pg_temp.try('other-club admin approves','select public.review_coach_request('''||current_setting('app.rid')||''',true)');
select pg_temp.as_user(current_setting('app.coach0')::uuid);
select pg_temp.try('coach approves','select public.review_coach_request('''||current_setting('app.rid')||''',true)');
select pg_temp.as_user(current_setting('app.admin1')::uuid);
select 'own admin sees -> '||count(*) from public.list_pending_coach_requests();
select pg_temp.try('own admin approves','select public.review_coach_request('''||current_setting('app.rid')||''',true)');
select 'profile after approval -> role='||role||' approved='||(approved_at is not null)||' team_set='||(team_id=current_setting('app.t1')::uuid) from public.profiles where user_id=current_setting('app.newc')::uuid;
select pg_temp.try('approve twice','select public.review_coach_request('''||current_setting('app.rid')||''',true)');
