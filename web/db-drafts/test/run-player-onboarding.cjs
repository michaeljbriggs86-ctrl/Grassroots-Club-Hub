const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PGlite}=require(process.argv[2]||'@electric-sql/pglite');
const root=path.resolve(__dirname,'../../..');
const defs=JSON.parse(fs.readFileSync(path.join(__dirname,'player-onboarding-observed-contract.json'),'utf8'));
const migration=fs.readFileSync(path.join(root,'web/db-drafts/admin_player_onboarding_candidate.sql'),'utf8');
(async()=>{
 const db=new PGlite();await db.exec(`
 create role anon;create role authenticated;
 create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
 create table public.profiles(user_id uuid primary key,club_id uuid,role text,team_id uuid,coach_team_id uuid,full_name text,access_method text,approved_at timestamptz,approved_by uuid,updated_at timestamptz);
 create table public.teams(id uuid primary key,club_id uuid,name text,age_group integer,selkent_label text,season text,active boolean);
 create table public.competition_rules(club_id uuid,age_group integer,max_registered integer,primary key(club_id,age_group));
 create table public.team_state(team_id uuid primary key,state jsonb,revision bigint,updated_at timestamptz,updated_by uuid);
 create table public.team_state_history(id bigserial primary key,team_id uuid,revision bigint,state jsonb,archived_at timestamptz,archived_by uuid);
 create table private.player_season_identity(club_id uuid,team_id uuid,season text,player_name text,shirt_number integer,player_role text,player_status text,updated_at timestamptz,unique(team_id,season,player_name));
 create table public.parent_access_requests(id uuid primary key,club_id uuid,team_id uuid,user_id uuid,child_name text,status text,reviewed_at timestamptz,reviewed_by uuid,updated_at timestamptz);
 create table public.parent_player_links(id uuid default gen_random_uuid(),club_id uuid,team_id uuid,parent_user_id uuid,player_name text,shirt_number integer,created_by uuid,unique(team_id,parent_user_id,player_name));
 create table public.app_notifications(club_id uuid,team_id uuid,recipient_user_id uuid,type text,title text,body text,entity_key text,created_at timestamptz default now(),read_at timestamptz);
 create unique index app_notice_key on public.app_notifications(recipient_user_id,type,entity_key) where entity_key is not null;
 create function public.team_player_age(integer,text) returns integer language sql immutable as $$select $1$$;
 create function public.team_identity_norm(text) returns text language sql immutable as $$select lower(regexp_replace(btrim(coalesce($1,'')),'\\s+',' ','g'))$$;
 `);
 for(const name of ['lookup_u11_shirt_number','hydrate_u11_staff_state','normalize_u11_state','can_edit_team','approve_parent_request'])await db.exec(defs[name]);
 await db.exec(migration);
 const uid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
 const admin=uid(1),coach=uid(2),parent=uid(3),player=uid(4),foreign=uid(5),missing=uid(6),club=uid(10),otherClub=uid(11),mini=uid(20),older=uid(21),other=uid(22),inactive=uid(23),noRule=uid(24),request=uid(30);
 const sql=(q,params=[])=>db.query(q,params);let checks=0;
 for(const [id,role,cid] of [[admin,'club_admin',club],[coach,'coach',club],[parent,'pending_parent',club],[player,'player',club],[foreign,'club_admin',otherClub]])await sql('insert into public.profiles(user_id,club_id,role,full_name) values($1,$2,$3,$4)',[id,cid,role,'Invented adult '+role]);
 for(const [id,age,active,cid] of [[mini,9,true,club],[older,14,true,club],[other,9,true,otherClub],[inactive,9,false,club],[noRule,13,true,club]])await sql('insert into public.teams values($1,$2,$3,$4,$5,$6,$7)',[id,cid,'Invented team '+age,age,'U'+age,'2026/27',active]);
 await sql('insert into public.competition_rules values($1,9,2),($1,14,4)',[club]);
 const oldState={meta:{season:'2026/27'},squad:[{name:'Invented Existing',number:1,role:'outfield',status:'active'}],matches:[{id:'preserved',opponent:'Invented opposition',notes:'Private notes'}],goals:[{player:'Invented Existing',goals:2}],assists:[],awards:[],tactics:{untouched:true},custom:{untouched:true}};
 await sql('select set_config(\'test.user_id\',$1,false)',[admin]);
 await sql('insert into public.team_state values($1,private.normalize_u11_state($1,$2::jsonb),7,now(),$3)',[mini,JSON.stringify(oldState),admin]);
 const original=(await sql('select state from public.team_state where team_id=$1',[mini])).rows[0].state;
 const onboard=(team,name,number,role='outfield',req=null)=>sql('select public.admin_onboard_player($1,$2,$3,$4,$5) as result',[team,name,number,role,req]);
 const fails=async(args,pattern)=>{await assert.rejects(()=>onboard(...args),pattern);checks++;};
 for(const user of [coach,parent,player,missing]){await sql('select set_config(\'test.user_id\',$1,false)',[user]);await fails([mini,'Invented New',2],/Club Admin/);}
 await sql('select set_config(\'test.user_id\',$1,false)',[admin]);await fails([other,'Invented New',2],/Team not available/);await fails([inactive,'Invented New',2],/Team not available/);await fails([noRule,'Invented New',2],/registration limit/);
 await fails([mini,'Invented Existing',2],/already in/);await fails([mini,'Invented New',1],/shirt number/);await fails([mini,'Invented New',0],/shirt number/);await fails([mini,'Invented New',100],/shirt number/);await fails([mini,'X',2],/player name/);await fails([mini,'Invented New',2,'striker'],/outfield/);await fails([mini,'Invented\nChild',2],/control characters/);
 assert.equal((await sql('select public.can_edit_team($1) as allowed',[mini])).rows[0].allowed,false);checks++;
 await sql('insert into public.parent_access_requests(id,club_id,team_id,user_id,child_name,status) values($1,$2,$3,$4,$5,\'pending\')',[request,club,mini,parent,'Invented New']);
 const result=(await onboard(mini,'Invented New',2,'goalkeeper',request)).rows[0].result;assert.equal(result.ok,true);assert.equal(result.parent_linked,true);assert.equal(result.revision,8);checks++;
 const saved=(await sql('select state,updated_by from public.team_state where team_id=$1',[mini])).rows[0];assert.equal(saved.state.squad.length,2);assert.equal(saved.state.squad[1].name,'Invented New');assert(!('number' in saved.state.squad[1]),'U9 shirt mapping stays private');assert.deepEqual(saved.state.matches,original.matches);assert.deepEqual(saved.state.goals,original.goals);assert.deepEqual(saved.state.tactics,original.tactics);assert.deepEqual(saved.state.custom,original.custom);assert.equal(saved.updated_by,admin);checks+=7;
 assert.equal((await sql('select count(*)::int as n from private.player_season_identity where team_id=$1 and player_name=\'Invented New\' and shirt_number=2',[mini])).rows[0].n,1);checks++;
 assert.equal((await sql('select role from public.profiles where user_id=$1',[parent])).rows[0].role,'parent');assert.equal((await sql('select status from public.parent_access_requests where id=$1',[request])).rows[0].status,'approved');assert.equal((await sql('select count(*)::int n from public.parent_player_links where team_id=$1 and parent_user_id=$2',[mini,parent])).rows[0].n,1);checks+=3;
 await fails([mini,'Invented Third',3],/registration limit/);
 // Existing name is rejected on retry, protecting against double clicks/network uncertainty.
 await fails([mini,'Invented New',2,'goalkeeper',request],/already in/);
 // Request on another team is rejected before any new record is persisted.
 const mismatched=uid(31);await sql('insert into public.parent_access_requests(id,club_id,team_id,user_id,status) values($1,$2,$3,$4,\'pending\')',[mismatched,club,mini,parent]);await fails([older,'Invented Older',5,'outfield',mismatched],/no longer available/);assert.equal((await sql('select count(*)::int n from public.team_state where team_id=$1',[older])).rows[0].n,0);checks++;
 // A parent approval error after the squad write must roll the whole operation back.
 const badReq=uid(32);await sql('insert into public.parent_access_requests(id,club_id,team_id,user_id,status) values($1,$2,$3,$4,\'pending\')',[badReq,club,older,player]);await fails([older,'Invented Older',5,'outfield',badReq],/not available for approval/);assert.equal((await sql('select count(*)::int n from public.team_state where team_id=$1',[older])).rows[0].n,0);checks++;
 await db.exec('alter table public.profiles add column acting_as_parent boolean default false');await sql('update public.profiles set acting_as_parent=true where user_id=$1',[admin]);await fails([older,'Invented Older',5],/Admin/);await sql('update public.profiles set acting_as_parent=false where user_id=$1',[admin]);
 await onboard(older,'Invented Older',5);assert.equal((await sql('select state from public.team_state where team_id=$1',[older])).rows[0].state.squad[0].number,5);checks++;
 const grants=(await sql("select has_function_privilege('anon','public.admin_onboard_player(uuid,text,integer,text,uuid)','execute') as anon,has_function_privilege('authenticated','public.admin_onboard_player(uuid,text,integer,text,uuid)','execute') as authenticated,has_function_privilege('authenticated','private.admin_onboard_player(uuid,text,integer,text,uuid)','execute') as core")).rows[0];assert.deepEqual(grants,{anon:false,authenticated:true,core:false});checks++;
 assert.equal((await sql('select public.can_edit_team($1) as allowed',[mini])).rows[0].allowed,false,'general edit access stays unchanged');checks++;
 await db.close();console.log(`PASS Admin player onboarding: ${checks} database checks; invented data only`);
})().catch(e=>{console.error(e);process.exitCode=1});
