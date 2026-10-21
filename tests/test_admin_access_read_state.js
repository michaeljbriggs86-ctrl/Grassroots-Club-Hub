'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {deferred}=require('./helpers/cloud_client_harness');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
function fixture(){
 const nodes={'admin-access-list':{innerHTML:''},'admin-access-stats':{},'admin-access-filter':{value:'all'}};
 let key='admin|club-a',pending=[];
 const cloud={listClubAccessAccounts:()=>{const p=deferred();pending.push(p);return p.promise;}};
 const c={CLOUD_MODE:true,__adminCoachRows:[],syncStaffRequestContext(){},isAdmin:()=>true,staffRequestContext:()=>key,__accessDirectoryLoad:0,
  window:{ClubHubCloud:cloud},document:{getElementById:id=>nodes[id]},
  personNameButton:(name)=>name,adminTitleLabel:()=> 'Club Admin',plural:(n,s)=>n+' '+s,refreshCoachRequests(){}};
 vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function setStableHtml('),app.indexOf('// Club lists share'))+app.slice(app.indexOf('let __adminAccessRows=[];'),app.indexOf('async function assignCoachToTeam(){')),c);
 return {c,nodes,pending,cloud,context:x=>key=x,load:()=>c.refreshAdminAccessManagement(false),render:()=>c.renderAdminAccessManagement(),body:()=>nodes['admin-access-list'].innerHTML};
}
(async()=>{
 // The existing directory returns an account's active team pointers. A team_id
 // alone does not make a Club Admin a coach; coach_team_id is the dual marker.
 let buckets=fixture();const accounts=[
  {user_id:'dual',role:'club_admin',full_name:'Dual Example',coach_team_id:'team-a',team_id:'team-b'},
  {user_id:'admin',role:'club_admin',full_name:'Admin Example',team_id:'team-a',coach_team_id:null},
  {user_id:'coach',role:'coach',full_name:'Coach Example'},
  {user_id:'assistant',role:'assistant_coach',full_name:'Assistant Example'},
  {user_id:'parent',role:'parent',full_name:'Parent Example',coach_team_id:'irrelevant'},
  {user_id:'pending',role:'pending_parent',full_name:'Pending Example'},
  {user_id:'player',role:'player',full_name:'Player Example'}
 ];
 let read=buckets.load();buckets.pending[0].resolve(accounts);await read;
 for(const [filter,expected]of [['all',accounts],['club_admin',accounts.slice(0,2)],['staff',[accounts[0],accounts[2],accounts[3]]],['parent',[accounts[4]]],['pending_parent',[accounts[5]]],['player',[accounts[6]]]]){
  buckets.nodes['admin-access-filter'].value=filter;buckets.render();
  for(const row of accounts)assert.equal(buckets.body().includes(row.full_name),expected.includes(row),filter+' membership: '+row.user_id);
 }
 assert.equal(buckets.pending.length,1,'filtering does not read or mutate accounts');
 buckets.nodes['admin-access-filter'].value='staff';read=buckets.load();buckets.pending[1].resolve(accounts.map(r=>r.user_id==='dual'?{...r,coach_team_id:'team-c'}:r));await read;
 assert.equal(buckets.nodes['admin-access-filter'].value,'staff');assert.match(buckets.body(),/Dual Example/,'another active coaching assignment remains staff');
 read=buckets.load();buckets.pending[2].resolve(accounts.map(r=>r.user_id==='dual'?{...r,coach_team_id:null}:r));await read;
 assert.doesNotMatch(buckets.body(),/Dual Example/,'removed coaching marker no longer matches staff');
 let f=fixture(),p=f.load();f.pending[0].reject(Error('offline'));await p;
 for(const value of ['staff','parent','pending_parent','player','club_admin','all']){f.nodes['admin-access-filter'].value=value;f.render();assert.match(f.body(),/temporarily unavailable/);assert.doesNotMatch(f.body(),/No accounts/);}
 f.nodes['admin-access-filter'].value='parent';p=f.load();f.render();assert.match(f.body(),/Loading club access/);assert.doesNotMatch(f.body(),/No accounts/);f.pending[1].resolve([]);await p;
 assert.equal(f.nodes['admin-access-filter'].value,'parent');assert.match(f.body(),/No accounts match/);assert.doesNotMatch(f.body(),/unavailable/);
 p=f.load();f.pending[2].resolve([{user_id:'parent-a',role:'parent',full_name:'Fictional parent'}]);await p;assert.match(f.body(),/Fictional parent/);
 f=fixture();const old=f.load(),newer=f.load();f.pending[1].resolve([{user_id:'new',role:'parent',full_name:'New result'}]);await newer;f.pending[0].reject(Error('old failure'));await old;assert.match(f.body(),/New result/);
 for(const outcome of ['resolve','reject'])for(const change of ['account','club','api']){
  f=fixture();p=f.load();if(change==='api')f.c.window.ClubHubCloud={...f.cloud};else f.context(change+'|changed');
  const before=f.body();f.pending[0][outcome](outcome==='resolve'?[{user_id:'old',role:'parent',full_name:'Old private result'}]:Error('old failure'));await p;assert.equal(f.body(),before,'changed context rejects late '+outcome);
 }
 console.log('PASS App access: dual Admin/Coach and separate role buckets, active coaching pointers, failed filters, empty/retry, retained filter, out-of-order error and account/club/API changes');
})().catch(e=>{console.error(e);process.exitCode=1;});
