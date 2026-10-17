// Exercise the built Undo/Remove flow with fictional state and blocked services.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist');
const out=path.resolve(process.argv[3]||'match-action-review');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((request,response)=>{
 const pathname=new URL(request.url,'http://localhost').pathname;
 if(pathname==='/cloud-config.js'){
  response.setHeader('Content-Type','text/javascript');
  return response.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://fictional.supabase.co",anonKey:"fictional-only-no-credentials-00000000000000000000000000"};');
 }
 if(pathname.startsWith('/data/')){
  response.setHeader('Content-Type','application/json');
  return response.end('{"schema_version":2,"provider":"Selkent","last_updated":"2026-10-16T00:00:00Z","clubs":[],"age_groups":[]}');
 }
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);return response.end();}
 response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'})[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(response);
});
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PITCHKIND_CHROMIUM?{executablePath:process.env.PITCHKIND_CHROMIUM}:{}),args:['--no-sandbox']});
 const page=await browser.newPage(),errors=[],externalWrites=[],dialogs=[],answers=[];
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('dialog',async dialog=>{dialogs.push({type:dialog.type(),message:dialog.message()});if(answers.shift()===false)await dialog.dismiss();else await dialog.accept();});
 await page.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===base)return route.continue();
  if(request.method()!=='GET')externalWrites.push({url:request.url(),method:request.method()});
  if(url.hostname==='www.google.com'&&url.pathname==='/maps')return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><body>Fictional venue map</body>'});
  return route.fulfill({status:200,contentType:'application/json',body:'[]'});
 });
 const panel=()=>page.locator('#match-action-outcome');
 const actionButton=name=>page.locator('#match-action-outcome [data-match-action="'+name+'"]');
 async function prepare({width=393,theme='dark',clearIntent=true,saved=null,source='manual'}={}){
  answers.length=0;dialogs.length=0;
  await page.setViewportSize({width,height:850});
  await page.goto(base+'/');
  await page.waitForFunction(()=>typeof startMatchAction==='function'&&typeof renderAll==='function');
  await page.evaluate(({theme,clearIntent,saved,source})=>{
   const copy=value=>JSON.parse(JSON.stringify(value));
   if(clearIntent)for(const key of Object.keys(localStorage))if(key.startsWith('grassrootsHub_match_action_v1:'))localStorage.removeItem(key);
   applyTheme(theme);document.getElementById('app-splash')?.remove();document.body.classList.remove('splash-active','auth-open');document.getElementById('activation-gate').classList.add('hidden');document.querySelector('.app-shell').classList.remove('account-locked');
   currentRole='coach';adminUiMode='team';account={role:'coach',user:'Fictional Coach'};
   window.__actionCase={uid:'fictional-coach',club:'fictional-club',team:'fictional-team',capacity:false,hold:'',failCore:false,failSync:false,conflict:false,failAttendance:false,failNote:false,failStats:false,loseResponse:false,calls:[],stateWrites:0,attendanceWrites:0,noteWrites:0,queued:[],toasts:[],reviewOptions:[],attendance:[{player_name:'Example Child',status:'present'}],note:'Fictional private observation'};
   const test=__actionCase,api=window.ClubHubCloud;
   Object.defineProperty(api,'session',{configurable:true,get:()=>({user:{id:test.uid}})});
   Object.defineProperty(api,'context',{configurable:true,get:()=>({profile:{user_id:test.uid,club_id:test.club,role:currentRole},real_role:'coach',acting_as_parent:test.capacity})});
   const changed=()=>Object.assign(Error('Fictional context changed'),{code:'MATCH_ACTION_CONTEXT_CHANGED'});
   const check=guard=>{if(typeof guard!=='function'||guard()!==true)throw changed();};
   const conflict=()=>Object.assign(Error('Fictional result changed'),{code:'MATCH_ACTION_CONFLICT'});
   async function wait(stage,guard){check(guard);if(test.hold===stage)await new Promise(resolve=>{test.release=resolve;});check(guard);}
   function desired(action,id){const m=test.server.matches.find(m=>m.id===id);return action==='delete'?!m:!!m&&m.status==='scheduled'&&Number(m.gf)===0&&Number(m.ga)===0&&['goals','assists','bookings','awards'].every(key=>!(test.server[key]||[]).some(row=>row.matchId===id));}
   Object.assign(api,{
    role:()=>currentRole,realRole:()=> 'coach',actingAsParent:()=>test.capacity,isStaffAccount:()=>true,canAdmin:()=>false,canEdit:()=>currentRole==='coach'&&!test.capacity,
    currentTeam:()=>({id:test.team,ageGroup:'U12',teamName:'Example Greens',leagueName:'Example Greens'}),visibleTeamList:()=>[],
    listAnnouncements:async()=>[],listNotifications:async()=>[],listPlayerAppearanceStats:async()=>{if(test.failStats)throw Error('Fictional derived stats failure');return [];},listParentPlayerLinks:async()=>[],listMatchAvailability:async()=>[],listMessageContacts:async()=>[],listClubMessages:async()=>[],getKickoffPushSettings:async()=>({available:false}),
    listMatchAttendance:async()=>copy(test.attendance),getCoachMatchNote:async()=>({note:test.note}),recordAuditEvent:async()=>({ok:true}),
    queueStateSave:state=>test.queued.push(copy(state)),
    commitMatchAction:async(payload,guard)=>{
     test.calls.push({stage:'core',action:payload.action,id:payload.matchId,expected:payload.expectedMatch!==null});
     await wait('core',guard);
     if(test.failCore)throw Error('Fictional offline');if(test.failSync)throw Object.assign(Error('Fictional unrelated pending edits'),{code:'MATCH_ACTION_SYNC_BUSY'});if(test.conflict)throw conflict();
     if(desired(payload.action,payload.matchId))return {state:copy(test.server),revision:3,updatedAt:'2026-10-16T20:00:00Z',alreadyApplied:true};
     const match=test.server.matches.find(m=>m.id===payload.matchId);
     if(!payload.expectedMatch||!match||JSON.stringify(match)!==JSON.stringify(payload.expectedMatch))throw conflict();
     const next=copy(test.server);
     if(payload.action==='delete')next.matches=next.matches.filter(m=>m.id!==payload.matchId);
     else Object.assign(next.matches.find(m=>m.id===payload.matchId),{status:'scheduled',gf:0,ga:0});
     for(const key of ['goals','assists','bookings','awards'])next[key]=(next[key]||[]).filter(row=>row.matchId!==payload.matchId);
     test.server=next;test.stateWrites++;
     if(test.loseResponse){test.loseResponse=false;throw Error('Fictional response lost after commit');}
     return {state:copy(next),revision:2,updatedAt:'2026-10-16T20:00:00Z',alreadyApplied:false};
    },
    reviewMatchActionState:async(guard,options)=>{test.calls.push({stage:'review'});test.reviewOptions.push(copy(options||{}));await wait('review',guard);return {state:copy(test.server),revision:2,updatedAt:'2026-10-16T20:00:00Z'};},
    clearMatchActionAttendance:async(id,guard)=>{test.calls.push({stage:'attendance',id});await wait('attendance',guard);if(test.failAttendance)throw Error('Fictional attendance error');test.attendance=[];test.attendanceWrites++;},
    clearMatchActionNote:async(id,guard)=>{test.calls.push({stage:'note',id});await wait('note',guard);if(test.failNote)throw Error('Fictional private note error');test.note='';test.noteWrites++;},
    saveMatchAttendance:async()=>{throw Error('Ordinary attendance write bypassed action guard');},saveCoachMatchNote:async()=>{throw Error('Ordinary note write bypassed action guard');},
   });
   fetchClubDirectoryDetails=async()=>({});refreshFixtureOverviewDirectory=()=>{};refreshMatchOverviewDirectory=()=>{};
   toast=message=>test.toasts.push(String(message));
   const seed={meta:{clubName:'Shooters Hill AFC',teamName:'Example Greens',ageGroup:'U12',season:'2026/27'},division:{name:'Under 12 Example',teamName:'Example Greens'},selkent:{enabled:false,fixtures:[{date:'2099-10-18',opponent:'Future Example',venue:'H',competition:'League'}],fixtureOverrides:{}},tactics:{matchdaySelections:{retained:['p1']}},squad:[{name:'Example Child',number:1}],matches:[{id:'fictional-match',date:'2026-10-15',opponent:'Example United',competition:'Friendly',source,status:'played',gf:3,ga:2,venue:'H'},{id:'unrelated-match',date:'2026-10-14',opponent:'Other Example',competition:'Friendly',source:'manual',status:'played',gf:1,ga:1,venue:'A'}],goals:[{id:'fictional-goal',matchId:'fictional-match',player:'Example Child',goals:3}],assists:[{id:'fictional-assist',matchId:'fictional-match',player:'Example Child',assists:1}],bookings:[],awards:[]};
   state=normalizeState(saved?.state||seed);test.server=copy(state);
   if(saved){test.attendance=copy(saved.attendance);test.note=saved.note;}
   renderAll();navigate('matches',false);
  },{theme,clearIntent,saved,source});
  await page.evaluate(()=>document.fonts.ready);
 }
 async function open(){await page.evaluate(()=>openMatchDetails('fictional-match'));await page.waitForFunction(()=>__matchAttendanceLoaded&&__matchNoteLoaded);}
 async function begin(action){await open();await page.locator(action==='undo'?'#undo-match-played':'#delete-match-detail').click();}
 async function outcome(pattern){await page.waitForFunction(source=>!matchActionIsPending()&&document.getElementById('match-detail-dialog').open&&new RegExp(source,'i').test(document.getElementById('match-action-outcome')?.innerText||''),pattern);}
 async function complete(action){await page.waitForFunction(action=>!matchActionIsPending()&&!document.getElementById('match-detail-dialog').open&&__actionCase.toasts.some(text=>action==='undo'?/returned to Scheduled/.test(text):/Match removed/.test(text)),action);assert.equal(await page.locator('#match-action-notice').isVisible(),false,'completed intent leaves no attention notice');}
 async function snapshot(){return page.evaluate(()=>({local:state.matches.find(m=>m.id==='fictional-match')?.status||'removed',server:__actionCase.server.matches.find(m=>m.id==='fictional-match')?.status||'removed',calls:__actionCase.calls,stateWrites:__actionCase.stateWrites,attendanceWrites:__actionCase.attendanceWrites,noteWrites:__actionCase.noteWrites,queued:__actionCase.queued.length,toasts:__actionCase.toasts}));}
 async function capture(name){await page.screenshot({path:path.join(out,name+'.png')});}
 const measurements=[];
 async function inspectLayout(name){
  const measured=await panel().evaluate(element=>({overflow:element.scrollWidth>element.clientWidth+1,buttons:[...element.querySelectorAll('button')].filter(n=>n.getBoundingClientRect().height).map(n=>({height:n.getBoundingClientRect().height,clipped:n.scrollHeight>n.clientHeight+1})),dialogOverflow:element.closest('dialog').scrollWidth>element.closest('dialog').clientWidth+1,viewportOverflow:document.documentElement.scrollWidth>innerWidth+1,focused:document.activeElement===element}));
  assert.equal(measured.overflow,false);assert.equal(measured.dialogOverflow,false);assert.equal(measured.viewportOverflow,false);assert(measured.buttons.every(button=>button.height>=52&&!button.clipped));measurements.push({name,...measured});await capture(name);
 }
 async function text200(){await page.locator('#match-detail-dialog').evaluate(element=>{const sizes=[...element.querySelectorAll('*')].map(n=>[n,parseFloat(getComputedStyle(n).fontSize)]);for(const [n,size] of sizes)n.style.fontSize=(size*2)+'px';element.scrollTo({top:0});});}
 async function keyboardActions(){
  await panel().focus();await page.keyboard.press('Tab');
  const focused=await page.evaluate(()=>{const n=document.activeElement,c=getComputedStyle(n);return {action:n.dataset.matchAction,visible:n.matches(':focus-visible'),outline:c.outlineStyle,shadow:c.boxShadow};});
  assert(['retry','review'].includes(focused.action));assert(focused.visible);assert(focused.outline!=='none'||focused.shadow!=='none','keyboard focus is visible');
  await actionButton('back').scrollIntoViewIfNeeded();const box=await actionButton('back').boundingBox(),size=page.viewportSize();assert(box.y>=0&&box.y+box.height<=size.height+1,'Back remains scroll reachable');
 }
 try{
  for(const theme of ['dark','light'])for(const width of [320,393,1024])for(const action of ['undo','delete']){
   await prepare({width,theme});await page.evaluate(()=>__actionCase.hold='core');await begin(action);await page.waitForFunction(()=>!!__actionCase.release);
   let current=await snapshot();assert.equal(current.local,'played');assert.equal(current.attendanceWrites,0);assert.equal(current.noteWrites,0);assert.equal(current.stateWrites,0);assert.equal(current.queued,0);assert(!current.toasts.some(text=>/returned to scheduled|match deleted|match removed/i.test(text)));
   await page.evaluate(()=>{void startMatchAction('undo','fictional-match');void startMatchAction('delete','fictional-match');});assert.equal((await snapshot()).calls.filter(call=>call.stage==='core').length,1);
   assert.equal(await actionButton('back').count(),0);await page.keyboard.press('Escape');assert(await page.locator('#match-detail-dialog').isVisible());assert.equal(await page.evaluate(()=>window.closeTopDialog()),true,'native Back consumes the request while keeping a pending match action open');assert(await page.locator('#match-detail-dialog').isVisible());
   if(action==='undo')await inspectLayout('pending-'+width+'-'+theme);
   await page.evaluate(()=>{__actionCase.hold='';__actionCase.release();});await complete(action);
   current=await snapshot();assert.equal(current.local,action==='undo'?'scheduled':'removed');assert.equal(current.server,current.local);assert.equal(current.stateWrites,1);assert.equal(current.attendanceWrites,1);assert.equal(current.noteWrites,1);assert.equal(current.queued,0);
   assert.equal(await page.evaluate(()=>state.matches.find(m=>m.id==='unrelated-match').gf),1);assert.deepEqual(await page.evaluate(()=>state.tactics.matchdaySelections.retained),['p1']);
   assert.equal(await page.locator('#match-detail-dialog').isVisible(),false);await capture(action+'-complete-'+width+'-'+theme);
  }
  for(const theme of ['dark','light'])for(const width of [320,393,1024])for(const failed of ['core','attendance','note']){
   await prepare({width,theme});await page.evaluate(failed=>__actionCase[failed==='core'?'failCore':failed==='attendance'?'failAttendance':'failNote']=true,failed);await begin('undo');await outcome(failed==='core'?'Change not confirmed':'Cleanup incomplete');
   assert.equal(await panel().evaluate(element=>document.activeElement===element),true,'settled status receives focus');await inspectLayout(failed+'-failure-'+width+'-'+theme);await keyboardActions();
   await text200();await inspectLayout(failed+'-text200-'+width+'-'+theme);await keyboardActions();await capture(failed+'-text200-controls-'+width+'-'+theme);
   await actionButton('back').click();const resume=page.locator('#match-action-notice [data-match-action="resume"]');assert(await resume.isVisible());assert((await resume.boundingBox()).height>=52);await resume.click();await outcome(failed==='core'?'Change not confirmed':'Cleanup incomplete');assert(await actionButton('retry').isVisible());
  }
  for(const theme of ['dark','light'])for(const stage of ['attendance','note']){
   await prepare({width:393,theme});await page.evaluate(stage=>__actionCase.hold=stage,stage);await begin('undo');await page.waitForFunction(()=>!!__actionCase.release);assert.equal((await snapshot()).local,'scheduled');assert.equal((await snapshot()).stateWrites,1);assert.match(await panel().innerText(),/Confirmed by club/);await inspectLayout(stage+'-pending-393-'+theme);await page.evaluate(()=>{__actionCase.hold='';__actionCase.release();});await complete('undo');
  }
  for(const action of ['undo','delete']){
   await prepare();await open();answers.push(false);await page.locator(action==='undo'?'#undo-match-played':'#delete-match-detail').click();assert.equal((await snapshot()).calls.length,0,'cancel has no mutation');
   await prepare({width:320,theme:'light'});await page.evaluate(()=>__actionCase.failCore=true);await begin(action);await outcome('Change not confirmed');let current=await snapshot();assert.equal(current.local,'played');assert.equal(current.attendanceWrites,0);assert.equal(current.noteWrites,0);await capture(action+'-not-confirmed');
   await page.evaluate(()=>__actionCase.failCore=false);await actionButton('retry').click();await complete(action);assert.equal((await snapshot()).stateWrites,1);
   await prepare();await page.evaluate(()=>__actionCase.loseResponse=true);await begin(action);await outcome('Change not confirmed');assert.equal((await snapshot()).server,action==='undo'?'scheduled':'removed');await actionButton('retry').click();await complete(action);assert.equal((await snapshot()).stateWrites,1,'uncertain completion retries do not rewrite the core');
  }
  for(const failed of ['attendance','note']){
   await prepare({width:320});await page.evaluate(failed=>{__actionCase[failed==='attendance'?'failAttendance':'failNote']=true;},failed);await begin('undo');await outcome('Cleanup incomplete');let before=await snapshot();assert.equal(before.local,'scheduled');assert.equal(before.stateWrites,1);await capture(failed+'-cleanup-incomplete');
   await page.evaluate(()=>{__actionCase.failAttendance=false;__actionCase.failNote=false;});await actionButton('retry').click();await complete('undo');const after=await snapshot();assert.equal(after.stateWrites,1);assert.equal(after.attendanceWrites,1);assert.equal(after.noteWrites,1);assert.equal(after.calls.filter(call=>call.stage==='core').length,2,'cleanup retry revalidates desired current state');
  }
  await prepare();await page.evaluate(()=>__actionCase.failStats=true);await begin('undo');await complete('undo');assert.equal((await snapshot()).attendanceWrites,1,'derived stats refresh does not undo a confirmed attendance clear');
  await prepare();await page.evaluate(()=>__actionCase.conflict=true);await begin('undo');await outcome('Change not confirmed|changed|review latest');assert.equal((await snapshot()).attendanceWrites,0);assert(await actionButton('review').isVisible());
  await page.evaluate(()=>{__actionCase.conflict=false;__actionCase.server.matches.find(m=>m.id==='fictional-match').gf=4;});answers.push(false);await actionButton('review').click();assert.equal((await snapshot()).stateWrites,0,'dismissing explicit review/reconfirm cannot overwrite the newer result');
  if(await actionButton('review').isVisible())await actionButton('review').click();else await actionButton('retry').click();await complete('undo');assert.equal((await snapshot()).stateWrites,1);
  assert(dialogs.some(dialog=>/Reviewing latest club data replaces unsynced changes/.test(dialog.message)));assert.equal(dialogs.filter(dialog=>/Undo match played against/.test(dialog.message)).length,2,'reviewed latest result is explicitly reconfirmed');
  await prepare();await page.evaluate(()=>{__actionCase.failSync=true;state.matches.find(m=>m.id==='unrelated-match').gf=7;});await begin('undo');await outcome('Existing edits need syncing');assert.equal((await snapshot()).attendanceWrites+(await snapshot()).noteWrites,0);answers.push(false);await actionButton('review').click();assert.equal(await page.evaluate(()=>state.matches.find(m=>m.id==='unrelated-match').gf),7,'review cancellation preserves unrelated draft');assert.equal((await snapshot()).calls.filter(call=>call.stage==='review').length,0);await page.evaluate(()=>__actionCase.failSync=false);await actionButton('review').click();await complete('undo');assert.equal(await page.evaluate(()=>state.matches.find(m=>m.id==='unrelated-match').gf),1,'explicitly accepted review uses latest club data');assert.deepEqual(await page.evaluate(()=>__actionCase.reviewOptions),[{discardQueuedChanges:true}]);
  await prepare();await page.evaluate(()=>__actionCase.failNote=true);await begin('delete');await outcome('Cleanup incomplete');await capture('delete-cleanup-incomplete');await actionButton('back').click();assert(await page.locator('#match-action-notice [data-match-action="resume"]').isVisible());
  const saved=await page.evaluate(()=>({state:__actionCase.server,attendance:__actionCase.attendance,note:__actionCase.note}));
  const intents=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('grassrootsHub_match_action_v1:')).map(key=>({key,value:localStorage.getItem(key)})));assert.equal(intents.length,1);assert(!intents[0].value.includes('Example Child'));assert.doesNotMatch(intents[0].value,/"(?:gf|ga|score|goals|assists|expectedMatch)"/);
  await prepare({saved,clearIntent:false});assert.equal(await page.evaluate(()=>state.matches.some(m=>m.id==='fictional-match')),false);await page.locator('#match-action-notice [data-match-action="resume"]').click();await outcome('Cleanup incomplete|removed|deleted');if(await actionButton('retry').isVisible())await actionButton('retry').click();await complete('delete');assert.equal((await snapshot()).stateWrites,0);assert.equal((await snapshot()).noteWrites,1,'reloaded partial deletion can finish guarded cleanup');
  await prepare();await page.evaluate(()=>__actionCase.failCore=true);await begin('undo');await outcome('Change not confirmed');const pendingSaved=await page.evaluate(()=>({state:__actionCase.server,attendance:__actionCase.attendance,note:__actionCase.note}));await actionButton('back').click();await prepare({saved:pendingSaved,clearIntent:false});await page.locator('#match-action-notice [data-match-action="resume"]').click();await outcome('Review latest match');assert.equal((await snapshot()).calls.length,0,'unconfirmed reload cannot blindly replay');answers.push(false);await actionButton('review').click();assert.equal((await snapshot()).calls.length,0);await actionButton('review').click();await complete('undo');assert.equal(dialogs.filter(dialog=>/Undo match played against/.test(dialog.message)).length,1,'reload requires destructive reconfirmation');
  for(const stage of ['core','attendance'])for(const change of ['account','team','capacity','cloud','close']){
   await prepare();await page.evaluate(stage=>__actionCase.hold=stage,stage);await begin('undo');await page.waitForFunction(()=>!!__actionCase.release);
   await page.evaluate(change=>{const t=__actionCase;if(change==='account')t.uid='other-coach';if(change==='team')t.team='other-team';if(change==='capacity'){t.capacity=true;currentRole='parent';}if(change==='cloud')window.ClubHubCloud={...window.ClubHubCloud};if(change==='close')document.getElementById('match-detail-dialog').close();t.hold='';t.release();},change);
   await page.waitForFunction(()=>!matchActionIsPending());assert.equal((await snapshot()).noteWrites,0,'late '+stage+'/'+change+' cannot start private-note cleanup');if(stage==='core')assert.equal((await snapshot()).attendanceWrites,0);assert.doesNotMatch(await page.locator('#match-action-notice').innerText(),/Example Child/);
  }
  await prepare({source:'Selkent'});await open();assert.equal(await page.locator('#delete-match-detail').isVisible(),false);await page.evaluate(()=>deleteMatch('fictional-match'));assert.equal((await snapshot()).calls.length,0,'provider Remove remains denied');
  await prepare();await page.evaluate(()=>Object.defineProperty(window.ClubHubCloud,'testMode',{configurable:true,get:()=>true}));await begin('undo');await complete('undo');assert.equal((await snapshot()).calls.length,0);assert.match((await snapshot()).toasts.at(-1),/on this device$/,'demo success describes device completion');
  assert.deepEqual(errors,[]);assert.deepEqual(externalWrites,[]);
  for(const name of ['failed-state.json','failed-check.png'])fs.rmSync(path.join(out,name),{force:true});
  const artifactSha256=Object.fromEntries(['app.js','cloud.js','index.html','app-design-system.css'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')]));
  fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({status:'PASS',fictional_data_only:true,viewports:[320,393,1024],themes:['dark','light'],text_scale_percent:[100,200],artifact_sha256:artifactSha256,measurements,errors,external_writes:externalWrites},null,2));
  console.log('PASS built Undo/Remove: confirmed core before cleanup, truthful failures/partials/retries, explicit conflict review, duplicate/context guards, resume after deletion/reload, provider protection, both themes/phone/wider/200% text; fictional data only.');
 }catch(error){fs.writeFileSync(path.join(out,'failed-state.json'),JSON.stringify({errors,dialogs,snapshot:await snapshot().catch(()=>null),dom:await page.evaluate(()=>({pending:typeof matchActionIsPending==='function'&&matchActionIsPending(),busy:typeof __matchReportSaveBusy!=='undefined'&&__matchReportSaveBusy,open:document.getElementById('match-detail-dialog')?.open,outcome:document.getElementById('match-action-outcome')?.innerText}))},null,2));await page.screenshot({path:path.join(out,'failed-check.png'),fullPage:true});throw error;}
 finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
module.exports={run};
if(require.main===module)run().catch(error=>{console.error(error);server.close();process.exitCode=1;});
