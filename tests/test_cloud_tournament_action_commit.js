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
  const localStorage={getItem:k=>store.get(k)||null,setItem(k,v){store.set(k,String(v));this[k]=String(v);},removeItem(k){store.delete(k);delete this[k];}};
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
  const sandbox={window,localStorage,location:{protocol:'https:',origin:'https://fictional.test',search:'',hash:'',href:'https://fictional.test/'},URLSearchParams,URL,AbortController,fetch,document:{getElementById:()=>null},Event:class{constructor(type){this.type=type;}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>0,clearInterval:()=>{},console};
  const expose=`
  window.__testCloud={
    initialize(s){saveSession(s);activeTeam={id:'team-a',club_id:'club-a',age_group:12};context={profile:{role:'coach',club_id:'club-a'},team:activeTeam,real_role:'coach'};visibleTeams=[activeTeam];activeRevision=1;hooks={onRemoteState:state=>window.__updates.push(state)};},
    getContext:()=>context,getTeam:()=>activeTeam,
    changeSession:s=>saveSession(s),setUnsynced:v=>{unsyncedState=v;},setRevision:v=>{activeRevision=v;},
    seedStorage:(k,v)=>localStorage.setItem(k,v),clearPrivateData:clearAccountLocalData,
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
const event={id:'t1',name:'Autumn Tournament',date:'2026-10-11',location:'Example Ground',format:'group_knockout',playerNames:['Fictional player']};
function tournamentState(){return {
  tournaments:[{...copy(event),serverOnly:'retain event metadata'},{id:'other-event',name:'Other tournament',date:'2026-10-12',location:'Other Ground',format:'festival',playerNames:[]}],
  matches:[{...copy(originalMatch),id:'game-a',competition:'Tournament',tournamentId:'t1'},{...copy(originalMatch),id:'game-b',competition:'Tournament',tournamentId:'t1',opponent:'Other Fictional Side'},{...copy(originalMatch),id:'unrelated',tournamentId:'other-event'}],
  goals:[{matchId:'game-a',player:'Fictional player'},{matchId:'unrelated',player:'Other'}],assists:[{matchId:'game-b',player:'Fictional player'},{matchId:'unrelated',player:'Other'}],bookings:[{matchId:'game-a',kind:'yellow'},{matchId:'unrelated',kind:'red'}],awards:[{matchId:'game-b',type:'Coach'},{matchId:'unrelated',type:'Parent'}],
  squad:[{id:'p1',name:'Fictional player',number:1,status:'active'}],tactics:{matchdaySelections:{retained:['p1']},matchPlanByFixture:{retained:{focus:'Keep this plan'}}},selkent:{fixtures:[{date:'2099-10-11',opponent:'Future Example'}]},meta:{unrelated:'preserved'}
};}
const fresh=options=>harness({data:tournamentState(),...options});
function payload(action='save',extra={}){
  const data=tournamentState();return {action,tournamentId:'t1',tournament:{...copy(event),location:'New Example Ground'},expectedTournament:copy(event),expectedGames:data.matches.filter(row=>row.tournamentId==='t1'),gameIds:['game-a','game-b'],...extra};
}
const commit=(h,args=payload())=>h.api.commitTournamentAction(args,h.guard);
const code=expected=>error=>error?.code===expected;
const tests=[];const test=(name,fn)=>tests.push([name,fn]);

test('edit patches one event onto fresh state and preserves unrelated server edits',async()=>{
  const h=fresh();h.backend.state.meta.latest='Added remotely';h.backend.state.tournaments[1].location='Latest unrelated venue';
  h.store.set('grassroots_hub_team_state_cache_v1_team-a','obsolete event');const before=copy(h.backend.state),result=await commit(h);
  const expected=copy(before);expected.tournaments[0].location='New Example Ground';assert.deepEqual(copy(result.state),expected);assert.deepEqual(h.backend.state,expected);
  assert.equal(h.writes()[0].body.p_expected_revision,8);assert.equal(result.revision,9);assert.equal(result.alreadyApplied,false);
  assert.equal(h.store.has('grassroots_hub_team_state_cache_v1_team-a'),false);assert.equal(h.backend.attendance.length,1);assert.equal(h.backend.note,'Private fictional note');
});
test('create reserves one stable ID and lost-response retry never duplicates the event',async()=>{
  let lose=true;const h=fresh({handler:(r,b)=>{if(lose&&r.path.endsWith('save_team_state')){lose=false;b.state=copy(r.body.p_state);b.revision++;throw Error('Lost response');}}});
  const args=payload('save',{tournamentId:'stable-new',tournament:{...event,id:'stable-new',name:'New Example Event',date:'2026-11-01'},expectedTournament:null,expectedGames:[],gameIds:[]});
  await assert.rejects(commit(h,args),/Lost response/);const result=await commit(h,args);assert.equal(result.alreadyApplied,true);assert.equal(h.writes().length,1);
  assert.equal(h.backend.state.tournaments.filter(row=>row.id==='stable-new').length,1);
});
test('reordered squad checkbox names are persisted exactly rather than falsely treated as already applied',async()=>{
  const data=tournamentState();data.squad.push({name:'Second fictional player',number:2,status:'active'});data.tournaments[0].playerNames.push('Second fictional player');
  const baseline=copy(data.tournaments[0]),candidate={...copy(baseline),playerNames:[...baseline.playerNames].reverse()},h=fresh({data});
  const result=await commit(h,payload('save',{tournament:candidate,expectedTournament:baseline}));
  assert.equal(result.alreadyApplied,false);assert.equal(h.writes().length,1);assert.deepEqual(copy(result.state.tournaments[0].playerNames),candidate.playerNames);
  assert.equal((await commit(h,payload('save',{tournament:candidate,expectedTournament:baseline}))).alreadyApplied,true);
});
test('delete CAS removes only captured event, games and performance; private cleanup is separate',async()=>{
  const h=fresh(),before=copy(h.backend.state),result=await commit(h,payload('delete'));
  const expected=copy(before);expected.tournaments=expected.tournaments.filter(row=>row.id!=='t1');expected.matches=expected.matches.filter(row=>!['game-a','game-b'].includes(row.id));
  for(const key of ['goals','assists','bookings','awards'])expected[key]=expected[key].filter(row=>!['game-a','game-b'].includes(row.matchId));
  assert.deepEqual(copy(result.state),expected);assert.equal(h.writes()[0].body.p_expected_revision,8);
  assert.equal(h.backend.attendance.length,1);assert.equal(h.backend.note,'Private fictional note');assert.equal(h.requests.length,3,'read, CAS and confirmed raw readback only');
});
test('delete lost-response retry requires all captured games and report rows absent',async()=>{
  let lose=true;const h=fresh({handler:(r,b)=>{if(lose&&r.path.endsWith('save_team_state')){lose=false;b.state=copy(r.body.p_state);b.revision++;throw Error('Lost response');}}});
  await assert.rejects(commit(h,payload('delete')),/Lost response/);
  const result=await commit(h,{action:'delete',tournamentId:'t1',gameIds:['game-a','game-b']});assert.equal(result.alreadyApplied,true);assert.equal(h.writes().length,1);
});
test('event absence alone and orphaned performance never permit cleanup confirmation',async()=>{
  for(const mode of ['remaining-game','orphaned-performance','new-linked-game']){
    const h=fresh();h.backend.state.tournaments=h.backend.state.tournaments.filter(row=>row.id!=='t1');
    if(mode!=='remaining-game')h.backend.state.matches=h.backend.state.matches.filter(row=>row.tournamentId!=='t1');
    if(mode==='new-linked-game'){for(const key of ['goals','assists','bookings','awards'])h.backend.state[key]=[];h.backend.state.matches.push({...originalMatch,id:'new-game',tournamentId:'t1'});}
    await assert.rejects(commit(h,{action:'delete',tournamentId:'t1',gameIds:['game-a','game-b']}),code('MATCH_ACTION_CONFLICT'));assert.equal(h.writes().length,0);
  }
});
test('changed event, linked game record or membership conflicts before any write',async()=>{
  for(const change of [s=>s.tournaments[0].location='Changed remotely',s=>s.matches[0].notes='New private report',s=>s.matches[0].gf=9,s=>s.matches.push({...s.matches[0],id:'new-linked'}),s=>s.matches.splice(0,1),s=>s.matches[0].tournamentId='other-event']){
    for(const action of ['save','delete']){const h=fresh();change(h.backend.state);await assert.rejects(commit(h,payload(action)),code('MATCH_ACTION_CONFLICT'));assert.equal(h.writes().length,0);}
  }
});
test('provider-owned linked games are protected even with a current baseline',async()=>{
  for(const source of ['selkent-fixture','github-static-fixtures-v2','cloudflare-static-results-v2','static-fixture']){
    const data=tournamentState();data.matches[0].source=source;const h=fresh({data});const args=payload('delete',{expectedGames:data.matches.filter(row=>row.tournamentId==='t1')});
    await assert.rejects(commit(h,args),code('MATCH_ACTION_CONFLICT'));assert.equal(h.writes().length,0);
  }
});
test('captured IDs must be unique and agree with complete expected games',async()=>{
  for(const extra of [{gameIds:['game-a','game-a']},{gameIds:['game-a']},{expectedGames:[tournamentState().matches[0],tournamentState().matches[0]]},{gameIds:['']},{expectedTournament:{...event,id:'wrong-event'}}]){
    const h=fresh();await assert.rejects(commit(h,payload('delete',extra)),code('MATCH_ACTION_CONFLICT'));assert.equal(h.requests.length,0);
  }
});
test('new write requires expected game baseline; desired raw save may confirm without it',async()=>{
  const h=fresh();await assert.rejects(commit(h,{...payload(),expectedGames:undefined}),code('MATCH_ACTION_CONFLICT'));assert.equal(h.writes().length,0);
  await commit(h);const result=await commit(h,{action:'save',tournamentId:'t1',tournament:payload().tournament,gameIds:['game-a','game-b']});assert.equal(result.alreadyApplied,true);assert.equal(h.writes().length,1);
});
test('save validates fields and the current active squad, including U11 without numbers',async()=>{
  for(const change of [t=>t.name='',t=>t.date='2026-02-30',t=>t.format='unknown',t=>t.location='x'.repeat(161),t=>t.playerNames=['Fictional player','Fictional player'],t=>t.playerNames=['Not in this team'],t=>t.playerNames={}]){
    const h=fresh(),args=payload();change(args.tournament);await assert.rejects(commit(h,args));assert.equal(h.writes().length,0);
  }
  for(const mode of ['inactive','removed']){
    const changed=fresh();if(mode==='inactive')changed.backend.state.squad[0].status='inactive';else changed.backend.state.squad=[];
    await assert.rejects(commit(changed),error=>error.code==='MATCH_ACTION_CONFLICT'&&/squad changed/.test(error.message));assert.equal(changed.writes().length,0,'known fresh-roster conflict must offer Review without a CAS');
  }
  for(const status of [undefined,'pending']){const h=fresh();h.backend.state.squad[0].status=status;await commit(h);assert.equal(h.writes().length,1,'normalizeState treats non-inactive legacy status as active');}
  const h=fresh();h.test.getTeam().age_group=9;delete h.backend.state.squad[0].number;await commit(h);assert.equal(h.writes().length,1,'active staff-visible U11 player does not need a device number');
});
test('deleted existing tournament is never recreated from an obsolete Save draft',async()=>{
  const h=fresh();h.backend.state.tournaments=h.backend.state.tournaments.filter(row=>row.id!=='t1');h.backend.state.matches=h.backend.state.matches.filter(row=>row.tournamentId!=='t1');
  await assert.rejects(commit(h),code('MATCH_ACTION_CONFLICT'));assert.equal(h.writes().length,0);
});
function legacyState(){const data=tournamentState();data.tournaments=data.tournaments.filter(row=>row.id!=='t1');for(const row of data.matches.filter(row=>row.tournamentId==='t1'))delete row.tournamentId;data.matches.push({...originalMatch,id:'other-legacy',date:'2026-10-14',competition:'Other Tournament'});return data;}
const legacyId='tlegacy_2026_10_11_tournament';
function legacyPayload(action='save',extra={}){
  const data=legacyState(),t={id:legacyId,name:'Tournament',date:'2026-10-11',location:'',format:'group_knockout',playerNames:[]};
  return {action,tournamentId:legacyId,tournament:{...t,location:'Verified Example Ground'},expectedTournament:t,expectedGames:data.matches.filter(row=>['game-a','game-b'].includes(row.id)).map(row=>({...row,tournamentId:legacyId})),gameIds:['game-a','game-b'],...extra};
}
test('legacy Save materializes only selected event and its verified unlinked games',async()=>{
  const h=fresh({data:legacyState()}),before=copy(h.backend.state);await commit(h,legacyPayload());
  assert.equal(h.backend.state.tournaments.length,before.tournaments.length+1);assert.equal(h.backend.state.tournaments.at(-1).id,legacyId);
  for(const id of ['game-a','game-b'])assert.equal(h.backend.state.matches.find(row=>row.id===id).tournamentId,legacyId);
  assert.equal(h.backend.state.matches.find(row=>row.id==='other-legacy').tournamentId,undefined);assert.deepEqual(h.backend.state.tactics,before.tactics);assert.deepEqual(h.backend.state.goals,before.goals);
  assert.equal((await commit(h,legacyPayload())).alreadyApplied,true);assert.equal(h.writes().length,1);
});
test('legacy Delete removes only selected group without materializing others',async()=>{
  const h=fresh({data:legacyState()}),before=copy(h.backend.state);await commit(h,legacyPayload('delete'));
  assert.deepEqual(h.backend.state.tournaments,before.tournaments);assert.equal(h.backend.state.matches.find(row=>row.id==='other-legacy').tournamentId,undefined);assert.deepEqual(h.backend.state.tactics,before.tactics);
});
test('virtual legacy event alone is never mistaken for an applied Save',async()=>{
  const args=legacyPayload();args.tournament=copy(args.expectedTournament);const h=fresh({data:legacyState()});const result=await commit(h,args);
  assert.equal(result.alreadyApplied,false);assert.equal(h.writes().length,1);assert(h.backend.state.tournaments.some(row=>row.id===legacyId));
});
test('existing raw event with missing legacy links still needs a confirmed write',async()=>{
  const data=legacyState(),existing={...copy(event),name:'Tournament'};data.tournaments.push(existing);const h=fresh({data}),games=data.matches.filter(row=>['game-a','game-b'].includes(row.id)).map(row=>({...row,tournamentId:'t1'}));
  const args=payload('save',{tournament:copy(existing),expectedTournament:copy(existing),expectedGames:games});const result=await commit(h,args);assert.equal(result.alreadyApplied,false);assert.equal(h.writes().length,1);assert.equal(h.backend.state.matches[0].tournamentId,'t1');
});
test('legacy Save cannot assign provider-owned game associations; ordinary event metadata Save remains allowed',async()=>{
  const data=legacyState();data.matches[0].source='github-static-fixtures-v2';const args=legacyPayload();args.expectedGames[0].source=data.matches[0].source;
  const h=fresh({data});await assert.rejects(commit(h,args),code('MATCH_ACTION_CONFLICT'));assert.equal(h.writes().length,0);
  const regular=tournamentState();regular.matches[0].source='github-static-fixtures-v2';const allowed=fresh({data:regular});await commit(allowed,payload('save',{expectedGames:regular.matches.filter(row=>row.tournamentId==='t1')}));assert.equal(allowed.writes().length,1);
});
test('legacy ID collisions, duplicate events and duplicate game IDs fail closed',async()=>{
  for(const change of [s=>s.matches.push({...originalMatch,id:'new-member',competition:'Tournament',date:'2026-10-11'}),s=>s.tournaments.push({id:legacyId,name:'Unrelated event',date:'2026-10-10'}),s=>s.matches.push({...s.matches[0],tournamentId:'other-event'}),s=>s.tournaments.push({id:'dup-a',name:'Tournament',date:'2026-10-11'},{id:'dup-b',name:'Tournament',date:'2026-10-11'})]){
    const data=legacyState();change(data);const h=fresh({data});await assert.rejects(commit(h,legacyPayload()),code('MATCH_ACTION_CONFLICT'));assert.equal(h.writes().length,0);
  }
  const data=tournamentState();data.tournaments.push(copy(event));const h=fresh({data});await assert.rejects(commit(h),code('MATCH_ACTION_CONFLICT'));assert.equal(h.writes().length,0);
});
test('punctuation-normalized distinct legacy groups cannot share a generated ID',async()=>{
  const data=legacyState();data.matches[0].competition='Tournament A';data.matches[1].competition='Tournament-A';const h=fresh({data});
  const id='tlegacy_2026_10_11_tournament_a',args=legacyPayload('delete',{tournamentId:id,expectedTournament:{...event,id,name:'Tournament A'},expectedGames:[{...data.matches[0],tournamentId:id}],gameIds:['game-a']});
  await assert.rejects(commit(h,args),code('MATCH_ACTION_CONFLICT'));assert.equal(h.writes().length,0);
});
test('create or rename cannot implicitly adopt an unconfirmed legacy group',async()=>{
  const data=legacyState(),h=fresh({data}),args=payload('save',{tournamentId:'new-id',tournament:{...event,id:'new-id',name:'Tournament'},expectedTournament:null,expectedGames:[],gameIds:[]});
  await assert.rejects(commit(h,args),code('MATCH_ACTION_CONFLICT'));assert.equal(h.writes().length,0);
});
test('legacy match status normalization matches the existing display baseline',async()=>{
  const data=legacyState();delete data.matches[0].status;data.matches[1].status='PLAYED';const args=legacyPayload();const h=fresh({data});
  await commit(h,args);assert.equal(h.writes().length,1);assert.equal(h.backend.state.matches[0].status,undefined,'materialization changes association only');
});
test('revision races conflict without forced retry or private cleanup',async()=>{
  const h=fresh({handler:(r,b)=>{if(r.path.endsWith('save_team_state')){b.revision++;return response(409,{message:'STALE_STATE'});}}});
  await assert.rejects(commit(h),code('MATCH_ACTION_CONFLICT'));assert.equal(h.writes().length,1);assert.equal(h.writes()[0].body.p_expected_revision,8);assert.equal(h.backend.attendance.length,1);
});
test('intent is detached before awaits so caller mutation cannot broaden deletion',async()=>{
  const waiting=deferred();let first=true;const h=fresh({handler:r=>{if(first&&r.path.endsWith('get_team_state_for_me')){first=false;return waiting.promise;}}});
  const args=payload('delete'),pending=commit(h,args);await tick();args.gameIds.push('unrelated');args.expectedGames.push(tournamentState().matches[2]);
  waiting.resolve(response(200,{state:copy(h.backend.state),revision:8}));await pending;assert(h.backend.state.matches.some(row=>row.id==='unrelated'));
});
test('account, team, capacity, cloud, state/dialog guard changes stop before CAS',async()=>{
  for(const change of [h=>h.setGuard(false),h=>h.test.getTeam().id='other-team',h=>h.test.getContext().acting_as_parent=true,h=>h.test.getContext().profile.role='parent',h=>h.window.ClubHubCloud={},h=>h.test.changeSession({...h.validSession,user:{id:'other-account'}})]){
    const waiting=deferred(),h=fresh({handler:r=>r.path.endsWith('get_team_state_for_me')?waiting.promise:undefined});const pending=commit(h);await tick();change(h);waiting.resolve(response(200,{state:copy(h.backend.state),revision:8}));
    await assert.rejects(pending,code('MATCH_ACTION_CONTEXT_CHANGED'));assert.equal(h.writes().length,0);assert.equal(h.debug().activeRevision,1);
  }
});
test('match and tournament actions share one exclusive lease',async()=>{
  const waiting=deferred();let first=true;const h=fresh({handler:r=>{if(first&&r.path.endsWith('get_team_state_for_me')){first=false;return waiting.promise;}}});const pending=commit(h);await tick();
  await assert.rejects(h.api.commitMatchAction({action:'delete',matchId:'game-a',expectedMatch:tournamentState().matches[0]},h.guard),code('MATCH_ACTION_SYNC_BUSY'));
  waiting.resolve(response(200,{state:copy(h.backend.state),revision:8}));await pending;assert.equal(h.writes().length,1);
});
test('queued stale state is quarantined after deletion and explicit fresh Review resolves it',async()=>{
  const waiting=deferred();let first=true;const h=fresh({handler:(r,b)=>{if(first&&r.path.endsWith('save_team_state')){first=false;b.state=copy(r.body.p_state);b.revision++;return waiting.promise;}}});const pending=commit(h,payload('delete'));await tick();
  h.api.queueStateSave(tournamentState());waiting.resolve(response(200,{revision:9}));await assert.rejects(pending,code('MATCH_ACTION_SYNC_BUSY'));assert.equal(h.debug().quarantine,true);
  await h.fire(700);assert.equal(h.writes().length,1);assert.equal(h.backend.state.tournaments.some(row=>row.id==='t1'),false);
  await h.api.reviewMatchActionState(h.guard,{discardQueuedChanges:true});assert.equal(h.debug().pendingState,null);assert.equal(h.debug().quarantine,false);
});
test('cleanup verification initial-read interference cannot resurrect an already-deleted event at matching revision',async()=>{
  const data=tournamentState();data.tournaments=data.tournaments.filter(row=>row.id!=='t1');data.matches=data.matches.filter(row=>row.tournamentId!=='t1');
  for(const key of ['goals','assists','bookings','awards'])data[key]=data[key].filter(row=>!['game-a','game-b'].includes(row.matchId));
  const waiting=deferred();let first=true;const h=fresh({data,handler:r=>{if(first&&r.path.endsWith('get_team_state_for_me')){first=false;return waiting.promise;}}});h.test.setRevision(8);
  const pending=commit(h,{action:'delete',tournamentId:'t1',gameIds:['game-a','game-b'],expectedTournament:null,expectedGames:null});await tick();
  h.api.queueStateSave(tournamentState());waiting.resolve(response(200,{state:copy(data),revision:8}));await assert.rejects(pending,code('MATCH_ACTION_SYNC_BUSY'));
  assert.equal(h.debug().quarantine,true);assert(h.debug().pendingState.tournaments.some(row=>row.id==='t1'),'late draft remains recoverable');
  await h.fire(700);assert.equal(h.writes().length,0,'matching revision must not allow automatic stale whole-state CAS');assert.equal(h.backend.state.tournaments.some(row=>row.id==='t1'),false);assert.equal(h.backend.state.matches.some(row=>row.id==='game-a'),false);
  await assert.rejects(h.api.reviewMatchActionState(h.guard),code('MATCH_ACTION_SYNC_BUSY'));assert(h.debug().pendingState,'undisclosed review cannot discard draft');
  const reviewed=await h.api.reviewMatchActionState(h.guard,{discardQueuedChanges:true});assert.equal(reviewed.state.tournaments.some(row=>row.id==='t1'),false);assert.equal(h.debug().pendingState,null);assert.equal(h.debug().quarantine,false);
});
test('lost-response Save retry with retained baseline also quarantines initial-read interference',async()=>{
  const waiting=deferred();let lose=true,holdRead=false;const h=fresh({handler:(r,b)=>{
    if(lose&&r.path.endsWith('save_team_state')){lose=false;b.state=copy(r.body.p_state);b.revision++;throw Error('Lost response');}
    if(holdRead&&r.path.endsWith('get_team_state_for_me')){holdRead=false;return waiting.promise;}
  }});
  await assert.rejects(commit(h),/Lost response/);h.test.setRevision(h.backend.revision);holdRead=true;
  const pending=commit(h);await tick();h.api.queueStateSave(tournamentState());waiting.resolve(response(200,{state:copy(h.backend.state),revision:h.backend.revision}));
  await assert.rejects(pending,code('MATCH_ACTION_SYNC_BUSY'));assert.equal(h.debug().quarantine,true);await h.fire(700);
  assert.equal(h.writes().length,1,'only the original lost-response CAS may be sent');assert.equal(h.backend.state.tournaments[0].location,'New Example Ground');
  assert.equal(h.debug().pendingState.tournaments[0].location,'Example Ground');await h.api.reviewMatchActionState(h.guard,{discardQueuedChanges:true});assert.equal(h.debug().pendingState,null);
});
test('bounded timeout after applied CAS leaves ambiguous state and retry rereads without another write',async()=>{
  const waiting=deferred();let first=true;const h=fresh({handler:(r,b)=>{if(first&&r.path.endsWith('save_team_state')){first=false;b.state=copy(r.body.p_state);b.revision++;return waiting.promise;}}});
  const pending=commit(h);await tick();const rejected=assert.rejects(pending,/did not confirm this request in time/);await h.fire(15000);await rejected;
  assert.equal(h.debug().activeRevision,1);assert.equal((await commit(h)).alreadyApplied,true);assert.equal(h.writes().length,1);waiting.resolve(response(200,{revision:9}));await tick();
});
test('destructive auth rejection does not replay under a newer account',async()=>{
  let h;h=fresh({handler:r=>{if(r.path.endsWith('save_team_state')){h.store.set('grassroots_hub_cloud_session_v1',JSON.stringify({...h.validSession,user:{id:'other-account'}}));return response(401,{message:'JWT expired'});}}});
  await assert.rejects(commit(h,payload('delete')),code('MATCH_ACTION_CONTEXT_CHANGED'));assert.equal(h.writes().length,1);assert.equal(h.requests.filter(r=>r.path.startsWith('/auth/')).length,0);
});
test('empty and malformed CAS confirmations cannot report tournament success',async()=>{
  for(const reply of [null,{revision:null},{revision:'9'},{revision:8}]){const h=fresh({handler:r=>r.path.endsWith('save_team_state')?response(200,reply):undefined});await assert.rejects(commit(h),/did not confirm/);assert.equal(h.debug().activeRevision,1);}
});
test('existing account-data eviction removes Save draft payloads and invalid recovery, retaining Delete IDs only',async()=>{
  const h=fresh(),prefix='grassrootsHub_tournament_action_v1:';
  h.test.seedStorage(prefix+'save',JSON.stringify({action:'save',tournamentId:'t1',candidate:event,baseline:event}));
  h.test.seedStorage(prefix+'bad','invalid json');h.test.seedStorage(prefix+'unknown',JSON.stringify({action:'unknown',candidate:event}));
  const deleted={version:1,scope:'delete',action:'delete',tournamentId:'t1',gameIds:['game-a'],stateConfirmed:true,attendanceCleared:[],noteCleared:[],attempted:true};
  h.test.seedStorage(prefix+'tainted',JSON.stringify({...deleted,scope:'tainted',candidate:event}));h.test.seedStorage(prefix+'invalid',JSON.stringify({...deleted,scope:'invalid',attendanceCleared:['not-captured']}));
  h.test.seedStorage(prefix+'delete',JSON.stringify(deleted));h.test.seedStorage('unrelated_setting','dark');h.test.seedStorage('grassroots_hub_team_state_cache_v1_team-a','private old state');
  h.test.clearPrivateData();assert.equal(h.store.has(prefix+'save'),false);assert.equal(h.store.has(prefix+'bad'),false);assert.equal(h.store.has(prefix+'unknown'),false);
  assert.deepEqual(JSON.parse(h.store.get(prefix+'delete')),deleted);assert.equal(h.store.has(prefix+'tainted'),false);assert.equal(h.store.has(prefix+'invalid'),false);assert.equal(h.store.get('unrelated_setting'),'dark');assert.equal(h.store.has('grassroots_hub_team_state_cache_v1_team-a'),false);
});

(async()=>{for(const [name,fn]of tests){await fn();console.log('PASS '+name);}console.log(`Cloud tournament-action regression: ${tests.length} scenarios passed`);})().catch(error=>{console.error(error);process.exitCode=1;});
