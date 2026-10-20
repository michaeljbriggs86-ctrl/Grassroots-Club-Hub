'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {deferred}=require('./helpers/cloud_client_harness');const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
function fixture(){
 let key='account-a|club-a',role='admin';const calls=[],pending=[],audit=[],toasts=[],alerts=[];
 const teams=[{id:'team-a',ageGroup:'U12',teamName:'Green'},{id:'team-b',ageGroup:'U13',teamName:'Blue'}];
 const people=[{user_id:'coach-a',role:'coach',full_name:'Coach A'},{user_id:'coach-b',role:'assistant_coach',full_name:'Coach B'}];
 const nodes={};for(const id of ['assign-coach-person','assign-coach-team','assign-coach-button','assignment-account-status','retry-assignment-accounts','refresh-club-coaches'])nodes[id]={value:'',innerHTML:'',textContent:'',disabled:false,classList:{toggle(){},add(){}},focus(){c.document.activeElement=this;}};
 const person=nodes['assign-coach-person'],team=nodes['assign-coach-team'];Object.defineProperty(person,'selectedOptions',{get:()=>[{textContent:person.value==='coach-a'?'Coach A · Coach':'Coach B · Assistant Coach'}]});Object.defineProperty(team,'selectedOptions',{get:()=>[{textContent:team.value==='team-a'?'U12 Green':'U13 Blue'}]});
 const cloud={visibleTeamList:()=>teams,assignCoachTeam:(user,team)=>{calls.push({user,team});const p=deferred();pending.push(p);return p.promise;}};
 const c={CLOUD_MODE:true,__adminCoachRows:[],window:{ClubHubCloud:cloud,ClubHubPersonProfiles:{isActive:()=>false}},document:{getElementById:id=>nodes[id],activeElement:null},isAdmin:()=>role==='admin',staffRequestContext:()=>key+'|'+role,syncStaffRequestContext(){},esc:String,matchTeamLabel:String,auditEvent:(...args)=>audit.push(args),toast:x=>toasts.push(x),alert:x=>alerts.push(x),refreshAdminClubOverview:async()=>{}};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function setStableHtml('),source.indexOf('// Club lists share'))+source.slice(source.indexOf('let __adminAccessRows=[];'),source.indexOf('async function unassignCoachFromTeam(')),c);
 function ready(){c.people=people;vm.runInContext("__adminAccessRows=people;__adminAccessState='loaded';__staffDirectoryIdentity=staffRequestContext();__staffDirectoryCloud=window.ClubHubCloud;",c);person.value='coach-a';team.value='team-a';c.populateAssignCoachControls();}
 ready();return{c,person,team,calls,pending,audit,toasts,alerts,ready,context:v=>key=v,role:v=>role=v,state:expr=>vm.runInContext(expr,c)};
}
(async()=>{
 for(const state of ['idle','loading','error']){const f=fixture();f.state("__adminAccessState='"+state+"'");await f.c.assignCoachToTeam();assert.equal(f.calls.length,0,'unverified accounts cannot assign');}
 for(const kind of ['person','team','cloud','role']){const f=fixture();if(kind==='person')f.person.value='removed-person';if(kind==='team'){f.team.value='removed-team';f.c.populateAssignCoachControls();assert.match(f.team.innerHTML,/Selected team unavailable/);assert.equal(f.team.value,'removed-team');}if(kind==='cloud')f.c.window.ClubHubCloud={...f.c.window.ClubHubCloud};if(kind==='role')f.role('parent');await f.c.assignCoachToTeam();assert.equal(f.calls.length,0,kind+' invalidation cannot assign');}
 {const f=fixture();f.state('__adminAccessRows=[]');f.c.document.activeElement=f.person;f.person.value='';f.c.populateAssignCoachControls();assert.equal(f.c.document.activeElement,f.c.document.getElementById('refresh-club-coaches'));}
 {
  const f=fixture(),work=f.c.assignCoachToTeam();assert.deepEqual(f.calls,[{user:'coach-a',team:'team-a'}]);await f.c.assignCoachToTeam();assert.equal(f.calls.length,1,'repeat click is single flight');f.person.value='coach-b';f.team.value='team-b';f.c.populateAssignCoachControls();assert(f.state('__assignmentBusy'));assert(f.c.document.getElementById('assign-coach-button').disabled,'background render cannot enable a pending operation');f.pending[0].resolve({ok:true});await work;assert.equal(f.person.value,'coach-b');assert.equal(f.team.value,'team-b','new intended choice survives old success');assert.equal(f.audit.length,1);assert.equal(f.audit[0][2],'coach-a','audit retains originating subject');assert.match(f.toasts[0],/Coach A assigned to U12 Green/);assert.equal(f.state('__assignmentBusy'),false);
 }
 for(const outcome of ['resolve','reject'])for(const change of ['account','role','cloud']){
  const f=fixture(),work=f.c.assignCoachToTeam();if(change==='account')f.context('account-b|club-b');if(change==='role')f.role('parent');if(change==='cloud')f.c.window.ClubHubCloud={...f.c.window.ClubHubCloud};f.pending[0][outcome](outcome==='resolve'?{ok:true}:Error('Late error'));await work;assert.equal(f.audit.length,0);assert.equal(f.toasts.length,0);assert.equal(f.alerts.length,0,'late failure stays with old context');assert.equal(f.team.value,'team-a');
 }
 {
  const f=fixture(),old=f.c.assignCoachToTeam();f.c.clearAdminDirectoryContext();f.context('account-b|club-b');f.ready();const newer=f.c.assignCoachToTeam();assert.equal(f.calls.length,2);f.pending[0].resolve({ok:true});await old;assert.equal(f.state('__assignmentBusy'),true,'old completion cannot unlock a newer operation');assert.equal(f.audit.length,0);f.pending[1].resolve({ok:true});await newer;assert.equal(f.state('__assignmentBusy'),false);assert.equal(f.audit.length,1);
 }
 {
  const f=fixture(),work=f.c.assignCoachToTeam();f.pending[0].reject(Error('Current failure'));await work;assert.equal(f.audit.length,0);assert.equal(f.toasts.length,0);assert.deepEqual(f.alerts,['Current failure']);assert.equal(f.person.value,'coach-a');assert.equal(f.team.value,'team-a');assert.equal(f.state('__assignmentBusy'),false);
 }
 console.log('PASS assignment safeguards: unverified/removed/denied context, one stable subject/team, duplicate click, retained newer choices, late success/failure, old/new operation isolation and current failure; synthetic deferred calls only');
})().catch(e=>{console.error(e);process.exitCode=1;});
