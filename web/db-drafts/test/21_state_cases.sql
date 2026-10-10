\set ON_ERROR_STOP off
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$ select set_config('app.uid',u::text,false) $$;
do $do$ declare c uuid:=gen_random_uuid(); t12 uuid:=gen_random_uuid(); t10 uuid:=gen_random_uuid();
 adm uuid:=gen_random_uuid(); coach uuid:=gen_random_uuid(); par uuid:=gen_random_uuid(); par2 uuid:=gen_random_uuid(); pp uuid:=gen_random_uuid(); pc uuid:=gen_random_uuid(); par10 uuid:=gen_random_uuid(); pl uuid:=gen_random_uuid();
 st jsonb;
begin
 insert into public.clubs values(c);
 insert into public.teams(id,club_id,age_group,name,season) values(t12,c,12,'Twelve','2026'),(t10,c,10,'Ten','2026');
 insert into auth.users(id,email) select x,x::text||'@x.com' from unnest(array[adm,coach,par,par2,pp,pc,par10,pl]) x;
 insert into public.profiles(user_id,club_id,team_id,role) values(adm,c,null,'club_admin'),(coach,c,t12,'coach'),(par,c,t12,'parent'),(par2,c,t12,'parent'),(pp,c,t12,'pending_parent'),(pc,c,t12,'pending_coach'),(par10,c,t10,'parent'),(pl,c,t12,'player');
 insert into public.parent_player_links(club_id,team_id,parent_user_id,player_name) values(c,t12,par,'Alice  Able'),(c,t12,par2,'Zed Nobody'),(c,t10,par10,'Tia Ten');
 insert into private.player_season_identity(club_id,team_id,season,player_name,shirt_number) values(c,t12,'2026','Alice Able',7),(c,t12,'2026','Bob Brown',9),(c,t10,'2026','Tia Ten',4),(c,t10,'2026','Uma Under',5);
 st:='{"tactics":{"x":1},"squad":[{"name":"Alice Able"},{"name":"Bob Brown"}],"goals":[{"shirtNumber":7,"goals":2},{"shirtNumber":9,"goals":1}],"assists":[],"bookings":[],"awards":[{"shirtNumber":7,"type":"mvp"},{"shirtNumber":9,"type":"mvp"}],
  "matches":[{"opponent":"X","gf":3,"ga":1,"notes":"Bob was poor"}],"tournaments":[{"name":"T","playerNames":["Alice Able","Bob Brown"]}],"features":{}}';
 insert into public.team_state(team_id,state) values(t12,st),(t10,st);
 perform set_config('app.t12',t12::text,false); perform set_config('app.t10',t10::text,false);
 perform set_config('app.par',par::text,false); perform set_config('app.par2',par2::text,false); perform set_config('app.pp',pp::text,false); perform set_config('app.pc',pc::text,false);
 perform set_config('app.coach',coach::text,false); perform set_config('app.par10',par10::text,false); perform set_config('app.pl',pl::text,false);
end $do$;
create or replace function pg_temp.show(label text, u text) returns text language plpgsql as $$
declare s jsonb; r jsonb;
begin
  perform set_config('app.uid',current_setting('app.'||u),false);
  r:=public.get_my_context(); s:=r->'team_state';
  if s is null then return format('%-26s ctx -> NO STATE', label); end if;
  return format('%-26s ctx -> squad=%s goals#=%s awards#=%s notes=%s pn=%s tactics=%s scores=%s',label,
    coalesce((select string_agg(e->>'name',',') from jsonb_array_elements(s->'squad') e),'-'),
    coalesce((select string_agg(e->>'shirtNumber',',') from jsonb_array_elements(s->'goals') e),'-'),
    coalesce((select string_agg(e->>'shirtNumber',',') from jsonb_array_elements(s->'awards') e),'-'),
    (s->'matches'->0) ? 'notes', coalesce((select string_agg(n #>> '{}',',') from jsonb_array_elements(s->'tournaments'->0->'playerNames') n),'-'), s ? 'tactics', (s->'matches'->0) ? 'gf');
end $$;
select pg_temp.show('parent of Alice (U12)','par');
select pg_temp.show('parent, no shirt match','par2');
select pg_temp.show('pending_parent (U12)','pp');
select pg_temp.show('pending_coach (U12)','pc');
select pg_temp.show('coach (U12)','coach');
select pg_temp.show('player (U12 team)','pl');
select pg_temp.show('parent of Tia (U10)','par10');
