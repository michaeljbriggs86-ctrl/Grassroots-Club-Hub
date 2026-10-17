// Throwaway PostgreSQL only: actual observed definitions, invented records, no live calls.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {registrationFixture}=require('./registration-fixture.cjs');
const observed=JSON.parse(fs.readFileSync(path.join(__dirname,'viewer-age-privacy-observed-contract.json'),'utf8'));
const root=path.resolve(__dirname,'../../..');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261017134139_viewer_age_privacy_fail_closed.sql'),'utf8');
const targets=observed.functions.slice(0,3);
const replacements=new Map([
 ['private.state_for_viewer',['eff_age int := coalesce(p_age, 7);','eff_age int := case when p_age is null or p_age<7 then 7 else p_age end;']],
 ['public.get_team_state_for_me',["restricted:=((age is null or age between 7 and 11) and eff in ('parent','player'));","restricted:=((age is null or age<=11) and eff in ('parent','player'));" ]],
 ['public.get_my_context',["is_restricted:=((target_age is null or target_age between 7 and 11) and p.role in ('parent','player'));","is_restricted:=((target_age is null or target_age<=11) and p.role in ('parent','player'));" ]],
]);
const ages=[
 {age:null,label:'Unknown invented label'}, {age:0,label:'Unknown invented label'},
 {age:5,label:'Under 5 Invented'}, {age:6,label:'Under 6 Invented'},
 {age:7,label:'Under 7 Invented'}, {age:9,label:'Under 9 Invented'},
 {age:11,label:'Under 11 Invented'}, {age:12,label:'Under 12 Invented'},
 {age:15,label:'Under 15 Invented'}, {age:12,label:'Under12X Invented'},
];
(async()=>{
 const f=await registrationFixture(),{db,q,owner,as,club,foreign,team,team2,parent,coach,other}=f;
 let checks=0;const groups={};
 const eq=(group,actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;groups[group]=(groups[group]||0)+1;};
 const reject=async(group,fn,re,label)=>{await assert.rejects(fn,re,label);checks++;groups[group]=(groups[group]||0)+1;};
 const restore=async()=>{await owner();for(const x of observed.functions)await db.exec(x.definition);};
 await restore();
 for(const x of observed.functions){const actual=(await q('select md5(pg_get_functiondef($1::regprocedure)) hash',[x.signature])).rows[0].hash;eq('observed-definitions',actual,x.md5,x.name+' exact observed definition');}
 await q("update public.profiles set role='parent',club_id=$1,team_id=$2 where user_id=$3",[club,team,parent]);
 await q('update public.profiles set team_id=$1,coach_team_id=$1 where user_id=$2',[team,coach]);
 await q("insert into public.parent_player_links(club_id,team_id,parent_user_id,player_name) values($1,$2,$3,'Invented Own Child'),($1,$2,$4,'Invented Own Child')",[club,team,parent,coach]);
 await q("insert into private.player_season_identity(club_id,team_id,season,player_name,shirt_number,player_status) values($1,$2,'2026/27','Invented Own Child',1,'active')",[club,team]);
 const state={meta:{},squad:[{name:'Invented Own Child',number:1,status:'active'},{name:'Invented Other Child',number:2,status:'active'}],matches:[{id:'invented-match',gf:3,ga:1,notes:'Invented private staff note'}],tactics:{inventedPlan:true},cupProgress:{inventedProgress:true},tournaments:[{id:'invented-event',playerNames:['Invented Own Child','Invented Other Child']}],goals:[{shirtNumber:1,goals:2},{shirtNumber:2,goals:1}],assists:[{shirtNumber:2,assists:1}],bookings:[{shirtNumber:2,yellow:1}],awards:[{shirtNumber:1,type:'Invented award'},{shirtNumber:2,type:'Invented award'}]};
 await q('insert into public.team_state(team_id,state,revision) values($1,$2,1)',[team,state]);
 const setAge=async item=>{await owner();await q('update public.teams set age_group=$1,selkent_label=$2 where id=$3',[item.age,item.label,team]);};
 const read=async()=>(await q('select * from public.get_team_state_for_me($1)',[team])).rows[0];
 const context=async()=>(await q('select public.get_my_context() x')).rows[0].x;
 // Prove the observed baseline reproduces the actual unknown/below-seven defect.
 for(const item of [ages[0],ages[2]]){await setAge(item);await as(parent);const before=await read();eq('baseline-defect',before.state.matches[0].gf,3,'baseline exposes score for '+item.label);eq('baseline-defect',before.restricted,false,'baseline restricted flag is false');}
 const staffBefore=[];
 for(const role of ['club_admin','coach','assistant_coach'])for(const item of ages){await setAge(item);await q('update public.profiles set role=$1,acting_as_parent=false where user_id=$2',[role,coach]);await as(coach);staffBefore.push({role,item,row:await read(),context:await context()});}
 const metadata=async()=>{await owner();const rows=[];for(const x of observed.functions)rows.push((await q("select p.oid,p.proowner,p.prolang,p.prosecdef,p.provolatile,p.proisstrict,p.proparallel,p.proconfig,p.proacl from pg_proc p where p.oid=$1::regprocedure",[x.signature])).rows[0]);return rows;};
 const definitions=async()=>{await owner();const rows=[];for(const x of targets)rows.push((await q('select pg_get_functiondef($1::regprocedure) d',[x.signature])).rows[0].d);return rows;};
 const dataFingerprint=async()=>{await owner();const tables=(await q("select schemaname,tablename from pg_tables where schemaname in ('public','private','auth') order by schemaname,tablename")).rows;const values=[];for(const t of tables){const ident=s=>'"'+s.replaceAll('"','""')+'"';values.push({table:t.schemaname+'.'+t.tablename,rows:(await q('select coalesce(jsonb_agg(x order by x::text),\'[]\'::jsonb) v from (select to_jsonb(t) x from '+ident(t.schemaname)+'.'+ident(t.tablename)+' t) a')).rows[0].v});}return values;};
 // Each individual stale definition must abort before any of the three is replaced.
 for(const x of targets){await restore();const drift=x.definition.replace('begin\n','begin\n  -- Invented drift for rejection test.\n');assert.notEqual(drift,x.definition);await db.exec(drift);const before=await definitions();await reject('drift-guards',()=>db.exec(migration),/changed; review current definition/,x.name+' drift is rejected');eq('drift-guards',await definitions(),before,'all three definitions remain unchanged after rejected candidate');}
 await restore();const metaBefore=await metadata(),dataBefore=await dataFingerprint();
 await db.exec(migration);
 eq('preservation',await metadata(),metaBefore,'function OIDs, owners, ACLs, configuration and attributes preserved');
 eq('preservation',await dataFingerprint(),dataBefore,'candidate changes no application table rows');
 for(const x of observed.functions){const actual=(await q('select pg_get_functiondef($1::regprocedure) d',[x.signature])).rows[0].d;const pair=replacements.get(x.name);eq('preservation',actual,pair?x.definition.replace(pair[0],pair[1]):x.definition,x.name+' only reviewed text changed');}
 const applied=await definitions();await reject('drift-guards',()=>db.exec(migration),/changed; review current definition/,'reapplication fails closed');eq('drift-guards',await definitions(),applied,'reapplication leaves applied definitions intact');
 for(const role of ['parent','player'])for(const item of ages){
  await setAge(item);const user=role==='parent'?parent:other;await q('update public.profiles set role=$1,club_id=$2,team_id=$3,coach_team_id=null,acting_as_parent=false where user_id=$4',[role,club,team,user]);await as(user);
  const row=await read(),ctx=await context(),resolved=(await q('select public.team_player_age($1,$2) n',[item.age,item.label])).rows[0].n;
  const restricted=resolved<=11,label=role+' / '+item.label+' / '+String(item.age);
  eq('projection-matrix',row.restricted,restricted,label+' RPC flag');eq('projection-matrix',ctx.team_state_restricted,restricted,label+' context flag');eq('projection-matrix','gf' in row.state.matches[0],!restricted,label+' score boundary');eq('projection-matrix','notes' in row.state.matches[0],false,label+' no private note');eq('projection-matrix','tactics' in row.state,false,label+' no tactics');eq('projection-matrix','cupProgress' in row.state,false,label+' no cup progress');eq('projection-matrix',ctx.team_state,row.state,label+' both read RPC projections agree');eq('projection-matrix','number' in row.state.squad[0],!restricted,label+' shirt boundary');
  if(role==='parent'){eq('own-child',row.state.squad.map(p=>p.name),['Invented Own Child'],label+' own child only');eq('own-child',row.state.goals.map(g=>g.shirtNumber),restricted?[]:[1],label+' permitted own goals only');eq('own-child',row.state.awards.map(g=>g.shirtNumber),[1],label+' own awards only');eq('own-child','playerNames' in row.state.tournaments[0],false,label+' no tournament registrations');}
  else eq('player-projection',row.state.squad.map(p=>p.name),['Invented','Invented'],label+' existing first-name projection');
 }
 for(const expected of staffBefore){await setAge(expected.item);await q('update public.profiles set role=$1,acting_as_parent=false where user_id=$2',[expected.role,coach]);await as(coach);eq('staff-preserved',await read(),expected.row,expected.role+' state/hydration unchanged at '+expected.item.label);eq('staff-preserved',await context(),expected.context,expected.role+' context unchanged at '+expected.item.label);}
 for(const item of [ages[0],ages[5],ages[7]]){await setAge(item);await q("update public.profiles set role='coach',acting_as_parent=true where user_id=$1",[coach]);await as(coach);const row=await read(),ctx=await context();eq('parent-capacity',row.state.squad.map(p=>p.name),['Invented Own Child'],'parent capacity own-child projection');eq('parent-capacity','tactics' in row.state,false,'parent capacity no tactics');eq('parent-capacity',ctx.profile.role,'parent','effective capacity preserved');eq('parent-capacity',ctx.real_role,'coach','real staff role preserved');eq('parent-capacity',row.restricted,item.age===null||item.age<=11,'parent capacity restricted flag');}
 for(const role of ['pending','pending_parent','pending_coach','pending_player','revoked']){await owner();await q('update public.profiles set role=$1,club_id=$2,team_id=$3 where user_id=$4',[role,club,team,other]);await as(other);eq('access-denials',(await q('select public.can_read_team($1) b',[team])).rows[0].b,false,role+' cannot read');eq('access-denials',(await context()).team_state,null,role+' context has no state');await reject('access-denials',()=>read(),/read access/,role+' direct read RPC denies');}
 await as(parent);eq('access-denials',(await q('select public.can_read_team($1) b',[team2])).rows[0].b,false,'unlinked same-club team denied');await reject('access-denials',()=>q('select * from public.get_team_state_for_me($1)',[team2]),/read access/,'unlinked same-club RPC denied');await owner();await q('update public.teams set club_id=$1 where id=$2',[foreign,team2]);await as(parent);await reject('access-denials',()=>q('select * from public.get_team_state_for_me($1)',[team2]),/read access/,'cross-club RPC denied');await as(null,'anon');await reject('access-denials',()=>read(),/Authentication required/,'anonymous RPC denied');
 await db.close();const summary={status:'PASS',checks,groups,migration:'viewer_age_privacy_fail_closed',live_applied:false,scope:'Observed live SQL replayed with fictional records in throwaway PostgreSQL; no live data changed. Does not establish JWT, all RLS or real-user acceptance; player eligibility is outside this projection repair.'};
 if(process.env.PITCHKIND_VIEWER_AGE_EVIDENCE)fs.writeFileSync(process.env.PITCHKIND_VIEWER_AGE_EVIDENCE,JSON.stringify(summary,null,2)+'\n');
 console.log('PASS viewer age privacy: '+checks+' isolated PostgreSQL checks; staff/U12 behavior, own-child scope, age flags, grants/config/data and drift guards verified; candidate NOT applied live.');
})().catch(e=>{console.error(e);process.exitCode=1;});
