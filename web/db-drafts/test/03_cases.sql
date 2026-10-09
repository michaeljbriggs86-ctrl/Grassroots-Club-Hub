-- Run after loading a version of claim_invite. Prints one result line per case.
create or replace function pg_temp.run_case(label text, inv_role text, team_age int) returns text language plpgsql as $$
declare u uuid:=gen_random_uuid(); tm uuid:=gen_random_uuid(); cl uuid:=gen_random_uuid(); adm uuid:=gen_random_uuid(); r jsonb; pr public.profiles;
begin
  insert into auth.users(id,email) values(u,'x@example.com');
  insert into public.teams values(tm,cl,team_age);
  insert into public.profiles(user_id,role) values(u,'pending');
  insert into public.profiles(user_id,club_id,role) values(adm,cl,'club_admin');
  insert into public.invitations(code_hash,role,expires_at,club_id,team_id,created_by)
    values(extensions.digest('CODE','sha256'),inv_role,now()+interval '1 day',cl,tm,adm);
  perform set_config('app.uid',u::text,true);
  begin
    r:=public.claim_invite('CODE');
    select * into pr from public.profiles where user_id=u;
    return format('%-34s -> role=%s approved=%s', label, pr.role, pr.approved_at is not null);
  exception when others then return format('%-34s -> ERROR: %s', label, sqlerrm);
  end;
end $$;
select pg_temp.run_case('coach invite, U10 team','coach',10);
select pg_temp.run_case('assistant_coach invite, U10','assistant_coach',10);
select pg_temp.run_case('parent invite, U10','parent',10);
select pg_temp.run_case('player invite, U15 team','player',15);
select pg_temp.run_case('player invite, U12 team','player',12);
select pg_temp.run_case('unknown role invite ("admin")','admin',15);
