// Isolated PostgreSQL permission, evidence and rollback tests; no live users or emails.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.PITCHKIND_PGLITE_PATH||process.argv[2]||'@electric-sql/pglite');
const root=path.resolve(__dirname,'../../..'),uid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
async function registrationFixture(){
 const db=new PGlite(),q=(s,p=[])=>db.query(s,p);let checks=0;
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);
 create table public.clubs(id uuid primary key,name text);
 create table public.profiles(user_id uuid primary key,club_id uuid,role text default 'pending',team_id uuid,coach_team_id uuid,full_name text default '',access_method text default 'email',approved_at timestamptz,approved_by uuid,updated_at timestamptz,acting_as_parent boolean default false);
 create table public.teams(id uuid primary key,club_id uuid,name text,age_group int,selkent_label text,season text,active boolean);
 create table public.competition_rules(club_id uuid,age_group int,max_registered int);
 create table public.team_state(team_id uuid primary key,state jsonb,revision bigint,updated_at timestamptz,updated_by uuid);
 create table public.team_state_history(id bigserial primary key,team_id uuid,revision bigint,state jsonb,archived_at timestamptz,archived_by uuid);
 create table private.player_season_identity(club_id uuid,team_id uuid,season text,player_name text,shirt_number integer,player_role text,player_status text,updated_at timestamptz,unique(team_id,season,player_name));
 create table public.parent_access_requests(id uuid primary key default gen_random_uuid(),club_id uuid,team_id uuid,user_id uuid,child_name text,status text,reviewed_at timestamptz,reviewed_by uuid,updated_at timestamptz,unique(user_id,team_id,child_name));
 create table public.parent_player_links(id uuid default gen_random_uuid(),club_id uuid,team_id uuid,parent_user_id uuid,player_name text,shirt_number int,created_by uuid,created_at timestamptz default now(),unique(team_id,parent_user_id,player_name));
 create table public.app_notifications(id uuid default gen_random_uuid(),club_id uuid,team_id uuid,recipient_user_id uuid,type text,title text,body text,entity_key text,created_at timestamptz default now(),read_at timestamptz);
 create unique index app_notice_key on public.app_notifications(recipient_user_id,type,entity_key) where entity_key is not null;
 create function public.team_player_age(integer,text) returns integer language sql immutable as $$select $1$$;
 create function public.team_identity_norm(text) returns text language sql immutable as $$select lower(regexp_replace(btrim(coalesce($1,'')),'\\s+',' ','g'))$$;
 create function public.sanitize_mini_soccer_state(jsonb,int) returns jsonb language sql as $$select $1-'goals'-'assists'-'awards'$$;
 grant usage on schema public to authenticated,anon,service_role;
 `);
 const old=JSON.parse(fs.readFileSync(path.join(__dirname,'player-onboarding-observed-contract.json')));
 for(const name of ['lookup_u11_shirt_number','hydrate_u11_staff_state','normalize_u11_state','can_edit_team'])await db.exec(old[name]);
 const defs=JSON.parse(fs.readFileSync(path.join(__dirname,'registration-observed-contract.json')));
 for(const name of ['effective_role','can_read_team','can_read_full_team_state','state_for_viewer','get_my_context','approve_parent_request','list_announcements_for_me','list_notifications_for_me'])await db.exec(defs.find(x=>x.name===name).definition);
 await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261012233918_admin_player_onboarding.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261015072951_parent_led_registration.sql'),'utf8'));
 const club=uid(100),foreign=uid(101),team=uid(200),team2=uid(201),admin=uid(1),parent=uid(2),other=uid(3),coach=uid(4),outsider=uid(5),unverified=uid(6),revoked=uid(7),pack=uid(300);
 await q('insert into public.clubs values($1,\'Invented Club\'),($2,\'Other Invented Club\')',[club,foreign]);
 for(const [id,role,cid,email,verified] of [[admin,'club_admin',club,'admin@example.invalid',true],[parent,'pending',null,'parent@example.invalid',true],[other,'pending',null,'other@example.invalid',true],[coach,'coach',club,'coach@example.invalid',true],[outsider,'club_admin',foreign,'outsider@example.invalid',true],[unverified,'pending',null,'unverified@example.invalid',false],[revoked,'revoked',club,'revoked@example.invalid',true]]){
  await q('insert into public.profiles(user_id,role,club_id,full_name) values($1,$2,$3,$4)',[id,role,cid,'Invented '+role]);await q('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[id,email,verified?'2026-10-01T00:00Z':null]);
 }
 for(const id of [team,team2])await q('insert into public.teams values($1,$2,\'Invented Greens\',9,\'U9 Invented Greens\',\'2026/27\',true)',[id,club]);
 await q('insert into public.competition_rules values($1,9,10)',[club]);
 const hash=s=>require('node:crypto').createHash('sha256').update(s).digest('hex');
 const documents={terms:{text:'Full invented current terms',sha256:hash('Full invented current terms'),title:'Registration terms'},conduct:{text:'Full invented code',sha256:hash('Full invented code'),title:'Code of conduct'},declarations:{fee_summary:'Fictional current season terms: a registration fee and monthly subscriptions due on the first day of each month from the start of the season until the final month. Read the full current terms.',membership:'I would like my child to be registered with this fictional club for the selected season and understand that membership fees must be paid on time and up to date before the player trains or plays. This is an invented declaration for layout and permission testing only.',weather:'If the training pitch is waterlogged or affected by adverse weather, training may move to another site, potentially on another day or at another time to accommodate the session. This longer fictional acknowledgement tests readable reflow.',photos:'From time to time this fictional club may wish to take photographs to promote its activities in local, regional or national media. These pictures would be used only for the described promotional purposes. Choose whether you allow this for your child; declining does not affect registration eligibility.',conduct:'I have read and agree to follow the full fictional club, player and parent or spectator codes and the terms of registration.'}};
 await q('insert into private.registration_packs(id,club_id,season,version,documents,enabled) values($1,$2,\'2026/27\',\'invented-v1\',$3,true)',[pack,club,documents]);await q('insert into private.registration_pack_teams values($1,$2)',[pack,team]);
 const as=async(id,role='authenticated')=>{await db.exec('reset role');await q("select set_config('test.user_id',$1,false)",[id||'']);await q("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role,sub:id})]);await db.exec('set role '+role);};
 const owner=async()=>db.exec('reset role');
 const api=async(action,id=null,rev=null,data={})=>(await q('select public.registration_api($1,$2,$3,$4) r',[action,id,rev,data])).rows[0].r;
 const delivery=async(action,id=null,data={})=>(await q('select public.registration_delivery($1,$2,$3) r',[action,id,data])).rows[0].r;
 const fail=async(fn,pattern)=>{await assert.rejects(fn,pattern);checks++;};
 const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
 return {db,q,as,owner,api,delivery,fail,eq,count:()=>checks,uid,club,foreign,team,team2,admin,parent,other,coach,outsider,unverified,revoked,pack,documents,hash};
}
module.exports={registrationFixture};
