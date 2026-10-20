'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {deferred}=require('./helpers/cloud_client_harness');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
function fixture(role='admin'){
 const nodes={};for(const id of ['inbox-contact-select','inbox-message-body','inbox-subject','inbox-thread','inbox-compose-hint','send-inbox-message','club-inbox-help'])nodes[id]={value:'',innerHTML:'',textContent:'',disabled:false,setAttribute(){}};
 let key='user|club|team|'+role;const contacts=[],messages=[],sends=[],alerts=[];
 const cloud={session:{user:{id:'me'}},listMessageContacts:()=>{const d=deferred();contacts.push(d);return d.promise;},listClubMessages:()=>{const d=deferred();messages.push(d);return d.promise;},markClubMessagesRead:()=>Promise.resolve(),sendClubMessage:async p=>{sends.push(p);}};
 const c={window:{ClubHubCloud:cloud},document:{getElementById:id=>nodes[id]},CLOUD_MODE:true,currentRole:role,personProfileContextKey:()=>key,isAdmin:()=>role==='admin',isClubOverviewMode:()=>true,isAdminCoachMode:()=>false,dualCoachTeam:()=>null,esc:x=>String(x),toast(){},alert:x=>alerts.push(x),Date,setTimeout};
 vm.createContext(c);vm.runInContext(app.slice(app.indexOf('let __inboxStamp='),app.indexOf('let __clubResultsStamp=')),c);
 const rows=[{user_id:'a',role:'coach',full_name:'Coach A'},{user_id:'b',role:'parent',full_name:'Parent B'}];
 async function load(data=rows){const p=c.refreshInbox(false),i=contacts.length-1;contacts[i].resolve(data);messages[i].resolve([]);await p;}
 return {c,nodes,contacts,messages,sends,alerts,rows,load,context:v=>key=v,selected:()=>vm.runInContext('__inboxSelected',c),setSelected:v=>vm.runInContext('__inboxSelected='+JSON.stringify(v),c),draft(){nodes['inbox-message-body'].value='Draft for A';nodes['inbox-subject'].value='Training A';}};
}
(async()=>{
 for(const role of ['admin','coach','assistant_coach','parent']){
  const f=fixture(role);await f.load();f.setSelected('a');f.c.renderInbox();f.draft();await f.load([f.rows[1]]);
  assert.equal(f.selected(),'a',role+': removal must retain intended recipient');assert.equal(f.nodes['send-inbox-message'].disabled,true);assert.match(f.nodes['inbox-compose-hint'].textContent,/draft is still here/);assert.equal(f.nodes['inbox-message-body'].value,'Draft for A');
  await f.c.sendInboxMessage();assert.equal(f.sends.length,0,'function guard rejects removed contact');
  f.setSelected('b');if(f.c.selectInboxRecipient)f.c.selectInboxRecipient('b');else f.c.renderInbox();assert.equal(f.nodes['send-inbox-message'].disabled,false);
  const p=f.c.refreshInbox(false),i=f.contacts.length-1;assert.equal(f.nodes['send-inbox-message'].disabled,true);f.contacts[i].reject(Error('offline'));f.messages[i].resolve([]);await p;await f.c.sendInboxMessage();assert.equal(f.sends.length,0);assert.equal(f.nodes['inbox-subject'].value,'Training A');
  await f.load([f.rows[1]]);assert.equal(f.nodes['send-inbox-message'].disabled,false);
 }
 const denied=fixture('parent');await denied.load();denied.c.selectInboxRecipient('group:all');denied.draft();await denied.c.sendInboxMessage();assert.equal(denied.sends.length,0,'Parent cannot select an unauthorised group');
 const f=fixture();await f.load();f.setSelected('group:all');f.c.renderInbox();f.draft();await f.load([...f.rows,{user_id:'c',role:'parent'}]);assert.equal(f.nodes['send-inbox-message'].disabled,true,'changed group requires deliberate selection');
 f.c.selectInboxRecipient('group:all');assert.equal(f.nodes['send-inbox-message'].disabled,false);await f.load([]);assert.equal(f.nodes['send-inbox-message'].disabled,true);
 for(const outcome of ['resolve','reject']){
  const x=fixture();await x.load();x.draft();const old=x.c.refreshInbox(false),i=x.contacts.length-1;await x.load([{user_id:'new',role:'coach'}]);x.contacts[i][outcome](outcome==='resolve'?[{user_id:'stale',role:'coach'}]:Error('late'));x.messages[i].resolve([]);await old;assert.doesNotMatch(x.nodes['inbox-contact-select'].innerHTML,/stale/);assert.doesNotMatch(x.nodes['inbox-thread'].innerHTML,/unavailable/);
  const pending=x.c.refreshInbox(false),j=x.contacts.length-1;x.context('different-account');x.contacts[j].resolve([{user_id:'private-old',role:'coach'}]);x.messages[j].resolve([]);await pending;x.c.renderInbox();assert.equal(x.nodes['inbox-message-body'].value,'');assert.doesNotMatch(x.nodes['inbox-contact-select'].innerHTML,/private-old/);
 }
 // A completing send must not clear a newer draft or unlock a different context.
 const y=fixture();await y.load();y.c.selectInboxRecipient('a');y.draft();const sending=deferred();y.cloud=y.c.window.ClubHubCloud;y.cloud.sendClubMessage=()=>sending.promise;
 const send=y.c.sendInboxMessage();y.context('different-team');y.c.renderInbox();y.context('user|club|team|admin');await y.load();y.draft();sending.resolve({ok:true});await send;assert.equal(y.nodes['inbox-message-body'].value,'Draft for A');
 console.log('PASS inbox draft: four roles, removed individual/group, explicit retarget, failed/pending/retry reads, stale success/error and private context clearing; no messages sent');
})().catch(e=>{console.error(e);process.exitCode=1;});
