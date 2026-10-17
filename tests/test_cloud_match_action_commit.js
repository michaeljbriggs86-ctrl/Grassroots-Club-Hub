#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

// Exercise the real cloud client with a fictional in-memory backend. The test
// injection exposes closure state only in this VM; production has no test API.
const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/cloud.js'),'utf8');
const copy=x=>JSON.parse(JSON.stringify(x));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const response=(status,data)=>({status,ok:status>=200&&status<300,headers:{},text:async()=>JSON.stringify(data),json:async()=>data});
const originalMatch={id:'m1',status:'played',date:'2026-10-11',opponent:'Fictional United',competition:'League',venue:'Home',source:'manual',gf:2,ga:1,kickoff:'10:00',selectedPlayers:['Fictional player']};
function state(){return {matches:[copy(originalMatch),{id:'m2',status:'scheduled',opponent:'Other side',gf:0,ga:0}],goals:[{matchId:'m1',player:'Fictional player'},{matchId:'m2',player:'Other'}],assists:[{matchId:'m1',player:'Fictional player'},{matchId:'m2',player:'Other'}],bookings:[{matchId:'m1',kind:'yellow'},{matchId:'m2',kind:'yellow'}],awards:[{matchId:'m1',kind:'coach'},{matchId:'m2',kind:'coach'}],squad:[{id:'p1',name:'Fictional player'}],tactics:{focus:'Remote edit survives'},meta:{unrelated:'preserved'}};}
function harness({data=state(),revision=8,handler=null,expired=false}={}){
  const requests=[],events=[],updates=[],store=new Map(),timers=new Map();let timerId=0;
  const backend={state:copy(data),revision,attendance:[{player_name:'Fictional player',status:'present'}],note:'Private fictional note'};
  const validSession={access_token:'token-coach',refresh_token:'refresh-coach',expires_at:expired?1:Math.floor(Date.now()/1000)+3600,user:{id:'coach'}};
  const window={CLUB_HUB_CLOUD:{url:'https://fictional.supabase.co',anonKey:'a'.repeat(60)},dispatchEvent:e=>events.push(e)};
  const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const fetch=async(url,options={})=>{
    const request={url,path:new URL(url).pathname+new URL(url).search,body:options.body?JSON.parse(options.body):null,options};requests.push(request);
    if(handler){const result=await handler(request,backend);if(result!==undefined)return result;}
    if(request.path.startsWith('/auth/v1/token'))return response(200,{...validSession,access_token:'token-refreshed',refresh_token:'refresh-refreshed',expires_in:3600});
    if(request.path==='/rest/v1/rpc/get_team_state_for_me')return response(200,{state:copy(backend.state),revision:backend.revision,updated_at:'2026-10-17T11:00:00Z'});
    if(request.path==='/rest/v1/rpc/save_team_state'){
      if(request.body.p_expected_revision!==backend.revision)return response(409,{message:'STALE_STATE'});
      backend.state=copy(request.body.p_state);backend.revision++;
      return response(200,{revision:backend.revision});
    }
    if(request.path==='/rest/v1/rpc/save_match_attendance'){backend.attendance=copy(request.body.p_rows);return response(200,0);}
    if(request.path.startsWith('/rest/v1/coach_match_notes')){backend.note=request.body.note;return response(200,[copy(request.body)]);}
    throw new Error('Unexpected test request: '+request.path);
  };
  const sandbox={window,localStorage,location:{protocol:'https:',origin:'https://fictional.test',search:'',hash:'',href:'https://fictional.test/'},URLSearchParams,URL,AbortController,fetch,document:{getElementById:()=>null},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>0,clearInterval:()=>{},console};
  const expose=`
  window.__testCloud={
    initialize(s){saveSession(s);activeTeam={id:'team-a',club_id:'club-a',age_group:12};context={profile:{role:'coach',club_id:'club-a'},team:activeTeam,real_role:'coach'};visibleTeams=[activeTeam];activeRevision=1;hooks={onRemoteState:state=>window.__updates.push(state)};},
    getContext:()=>context,getTeam:()=>activeTeam,
    changeSession:s=>saveSession(s),setUnsynced:v=>{unsyncedState=v;},setRevision:v=>{activeRevision=v;},
    debug:()=>({pendingState,unsyncedState,saving,confirmingState,activeRevision,lease:!!matchActionLease,quarantine:!!matchActionQuarantine}),
  };
  window.ClubHubCloud={`;
  window.__updates=updates;
  vm.runInNewContext(source.replace('  window.ClubHubCloud={',expose),sandbox,{filename:'cloud.js'});
  window.__testCloud.initialize(copy(validSession));
  const api=window.ClubHubCloud,test=window.__testCloud;
  let guardValue=true;
  return {api,test,backend,requests,events,updates,store,timers,validSession,window,guard:()=>guardValue,setGuard:v=>{guardValue=v;},debug:()=>copy(test.debug()),writes:()=>requests.filter(r=>r.path==='/rest/v1/rpc/save_team_state'),fire:async delay=>{for(const [id,timer]of [...timers])if(timer.delay===delay){timers.delete(id);timer.fn();}await tick();}};
}
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
const commit=(h,action='undo',expectedMatch=originalMatch)=>h.api.commitMatchAction({action,matchId:'m1',expectedMatch:copy(expectedMatch)},h.guard);
const code=expected=>error=>error?.code===expected;

