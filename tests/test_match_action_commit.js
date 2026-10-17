// Run the production Undo/Remove coordinator with controlled fictional cloud
// completions. The separate cloud suite exercises the actual RPC implementation.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app.js'),'utf8');
const coordinator=source.slice(source.indexOf('let __matchAction=null,'),source.indexOf('\nfunction jerseyHTML('));
const copy=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve;return {promise:new Promise(yes=>resolve=yes),resolve};};
async function until(check){for(let n=0;n<100;n++){if(check())return;await Promise.resolve();}throw Error('Asynchronous checkpoint not reached');}

function harness({cloud=true,storage=new Map(),server=null,attendance=['fictional-player'],note='Fictional observation'}={}){
 const controls=[{disabled:false},{disabled:true}],nodes=new Map();
 function node(id){
  if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',open:false,disabled:false,classList:{values:new Set(),add(k){this.values.add(k);},remove(k){this.values.delete(k);},toggle(k,on){if(on)this.add(k);else this.remove(k);},contains(k){return this.values.has(k);}},replaceChildren(){this.innerHTML='';},focus(){calls.focus++;},scrollTo(){},showModal(){this.open=true;},close(){this.open=false;calls.closed++;}});
  return nodes.get(id);
 }
 const calls={core:[],attendance:0,note:0,review:0,persist:0,render:0,closed:0,navigate:[],toasts:[],audit:[],focus:0,confirm:[]};
 const test={uid:'fictional-coach',team:'fictional-team',club:'fictional-club',parent:false,hold:null,fail:'',lost:false,conflict:false,storageFail:false,answers:[],attendance:copy(attendance),note,server:null};
 const seed={meta:{teamName:'Example Greens'},matches:[{id:'fictional-match',date:'2026-10-15',opponent:'Example United',competition:'Friendly',source:'manual',status:'played',gf:3,ga:2},{id:'untouched',date:'2026-10-14',opponent:'Other Example',status:'played',gf:1,ga:1}],goals:[{matchId:'fictional-match',player:'fictional-player',goals:3}],assists:[],bookings:[],awards:[],tactics:{matchdaySelections:{keep:['fictional-player']}}};
 const context={CLOUD_MODE:cloud,currentRole:'coach',adminUiMode:'team',state:copy(server||seed),__matchDetailEpoch:1,__matchReportSaveBusy:false,__matchDetailDirty:false,__matchFormDirty:false,__matchAttendanceRows:[],document:{getElementById:node,querySelectorAll:()=>controls},window:{},localStorage:{getItem:key=>storage.get(key)||null,setItem(key,value){if(test.storageFail)throw Error('Fictional storage full');storage.set(key,value);},removeItem:key=>storage.delete(key)},console,
  isCoach:()=>context.currentRole==='coach'&&!test.parent,requireCoach:()=>context.currentRole==='coach'&&!test.parent,isPlayedMatch:m=>m.status==='played',isProviderOwnedMatch:m=>String(m.source).toLowerCase()==='selkent',
  confirmDiscardMatchEdits:()=>true,confirm:message=>{calls.confirm.push(message);return test.answers.length?test.answers.shift():true;},esc:String,formatDate:String,setStableHtml:(el,html)=>el.innerHTML=html,
  matchDetailContext:()=>[test.uid,test.team,test.parent].join('|'),sameMatchDetail:(id,epoch,key)=>node('match-detail-dialog').open&&node('match-detail-id').value===id&&context.__matchDetailEpoch===epoch&&context.matchDetailContext()===key,
  resetMatchReportMode(){node('match-detail-dialog').classList.remove('match-action-mode');},normalizeState:copy,repairStateIdentity:value=>value,persistLocalState(){calls.persist++;},renderAll(){calls.render++;},refreshAppearanceStats:async()=>{if(test.fail==='stats')throw Error('Fictional statistics outage');},auditEvent:(...args)=>calls.audit.push(args),resetMatchForm(){},navigate:(...args)=>calls.navigate.push(args),toast:message=>calls.toasts.push(message)};
 const changed=()=>Object.assign(Error('Fictional context changed'),{code:'MATCH_ACTION_CONTEXT_CHANGED'});
 const check=guard=>{if(!guard())throw changed();};
 async function checkpoint(stage,guard){check(guard);if(test.hold?.stage===stage){test.hold.started=true;await test.hold.gate.promise;}check(guard);}
 const api={get session(){return {user:{id:test.uid}};},get context(){return {profile:{club_id:test.club}};},currentTeam:()=>({id:test.team}),canEdit:()=>!test.parent,
  commitMatchAction:async(payload,guard)=>{calls.core.push(copy(payload));await checkpoint('core',guard);if(test.fail==='core')throw Error('Fictional offline');if(test.conflict)throw Object.assign(Error('Fictional newer score'),{code:'MATCH_ACTION_CONFLICT'});
   const op={action:payload.action,matchId:payload.matchId};
   if(context.matchActionDesired(op,test.server))return {state:copy(test.server),alreadyApplied:true};
   const match=test.server.matches.find(row=>row.id===payload.matchId);
   if(!match||!payload.expectedMatch||JSON.stringify(match)!==JSON.stringify(payload.expectedMatch))throw Object.assign(Error('Fictional newer match'),{code:'MATCH_ACTION_CONFLICT'});
   const next=copy(test.server);
   if(payload.action==='delete')next.matches=next.matches.filter(row=>row.id!==payload.matchId);else Object.assign(next.matches.find(row=>row.id===payload.matchId),{status:'scheduled',gf:0,ga:0});
   for(const key of ['goals','assists','bookings','awards'])next[key]=next[key].filter(row=>row.matchId!==payload.matchId);
   test.server=next;if(test.lost){test.lost=false;throw Error('Fictional response lost after write');}return {state:copy(next)};},
  clearMatchActionAttendance:async(id,guard)=>{calls.attendance++;await checkpoint('attendance',guard);if(test.fail==='attendance')throw Error('Fictional attendance error');test.attendance=[];},
  clearMatchActionNote:async(id,guard)=>{calls.note++;await checkpoint('note',guard);if(test.fail==='note')throw Error('Fictional note error');test.note='';},
  reviewMatchActionState:async(guard,options)=>{calls.review++;assert.equal(options.discardQueuedChanges,true);await checkpoint('review',guard);return {state:copy(test.server)};}};
 context.window.ClubHubCloud=api;test.server=copy(context.state);vm.createContext(context);vm.runInContext(coordinator,context);
 const begin=action=>context.startMatchAction(action,'fictional-match');
 const click=action=>context.handleMatchActionClick({target:{closest:()=>({dataset:{matchAction:action}})}});
 const hold=stage=>test.hold={stage,started:false,gate:deferred()};
 return {context,test,calls,nodes,node,api,storage,begin,click,hold};
}

