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
 console.log('PASS App access read state: failed filters, successful empty/retry, retained filter, out-of-order error and account/club/API changes');
})().catch(e=>{console.error(e);process.exitCode=1;});