test('fresh CAS undo changes only the target and linked report rows',async()=>{
  const h=harness();h.backend.state.meta.newCloudField='Latest revision';
  h.store.set('grassroots_hub_team_state_cache_v1_team-a','stale cached played match');
  const before=copy(h.backend.state),result=await commit(h);
  const expected=copy(before);Object.assign(expected.matches[0],{status:'scheduled',gf:0,ga:0});
  for(const key of ['goals','assists','bookings','awards'])expected[key]=expected[key].filter(row=>row.matchId!=='m1');
  assert.deepEqual(copy(result.state),expected);assert.deepEqual(h.backend.state,expected);
  assert.equal(h.writes()[0].body.p_expected_revision,8,'use freshly read revision, never old activeRevision or force -2');
  assert.equal(h.writes()[0].body.p_team_id,'team-a');assert.equal(result.alreadyApplied,false);
  assert.equal(h.debug().activeRevision,9);assert.equal(h.store.has('grassroots_hub_team_state_cache_v1_team-a'),false);
  assert.equal(h.backend.note,'Private fictional note');assert.equal(h.backend.attendance.length,1,'core write does not begin cleanup');
  assert.equal(h.updates.length,0,'caller controls guarded UI effects');
});
test('manual removal preserves every other match and unrelated field',async()=>{
  const h=harness();const result=await commit(h,'delete');assert.deepEqual(copy(result.state.matches),[state().matches[1]]);
  assert.deepEqual(copy(result.state.squad),state().squad);assert.deepEqual(copy(result.state.tactics),state().tactics);
  assert.equal(h.writes().length,1);
});
test('changed core, protected source and malformed state never force a save',async()=>{
  for(const change of [h=>{h.backend.state.matches[0].gf=5;},h=>{h.backend.state.matches[0].source='selkent';},h=>{delete h.backend.state.matches;}]){
    const h=harness();change(h);await assert.rejects(commit(h,'delete'));assert.equal(h.writes().length,0);
  }
  const h=harness({handler:r=>r.path.endsWith('get_team_state_for_me')?response(200,{state:state(),revision:1.5}):undefined});
  await assert.rejects(commit(h),/latest team state/);assert.equal(h.writes().length,0);
});
test('server revision conflict retains data and exposes review rather than force',async()=>{
  const h=harness({handler:(r,b)=>{if(r.path.endsWith('save_team_state')){b.revision++;return response(409,{message:'STALE_STATE'});}}});
  await assert.rejects(commit(h),code('MATCH_ACTION_CONFLICT'));assert.equal(h.writes().length,1);
  assert.equal(h.backend.state.matches[0].status,'played');assert.equal(h.backend.attendance.length,1);
});
test('already desired and lost-response retries are idempotent',async()=>{
  for(const action of ['undo','delete']){
    let lose=true;const h=harness({handler:(r,b)=>{
      if(lose&&r.path.endsWith('save_team_state')){lose=false;b.state=copy(r.body.p_state);b.revision++;throw Error('Network response lost');}
    }});
    await assert.rejects(commit(h,action),/response lost/);const result=await commit(h,action);
    assert.equal(result.alreadyApplied,true);assert.equal(h.writes().length,1,'lost response must not repeat a committed full-state write');
  }
});
test('empty success response never claims confirmation, retry rereads actual state',async()=>{
  let empty=true;const h=harness({handler:(r,b)=>{if(empty&&r.path.endsWith('save_team_state')){empty=false;b.state=copy(r.body.p_state);b.revision++;return response(200,null);}}});
  await assert.rejects(commit(h),/did not confirm/);assert.equal((await commit(h)).alreadyApplied,true);assert.equal(h.writes().length,1);
});
test('malformed read/save revisions cannot masquerade as a confirmed revision',async()=>{
  for(const revision of [null,false,'8',-1,1.5]){
    const h=harness({handler:r=>r.path.endsWith('get_team_state_for_me')?response(200,{state:state(),revision}):undefined});
    await assert.rejects(commit(h),/latest team state/);assert.equal(h.writes().length,0);
  }
  for(const revision of [null,false,'9',8,-1,1.5]){
    const h=harness({handler:r=>r.path.endsWith('save_team_state')?response(200,{revision}):undefined});
    await assert.rejects(commit(h),/did not confirm/);assert.equal(h.debug().activeRevision,1);
  }
});
test('invalid guard and effective parent capacity fail before any request',async()=>{
  const h=harness();h.setGuard(false);await assert.rejects(commit(h),code('MATCH_ACTION_CONTEXT_CHANGED'));assert.equal(h.requests.length,0);
  h.setGuard(true);h.test.getContext().acting_as_parent=true;await assert.rejects(commit(h),code('MATCH_ACTION_CONTEXT_CHANGED'));assert.equal(h.requests.length,0);
});
test('all captured scope changes after a read prevent the destructive RPC',async()=>{
  for(const change of [h=>h.setGuard(false),h=>{h.test.getContext().profile.role='parent';},h=>{h.test.getContext().profile.club_id='other-club';},h=>{h.test.getContext().acting_as_parent=true;},h=>{h.test.getTeam().id='other-team';},h=>{h.test.changeSession({...h.validSession,user:{id:'other-account'}});},h=>{h.window.ClubHubCloud={};},h=>{h.test.getContext().team=null;}]){
    const waiting=deferred();let h;h=harness({handler:r=>r.path.endsWith('get_team_state_for_me')?waiting.promise:undefined});
    const pending=commit(h);await tick();change(h);waiting.resolve(response(200,{state:state(),revision:8}));
    await assert.rejects(pending,code('MATCH_ACTION_CONTEXT_CHANGED'));assert.equal(h.writes().length,0);assert.equal(h.debug().activeRevision,1);
  }
});
test('different account stored while RPC is pending blocks follow-on work',async()=>{
  const waiting=deferred();let first=true;const h=harness({handler:r=>{if(first&&r.path.endsWith('get_team_state_for_me')){first=false;return waiting.promise;}}});
  const pending=commit(h);await tick();h.store.set('grassroots_hub_cloud_session_v1',JSON.stringify({...h.validSession,user:{id:'other-account'}}));
  waiting.resolve(response(200,{state:state(),revision:8}));await assert.rejects(pending,code('MATCH_ACTION_CONTEXT_CHANGED'));assert.equal(h.writes().length,0);
});
test('expired-token refresh rechecks guard and does not send after dialog closes',async()=>{
  const waiting=deferred(),h=harness({expired:true,handler:r=>r.path.startsWith('/auth/v1/token')?waiting.promise:undefined});
  const pending=commit(h);await tick();h.setGuard(false);waiting.resolve(response(200,{...h.validSession,access_token:'fresh',expires_in:3600}));
  await assert.rejects(pending,code('MATCH_ACTION_CONTEXT_CHANGED'));assert.equal(h.requests.filter(r=>r.path.startsWith('/rest/')).length,0);
});
test('old token refresh cannot overwrite or clear a newer account',async()=>{
  for(const status of [200,401]){
    const waiting=deferred(),h=harness({expired:true,handler:r=>r.path.startsWith('/auth/v1/token')?waiting.promise:undefined});
    const pending=commit(h);await tick();const next={...h.validSession,user:{id:'new-account'},access_token:'new-account-token',refresh_token:'new-account-refresh'};
    h.store.set('grassroots_hub_cloud_session_v1',JSON.stringify(next));waiting.resolve(response(status,status===200?{...h.validSession,access_token:'old-refreshed',expires_in:3600}:{message:'Expired old refresh token'}));
    await assert.rejects(pending,code('MATCH_ACTION_CONTEXT_CHANGED'));
    assert.equal(h.api.session.user.id,'new-account');assert.equal(JSON.parse(h.store.get('grassroots_hub_cloud_session_v1')).access_token,'new-account-token');
    assert.equal(h.requests.filter(r=>r.path.startsWith('/rest/')).length,0);
  }
});
test('destructive JWT rejection has no refresh or cross-account replay',async()=>{
  let h;h=harness({handler:r=>{if(r.path.endsWith('save_team_state')){h.store.set('grassroots_hub_cloud_session_v1',JSON.stringify({...h.validSession,user:{id:'different-account'}}));return response(401,{message:'JWT expired'});}}});
  await assert.rejects(commit(h),code('MATCH_ACTION_CONTEXT_CHANGED'));assert.equal(h.writes().length,1);
  assert.equal(h.requests.filter(r=>r.path.startsWith('/auth/')).length,0);
});
test('a scoped 401 is unconfirmed and is never automatically replayed',async()=>{
  const h=harness({handler:r=>r.path.endsWith('save_team_state')?response(401,{message:'JWT expired'}):undefined});
  await assert.rejects(commit(h),/JWT expired/);assert.equal(h.writes().length,1);assert.equal(h.requests.filter(r=>r.path.startsWith('/auth/')).length,0);
});
test('post-write guard failure does not read back into the new dialog',async()=>{
  const waiting=deferred();let h;h=harness({handler:(r,b)=>{if(r.path.endsWith('save_team_state')){b.state=copy(r.body.p_state);b.revision++;return waiting.promise;}}});
  const pending=commit(h);await tick();h.setGuard(false);waiting.resolve(response(200,{revision:9}));
  await assert.rejects(pending,code('MATCH_ACTION_CONTEXT_CHANGED'));assert.equal(h.requests.filter(r=>r.path.endsWith('get_team_state_for_me')).length,1);assert.equal(h.debug().activeRevision,1);
});
test('existing unsynced work blocks an action without dropping its draft',async()=>{
  const h=harness();h.test.setUnsynced(true);await assert.rejects(commit(h),code('MATCH_ACTION_SYNC_BUSY'));assert.equal(h.requests.length,0);assert.equal(h.debug().unsyncedState,true);
});
test('exclusive lease blocks duplicate action while the read is pending',async()=>{
  const waiting=deferred();let first=true;const h=harness({handler:r=>{if(first&&r.path.endsWith('get_team_state_for_me')){first=false;return waiting.promise;}}});
  const pending=commit(h);await tick();await assert.rejects(commit(h),code('MATCH_ACTION_SYNC_BUSY'));
  waiting.resolve(response(200,{state:state(),revision:8}));await pending;assert.equal(h.writes().length,1);
});
test('draft arriving during core write is quarantined and cannot resurrect the match',async()=>{
  const waiting=deferred();let block=true;const h=harness({handler:(r,b)=>{if(block&&r.path.endsWith('save_team_state')){block=false;b.state=copy(r.body.p_state);b.revision++;return waiting.promise;}}});
  const pending=commit(h);await tick();h.api.queueStateSave(state());waiting.resolve(response(200,{revision:9}));
  await assert.rejects(pending,code('MATCH_ACTION_SYNC_BUSY'));assert.equal(h.debug().quarantine,true);assert.equal(h.debug().pendingState.matches[0].status,'played');
  await h.fire(700);assert.equal(h.writes().length,1);assert.equal(h.backend.state.matches[0].status,'scheduled');
  await assert.rejects(h.api.confirmStateSave(state()),code('MATCH_ACTION_SYNC_BUSY'));assert.equal(await h.api.pullLatest({quiet:true}),null);
  const reviewed=await h.api.reviewMatchActionState(h.guard,{discardQueuedChanges:true});assert.equal(reviewed.state.matches[0].status,'scheduled');
  assert.equal(h.debug().pendingState,null);assert.equal(h.debug().unsyncedState,false);assert.equal(h.debug().quarantine,false);
});
test('new draft during token refresh prevents sending the prepared core write',async()=>{
  const waiting=deferred();let reads=0;const h=harness({handler:r=>{if(r.path.endsWith('get_team_state_for_me')){reads++;h.store.set('grassroots_hub_cloud_session_v1',JSON.stringify({...h.validSession,expires_at:1}));}if(r.path.startsWith('/auth/v1/token'))return waiting.promise;}});
  const pending=commit(h);await tick();assert.equal(reads,1);h.api.queueStateSave(state());
  waiting.resolve(response(200,{...h.validSession,access_token:'refreshed',expires_in:3600}));await assert.rejects(pending,code('MATCH_ACTION_SYNC_BUSY'));assert.equal(h.writes().length,0);
});
test('Review latest retains the draft on read failure and guard change',async()=>{
  for(const mode of ['offline','changed']){
    const waiting=deferred(),h=harness({handler:r=>r.path.endsWith('get_team_state_for_me')?waiting.promise:undefined});
    h.api.queueStateSave(state());const pending=h.api.reviewMatchActionState(h.guard,{discardQueuedChanges:true});await tick();
    if(mode==='changed'){h.setGuard(false);waiting.resolve(response(200,{state:state(),revision:8}));}else waiting.reject(Error('Offline'));
    await assert.rejects(pending);assert.equal(h.debug().pendingState.matches[0].status,'played');assert.equal(h.debug().unsyncedState,true);assert.equal(h.writes().length,0);
  }
});
test('Review latest never silently discards a newer draft arriving during its read',async()=>{
  const waiting=deferred(),h=harness({handler:r=>r.path.endsWith('get_team_state_for_me')?waiting.promise:undefined});
  h.api.queueStateSave(state());const pending=h.api.reviewMatchActionState(h.guard,{discardQueuedChanges:true});await tick();
  const newer=state();newer.meta.unrelated='New edit during review';h.api.queueStateSave(newer);waiting.resolve(response(200,{state:state(),revision:8}));
  await assert.rejects(pending,code('MATCH_ACTION_SYNC_BUSY'));assert.equal(h.debug().pendingState.meta.unrelated,'New edit during review');assert.equal(h.debug().unsyncedState,true);
});
test('Review latest discards only after a successful fresh scoped read',async()=>{
  const waiting=deferred(),h=harness({handler:r=>r.path.endsWith('get_team_state_for_me')?waiting.promise:undefined});
  h.api.queueStateSave(state());const pending=h.api.reviewMatchActionState(h.guard,{discardQueuedChanges:true});await tick();
  assert.ok(h.debug().pendingState,'retain draft until response');waiting.resolve(response(200,{state:state(),revision:11}));
  await pending;assert.equal(h.debug().pendingState,null);assert.equal(h.debug().unsyncedState,false);assert.equal(h.debug().activeRevision,11);assert.equal(h.writes().length,0);
});
test('cleanup confirms separately, carries only captured scope, and validates note reply',async()=>{
  const h=harness();await h.api.clearMatchActionAttendance('m1',h.guard);assert.deepEqual(h.backend.attendance,[]);assert.equal(h.backend.note,'Private fictional note');
  await h.api.clearMatchActionNote('m1',h.guard);assert.equal(h.backend.note,'');assert.equal(h.writes().length,0);
  assert.equal(h.requests[0].body.p_team_id,'team-a');assert.equal(h.requests[1].body.updated_by,'coach');
  const bad=harness({handler:r=>r.path.startsWith('/rest/v1/coach_match_notes')?response(200,[{team_id:'other-team',match_id:'m1',note:''}]):undefined});
  await assert.rejects(bad.api.clearMatchActionNote('m1',bad.guard),/did not confirm/);
});
test('cleanup checks context after the RPC and does not claim a late confirmation',async()=>{
  for(const method of ['clearMatchActionAttendance','clearMatchActionNote']){
    const waiting=deferred(),h=harness({handler:()=>waiting.promise});const pending=h.api[method]('m1',h.guard);await tick();
    h.setGuard(false);waiting.resolve(response(200,method==='clearMatchActionNote'?[{team_id:'team-a',match_id:'m1',note:''}]:null));
    await assert.rejects(pending,code('MATCH_ACTION_CONTEXT_CHANGED'));assert.equal(h.requests.length,1);
  }
});
test('attendance cleanup requires the exact confirmed zero-row RPC result',async()=>{
  for(const value of [null,[],{},1,'0',false]){
    const h=harness({handler:r=>r.path.endsWith('save_match_attendance')?response(200,value):undefined});
    await assert.rejects(h.api.clearMatchActionAttendance('m1',h.guard),/did not confirm the cleared match attendance/);
  }
});
test('request timeout releases the lease and a late refresh never sends an RPC',async()=>{
  const waiting=deferred(),h=harness({expired:true,handler:r=>r.path.startsWith('/auth/v1/token')?waiting.promise:undefined});
  const pending=commit(h);await tick();const settled=assert.rejects(pending,/did not confirm this request in time/);await h.fire(15000);await settled;
  assert.equal(h.debug().lease,false);waiting.resolve(response(200,{...h.validSession,access_token:'late-token',expires_in:3600}));await tick();
  assert.equal(h.requests.filter(r=>r.path.startsWith('/rest/')).length,0);
});
test('timed-out core response is ambiguous, and retry checks actual state without a second write',async()=>{
  const waiting=deferred();let first=true;const h=harness({handler:(r,b)=>{if(first&&r.path.endsWith('save_team_state')){first=false;b.state=copy(r.body.p_state);b.revision++;return waiting.promise;}}});
  const pending=commit(h);await tick();const rejected=assert.rejects(pending,/did not confirm this request in time/);await h.fire(15000);await rejected;
  assert.equal(h.debug().lease,false);assert.equal(h.debug().activeRevision,1);assert.equal(h.backend.attendance.length,1);assert.equal(h.backend.note,'Private fictional note');
  const retried=await commit(h);assert.equal(retried.alreadyApplied,true);assert.equal(h.writes().length,1);
  waiting.resolve(response(200,{revision:9}));await tick();assert.equal(h.writes().length,1);
});
test('ordinary debounced and confirmed saves retain their established behavior',async()=>{
  const h=harness(),draft=state();h.test.setRevision(h.backend.revision);draft.meta.unrelated='Ordinary edit';h.api.queueStateSave(draft);assert.equal(h.writes().length,0);
  await h.fire(700);assert.equal(h.writes().length,1);assert.equal(h.backend.state.meta.unrelated,'Ordinary edit');assert.equal(h.debug().unsyncedState,false);
  draft.meta.unrelated='Explicit ordinary save';h.api.queueStateSave(draft);await h.api.confirmStateSave(draft);assert.equal(h.writes().length,2);assert.equal(h.debug().unsyncedState,false);
});

(async()=>{for(const [name,fn]of tests){await fn();process.stdout.write('PASS '+name+'\n');}process.stdout.write(`Cloud match-action regression: ${tests.length} scenarios passed\n`);})().catch(error=>{console.error(error);process.exitCode=1;});