(async()=>{
 let checks=0;
 for(const action of ['undo','delete']){
  const h=harness(),gate=h.hold('core'),before=JSON.stringify(h.context.state),task=h.begin(action);await until(()=>gate.started);
  assert.equal(JSON.stringify(h.context.state),before,'no optimistic core mutation');assert.equal(h.calls.attendance+h.calls.note+h.calls.closed+h.calls.toasts.length+h.calls.audit.length,0,'no cleanup, navigation or success before confirmation');assert(h.context.matchActionIsPending());assert.equal(h.context.matchActionMutationEpoch(),1);
  await h.begin(action);assert.equal(h.calls.core.length,1,'duplicate action cannot write twice');
  gate.gate.resolve();await task;assert.equal(h.context.matchActionIsPending(),false);assert.equal(h.calls.attendance,1);assert.equal(h.calls.note,1);assert.equal(h.calls.closed,1);assert.equal(h.calls.navigate.length,1);assert.equal(h.storage.size,0);assert.match(h.calls.toasts.at(-1),action==='undo'?/returned to Scheduled/:/removed/);assert.equal(h.context.state.matches.find(row=>row.id==='untouched').gf,1);assert.deepEqual(copy(h.context.state.tactics.matchdaySelections.keep),['fictional-player']);checks++;
  const failed=harness();failed.test.fail='core';await failed.begin(action);assert.equal(failed.context.state.matches[0].status,'played');assert.equal(failed.calls.attendance+failed.calls.note+failed.calls.closed+failed.calls.audit.length,0);assert.match(failed.node('match-action-outcome').innerHTML,/Change not confirmed/);assert.equal(failed.storage.size,1);
  const saved=JSON.parse([...failed.storage.values()][0]);assert.deepEqual(Object.keys(saved).sort(),['version','scope','action','matchId','stateConfirmed','attendanceCleared','noteCleared'].sort());assert.doesNotMatch(JSON.stringify(saved),/Example|observation|player|"gf"|"ga"|expectedMatch/);
  failed.test.fail='';await failed.context.retryMatchAction();assert.equal(failed.calls.closed,1);checks++;
  const lost=harness();lost.test.lost=true;await lost.begin(action);assert.equal(lost.calls.attendance+lost.calls.note,0);assert.match(lost.node('match-action-outcome').innerHTML,/Change not confirmed/);await lost.context.retryMatchAction();assert.equal(lost.calls.core.length,2);assert.equal(lost.calls.attendance,1);assert.equal(lost.calls.note,1);checks++;
 }
 for(const part of ['attendance','note']){
  const h=harness();h.test.fail=part;await h.begin('undo');assert.equal(h.context.state.matches[0].status,'scheduled');assert.match(h.node('match-action-outcome').innerHTML,/Cleanup incomplete/);assert.equal(h.calls.closed+h.calls.audit.length,0);
  h.test.fail='';await h.context.retryMatchAction();assert.equal(h.calls.core.length,2,'partial cleanup verifies current match core');assert.equal(h.calls.attendance,part==='attendance'?2:1);assert.equal(h.calls.note,part==='note'?2:1,'only unfinished cleanup is retried');checks++;
 }
 const conflict=harness();conflict.test.conflict=true;await conflict.begin('undo');assert.equal(conflict.calls.attendance+conflict.calls.note,0);assert.match(conflict.node('match-action-outcome').innerHTML,/Review latest match/);
 conflict.test.answers=[false];await conflict.context.reviewMatchAction();assert.equal(conflict.calls.review,0,'native review cancellation retains drafts');
 conflict.test.conflict=false;conflict.test.server.matches[0].gf=4;conflict.test.answers=[true,false];await conflict.context.reviewMatchAction();assert.equal(conflict.calls.core.length,1,'fresh data requires explicit destructive reconfirmation');assert.equal(conflict.context.state.matches[0].gf,4);assert.equal(conflict.calls.attendance+conflict.calls.note,0);checks++;
 for(const stage of ['core','attendance','note'])for(const change of ['user','team','role','cloud','dialog']){
  const h=harness(),gate=h.hold(stage),task=h.begin('undo');await until(()=>gate.started);
  if(change==='user')h.test.uid='other-coach';if(change==='team')h.test.team='other-team';if(change==='role'){h.test.parent=true;h.context.currentRole='parent';}if(change==='cloud')h.context.window.ClubHubCloud={...h.api};if(change==='dialog')h.node('match-detail-dialog').open=false;
  const before={attendance:h.calls.attendance,note:h.calls.note,closed:h.calls.closed,audit:h.calls.audit.length,toasts:h.calls.toasts.length};gate.gate.resolve();await task;assert.equal(h.calls.attendance,before.attendance);assert.equal(h.calls.note,before.note);assert.equal(h.calls.closed,before.closed);assert.equal(h.calls.audit.length,before.audit);assert.equal(h.calls.toasts.length,before.toasts);assert.equal(h.context.matchActionIsPending(),false,'late result releases global pending flag');checks++;
 }
 const partial=harness();partial.test.fail='note';await partial.begin('delete');partial.click('back');assert.match(partial.node('match-action-notice').innerHTML,/Resume/);
 const restored=harness({storage:partial.storage,server:partial.test.server,attendance:partial.test.attendance,note:partial.test.note});restored.context.resumeMatchAction();assert.match(restored.node('match-action-outcome').innerHTML,/Cleanup incomplete/);await restored.context.retryMatchAction();assert.equal(restored.calls.attendance,0);assert.equal(restored.calls.note,1);assert.equal(restored.calls.closed,1);checks++;
 const unconfirmed=harness();unconfirmed.test.fail='core';await unconfirmed.begin('undo');const reloaded=harness({storage:unconfirmed.storage,server:unconfirmed.test.server});reloaded.context.resumeMatchAction();assert.match(reloaded.node('match-action-outcome').innerHTML,/Review latest match/);assert.equal(reloaded.calls.core.length,0);checks++;
 for(const action of ['undo','delete']){
  const lost=harness();lost.test.lost=true;await lost.begin(action);
  assert.equal(JSON.parse([...lost.storage.values()][0]).stateConfirmed,false,'lost response retains an unconfirmed intent');
  const reloaded=harness({storage:lost.storage,server:lost.test.server,attendance:lost.test.attendance,note:lost.test.note});
  reloaded.context.resumeMatchAction();reloaded.test.answers=[true,false];await reloaded.context.reviewMatchAction();
  assert.equal(reloaded.calls.confirm.length,2,'fresh already-desired state still requires destructive reconfirmation after reload');
  assert.match(reloaded.calls.confirm[0],/Reviewing latest club data replaces unsynced changes/);
  assert.match(reloaded.calls.confirm[1],action==='undo'?/Undo match played against Example United/:/Delete this match\?/);
  assert.equal(reloaded.context.matchActionDesired({action,matchId:'fictional-match'},reloaded.context.state),true,'review shows the actual applied core without claiming rollback');
  assert.equal(reloaded.calls.attendance+reloaded.calls.note+reloaded.calls.closed+reloaded.calls.audit.length,0,'cancel cannot clean up or complete');
  assert.equal(reloaded.storage.size,1,'cancel retains the cleanup route');
  assert.equal(JSON.parse([...reloaded.storage.values()][0]).stateConfirmed,false);
  assert.match(reloaded.node('match-action-outcome').innerHTML,/Review latest match/);
  assert.doesNotMatch(reloaded.node('match-action-outcome').innerHTML,/>Retry change</);
  reloaded.test.answers=[true,true];await reloaded.context.retryMatchAction();
  assert.equal(reloaded.calls.review,2,'cancelled reconfirmation still routes through review');
  assert.equal(reloaded.calls.confirm.length,4,'accept explicitly reconfirms the action again');
  assert.equal(JSON.parse([...reloaded.storage.values()][0]).stateConfirmed,true);
  assert.equal(reloaded.calls.attendance+reloaded.calls.note,0,'accepted review exposes cleanup retry before cleanup starts');
  assert.match(reloaded.node('match-action-outcome').innerHTML,/Retry cleanup/);
  await reloaded.context.retryMatchAction();
  assert.equal(reloaded.calls.core.length,1,'cleanup retry revalidates the already-desired record');
  assert.equal(reloaded.calls.core[0].expectedMatch,null,'already-applied cleanup needs no persisted match payload');
  assert.equal(reloaded.calls.attendance,1);assert.equal(reloaded.calls.note,1);assert.equal(reloaded.calls.closed,1);assert.equal(reloaded.storage.size,0);
  assert.match(reloaded.calls.toasts.at(-1),action==='undo'?/returned to Scheduled/:/removed/);checks++;
 }
 const local=harness({cloud:false});await local.begin('undo');assert.equal(local.calls.core.length+local.calls.attendance+local.calls.note,0);assert.match(local.calls.toasts[0],/on this device$/);assert.doesNotMatch(local.calls.toasts[0],/club|cloud/i);checks++;
 const denied=harness();denied.context.state.matches[0].source='selkent';await denied.begin('delete');assert.equal(denied.calls.core.length,0);assert.equal(denied.storage.size,0);checks++;
 const cancelled=harness();cancelled.test.answers=[false];await cancelled.begin('undo');assert.equal(cancelled.calls.core.length,0);assert.equal(cancelled.storage.size,0);checks++;
 const full=harness();full.test.storageFail=true;await full.begin('delete');assert.equal(full.calls.core.length,0);assert.match(full.calls.toasts[0],/Could not retain the retry/);checks++;
 console.log(`PASS ${checks} real coordinator scenarios: confirmed-only success, separate retryable cleanup, private durable intent, ambiguous completion, conflict review/reconfirm, scoped late-response guards, reload after removal, demo/provider/storage protection`);
})().catch(error=>{console.error(error);process.exitCode=1;});
