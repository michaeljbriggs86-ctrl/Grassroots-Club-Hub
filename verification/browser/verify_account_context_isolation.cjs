// Run the actual built app/cloud lifecycle against fictional HTTP services only.
// No bootstrap, cloud API, getters, permission functions, or UI are replaced.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'account-context-isolation-review');
fs.mkdirSync(out,{recursive:true});
const sessionKey='grassroots_hub_cloud_session_v1',stateKey='grassrootsHub_team_state_v1',cachePrefix='grassroots_hub_team_state_cache_v1_';
// Finite independent source inventory: real private outputs/selects, plus three
// obsolete JS references recorded absent rather than invented in the built UI.
const privateDomIds=['parent-home-family-list','parent-family-linked-list','team-members-list','coach-match-note','coach-note-readonly','matchday-dashboard-note-input','matchday-dashboard-note-readonly','person-profile-body','reviewer-retained-thread','reviewer-dispute-list','season-archive-body','season-archive-title','season-history-summary','audit-history-list','detail-goals-inputs','detail-assists-inputs','detail-award-fields','match-detail-summary','match-report-outcome','club-match-summary-body','parent-request-review-parent','parent-request-review-email','parent-request-review-child','parent-link-title','app-confirm-body','app-confirm-detail','club-coaches-list','access-summary','cloud-account-controls','tactics-bench','matchday-squad-options','matchday-dashboard-squad','matchday-dashboard-formation','matchday-dashboard-alert','season-player-stats-body','top-scorers','award-leaders','match-entry-choices','inbox-contact-select','assign-coach-person','compliance-primary-user','compliance-backup-user','availability-player','team-player-invite-player','standalone-award-player','season-history-select','safeguarding-export-audit','u11-safeguarding-player','detail-booking-inputs'];
const team=(id,age,name)=>({id,club_id:'fictional-club',name,age_group:age,division:'Example division',season:'2026/27',selkent_label:name,league_name:name,active:true});
const teams=[team('fictional-u12-a',12,'Example Greens'),team('fictional-u12-b',12,'Example Whites'),team('fictional-u15',15,'Example U15'),team('fictional-u9',9,'Example U9')];
const clone=value=>JSON.parse(JSON.stringify(value));
function makeActor(key,role='coach',age=12){return {key,role,realRole:role,teamId:teams.find(t=>t.age_group===age).id,capacity:false,hasChildren:true,user:{id:'fictional-'+key,email:key+'@example.invalid',user_metadata:{}}};}
function actorSession(actor,version='v1'){return {access_token:'fictional-'+actor.key+'-'+version,refresh_token:'fictional-'+actor.key+'-refresh-'+version,expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:clone(actor.user)};}
function actorContext(actor){const t=teams.find(t=>t.id===actor.teamId);return {profile:{user_id:actor.contextUser||actor.user.id,club_id:'fictional-club',team_id:t.id,full_name:'Fictional '+actor.key,role:actor.capacity?'parent':actor.role,access_method:actor.role==='player'?'player_code':'email',pin_set_at:'2026-10-01T00:00:00Z'},team:t,club:{id:'fictional-club',name:'Shooters Hill AFC'},real_role:actor.realRole,acting_as_parent:actor.capacity,has_children:actor.hasChildren};}
function projectedState(actor,teamId=actor.teamId,variant='fresh'){
 const t=teams.find(t=>t.id===teamId),parent=actor.capacity||['parent','player'].includes(actor.role),marker=(parent?'PROJECTED_':'STAFF_')+actor.key.toUpperCase()+'_'+variant.toUpperCase();
 return {meta:{clubName:'Shooters Hill AFC',teamName:t.name,ageGroup:'U'+t.age_group,season:t.season},division:{name:t.division,teamName:t.name},selkent:{enabled:false,fixtures:variant==='first-paint'?[{date:new Date().toISOString().slice(0,10),opponent:'Fictional Today Opponent',venue:'H',competition:'Friendly',time:'23:00',ground:'Example Ground'}]:[],fixtureOverrides:{}},squad:[{name:marker+'_EXAMPLE',number:7}],matches:[{id:marker+'-match',date:'2026-10-04',opponent:marker+'_OPPONENT',venue:'H',competition:'Friendly',status:'played',source:'manual',gf:2,ga:1}],tournaments:[{id:marker+'-event',name:marker+'_EVENT',date:'2026-11-01',location:'Example Ground',format:'round_robin',playerNames:[]}],goals:[],assists:[],bookings:[],awards:[]};
}
const server=http.createServer((request,response)=>{
 const pathname=new URL(request.url,'http://localhost').pathname;
 if(pathname==='/cloud-config.js'){response.setHeader('Content-Type','text/javascript');return response.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://fictional.supabase.co",anonKey:"fictional-only-no-credentials-00000000000000000000000000"};');}
 if(pathname.startsWith('/data/')){response.setHeader('Content-Type','application/json');return response.end('{"schema_version":2,"provider":"Selkent","last_updated":"2026-10-17T00:00:00Z","clubs":[],"age_groups":[]}');}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);return response.end();}
 response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(response);
});
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PITCHKIND_CHROMIUM?{executablePath:process.env.PITCHKIND_CHROMIUM}:{}),args:['--no-sandbox']});
 const errors=[],externalWrites=[],externalRequests=[],cases=[],measurements=[],contexts=[],privacyDom=[];
 async function fixture({initial='coach-a',role='coach',age=12,width=393,theme='dark',seed={},callback='',variant='fresh'}={}){
  const actors={};for(const [key,r,a] of [['coach-a','coach',12],['parent-b','parent',12],['admin-a','club_admin',12],['player15','player',15],['player9','player',9],['pending-parent','pending_parent',12],['pending-coach','pending_coach',12],['revoked','revoked',12],['unknown','invented_role',12]])actors[key]=makeActor(key,r,a);
  if(initial&&actors[initial]){actors[initial].role=role;actors[initial].realRole=role;actors[initial].teamId=teams.find(t=>t.age_group===age).id;}
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});contexts.push(context);const page=await context.newPage(),calls=[],holds=[],pending=[],mockWrites=[];
  const f={context,page,actors,calls,holds,pending,mockWrites,userFailures:new Set(),rowFailure:false,rowMissing:false,revision:10,variant,configRole:null};
  page.on('pageerror',error=>errors.push({fixture:initial,message:String(error)}));
  await context.addInitScript(({initialSession,seed,theme})=>{if(window!==window.top||!/^https?:$/.test(location.protocol))return;if(!sessionStorage.getItem('__fictional_initial_seed')){localStorage.clear();if(initialSession)localStorage.setItem('grassroots_hub_cloud_session_v1',JSON.stringify(initialSession));for(const [key,value] of Object.entries(seed))localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value));localStorage.setItem('grassrootsHub_theme_v1',theme);sessionStorage.setItem('__fictional_initial_seed','1');}},{initialSession:initial?actorSession(actors[initial]):null,seed,theme});
  await context.addInitScript(()=>{if(window!==window.top||!/^https?:$/.test(location.protocol))return;window.__firstAcceptedPaint=null;new MutationObserver(()=>{const gate=document.getElementById('activation-gate'),shell=document.querySelector('.app-shell'),cloud=window.ClubHubCloud;if(window.__firstAcceptedPaint||!gate||!shell||!cloud||!gate.classList.contains('hidden')||shell.classList.contains('account-locked')||(!cloud.canEdit()&&!cloud.canAdmin()))return;const available=selector=>{const node=document.querySelector(selector);return !!node&&!node.hidden&&!node.classList.contains('hidden');};window.__firstAcceptedPaint={role:cloud.role(),canEdit:cloud.canEdit(),canAdmin:cloud.canAdmin(),fixtureConfirm:available('#fixture-confirm-details'),fixtureShare:available('#matches-next-share'),matchPlayed:available('#matches-next-played'),training:available('[data-page-route="training-settings"]'),features:available('[data-page-route="feature-settings"]'),onboarding:available('[data-nav="onboarding"]')};}).observe(document,{subtree:true,attributes:true,attributeFilter:['class','hidden'],childList:true});});
  f.hold=(tag,match)=>{let seen;const promise=new Promise(resolve=>seen=resolve);holds.push({tag,match,seen,promise});return promise;};
  f.release=(tag,override)=>{const held=pending.find(row=>row.tag===tag);assert(held,'Expected held request '+tag);held.release(override);};
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());if(url.origin===base)return route.continue();
   if(request.method()==='GET'&&url.hostname==='www.google.com'&&url.pathname==='/maps')return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><body>Fictional venue map</body>'});
   if(url.hostname!=='fictional.supabase.co'){externalRequests.push({method:request.method(),url:request.url()});if(request.method()!=='GET')externalWrites.push({method:request.method(),url:request.url()});return route.abort();}
   let args={};try{args=JSON.parse(request.postData()||'{}');}catch{}
   const token=(request.headers().authorization||'').replace(/^Bearer /,''),actor=Object.values(actors).find(row=>token.startsWith('fictional-'+row.key+'-'));
   const call={path:url.pathname,name:url.pathname.split('/').pop(),method:request.method(),token,actor:actor?.key,args};calls.push(call);if(request.method()!=='GET')mockWrites.push(call);
   let body=[],status=200;
   if(url.pathname==='/auth/v1/token'){
    const next=Object.values(actors).find(row=>row.user.email===args.email||args.refresh_token?.startsWith('fictional-'+row.key+'-refresh-'));
    if(next)body=actorSession(next,'v2');else{status=400;body={message:'Invalid login credentials'};}
   }else if(url.pathname==='/auth/v1/user'){
    if(!actor||f.userFailures.has(actor.key)){status=401;body={message:'Fictional callback rejected'};}else body=clone(actor.user);
   }else if(url.pathname==='/rest/v1/teams')body=clone(teams.filter(t=>actor?.role!=='parent'||[actor.teamId,'fictional-u12-b'].includes(t.id)));
   else if(call.name==='get_my_context')body=actor?actorContext(actor):null;
   else if(call.name==='get_my_club_configuration')body={club:{id:'fictional-club',name:'Shooters Hill AFC'},settings:{slug:'fictional-club',display_name:'Shooters Hill AFC',short_name:'Shooters Hill',primary_color:'#0b5d35',secondary_color:'#ffffff',accent_color:'#165c4d',default_provider_key:'manual',results_publish_from_age:12,player_account_age_groups:[15]},teams:clone(teams),rules:[],providers:[]};
   else if(call.name==='get_team_state_for_me'){
    if(f.rowFailure){status=503;body={message:'Fictional projected data unavailable'};}
    else body=f.rowMissing?null:{team_id:args.p_team_id,state:projectedState(actor,args.p_team_id,f.variant),restricted:(actor.capacity||['parent','player'].includes(actor.role))&&Number(teams.find(t=>t.id===args.p_team_id)?.age_group)<=11,revision:f.revision,updated_at:'2026-10-17T12:00:00Z'};
   }else if(call.name==='list_login_clubs')body=[{slug:'fictional-club',display_name:'Shooters Hill AFC'}];
   else if(call.name==='list_login_teams')body=clone(teams);
   else if(call.name==='get_club_compliance_status')body={};
   else if(call.name==='get_kickoff_push_settings')body={available:false};
   else if(call.name==='set_my_capacity'){actor.capacity=!!args.p_parent;body={ok:true};}
   else if(call.name==='switch_my_active_team'){actor.teamId=args.p_team_id;body={ok:true};}
   const holdIndex=holds.findIndex(row=>row.match(call));
   if(holdIndex>=0){const hold=holds.splice(holdIndex,1)[0];const override=await new Promise(resolve=>{pending.push({tag:hold.tag,call,release:resolve});hold.seen(call);});if(override){if('body'in override)body=override.body;if('status'in override)status=override.status;}}
   try{await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});}catch(error){if(!page.isClosed()&&!/closed|disposed|canceled/i.test(error.message))throw error;}
  });
  f.go=async(suffix='')=>{await page.goto(base+'/'+suffix);await page.waitForFunction(()=>typeof bootTracker==='function'&&window.ClubHubCloud);};
  f.ready=async()=>{try{await page.waitForFunction(()=>!__booting&&document.querySelector('.app-shell')&&!document.querySelector('.app-shell').classList.contains('account-locked')&&document.getElementById('activation-gate').classList.contains('hidden'));await page.evaluate(()=>document.fonts.ready);}catch(error){console.error('Fictional ready-state diagnostic',await page.evaluate(()=>({booting:__booting,mode:document.getElementById('activation-gate').dataset.authMode,gate:document.getElementById('activation-gate').innerText,role:ClubHubCloud.role(),team:ClubHubCloud.currentTeam()?.id,revision:ClubHubCloud.revision})));throw error;}};
  f.callback=(key,type='recovery',version='v2')=>base+'/#access_token='+actorSession(actors[key],version).access_token+'&refresh_token='+actorSession(actors[key],version).refresh_token+'&expires_in=3600&type='+type;
  f.callbackStart=async(uri)=>page.evaluate(uri=>{window.__callbackResult=window.ClubHubCloud.handleAuthCallback(uri,{duringBootstrap:true});},uri);
  f.callbackDone=()=>page.evaluate(()=>window.__callbackResult);
  f.boot=()=>page.evaluate(()=>bootTracker());
  f.close=async()=>{for(const row of pending)row.release();await context.close();};
  if(callback)await f.go('?auth_callback='+encodeURIComponent(callback));else await f.go();
  return f;
 }
 async function locked(page){const s=await page.evaluate(()=>({gate:!document.getElementById('activation-gate').classList.contains('hidden'),shell:document.querySelector('.app-shell').classList.contains('account-locked'),display:getComputedStyle(document.querySelector('.app-shell')).display,canEdit:ClubHubCloud.canEdit(),canAdmin:ClubHubCloud.canAdmin(),openDialogs:[...document.querySelectorAll('dialog[open]')].map(dialog=>dialog.id)}));assert(s.gate&&s.shell&&s.display==='none','Private app stays locked behind auth gate: '+JSON.stringify(s));assert(!s.canEdit&&!s.canAdmin,'Locked access cannot edit/admin: '+JSON.stringify(s));assert.deepEqual(s.openDialogs,[],'Private native dialogs close before auth gate');return s;}
 async function openPrivateDialog(page,dirty=false){await page.evaluate(()=>{document.getElementById('app-splash')?.remove();document.body.classList.remove('splash-active');});await page.locator('[data-nav="matches"]:visible,[data-mobile-target="matches"]:visible').first().click();await page.locator('[data-scroll-to="tournament-events-section"]').click();assert(await page.locator('#create-tournament').isVisible());assert(await page.locator('#create-tournament').isEnabled());await page.locator('#create-tournament').click();assert(await page.locator('#tournament-dialog').isVisible());if(dirty)await page.locator('#tournament-name').fill('COMPATIBLE_FICTIONAL_DRAFT');}
 async function snapshot(page){return page.evaluate(()=>{const cacheValue=key=>{const raw=localStorage.getItem(key);try{const row=JSON.parse(raw);delete row.savedAt;return JSON.stringify(row);}catch{return raw;}};return {uid:ClubHubCloud.session?.user?.id,role:ClubHubCloud.role(),team:ClubHubCloud.currentTeam()?.id,revision:ClubHubCloud.revision,state:JSON.stringify(state),stored:localStorage.getItem('grassrootsHub_team_state_v1'),caches:Object.fromEntries(Object.keys(localStorage).filter(key=>key.startsWith('grassroots_hub_team_state_cache_v1_')).map(key=>[key,cacheValue(key)])),intents:Object.fromEntries(Object.keys(localStorage).filter(key=>key.startsWith('grassrootsHub_tournament_action_v1:')).map(key=>[key,localStorage.getItem(key)])),gate:document.getElementById('activation-gate').dataset.authMode,locked:document.querySelector('.app-shell').classList.contains('account-locked')};});}
 async function signin(f,key,atomic=false){if(atomic)return f.page.evaluate(({email,password})=>{document.getElementById('cloud-email').value=email;document.getElementById('cloud-password').value=password;document.getElementById('cloud-signin-form').requestSubmit();},{email:f.actors[key].user.email,password:'Fictional-password-123!'});await f.page.locator('#cloud-email').fill(f.actors[key].user.email);await f.page.locator('#cloud-password').fill('Fictional-password-123!');await f.page.locator('#cloud-auth-submit').click();}
 async function capture(f,name,scale=100){
  const {page}=f;await page.evaluate(()=>{document.getElementById('app-splash')?.remove();document.body.classList.remove('splash-active');});
  if(scale===200)await page.locator('#activation-gate').evaluate(element=>{const sizes=[...element.querySelectorAll('*')].map(node=>[node,parseFloat(getComputedStyle(node).fontSize)]);for(const [node,size] of sizes)if(size)node.style.fontSize=(size*2)+'px';});
  await page.evaluate(()=>document.fonts.ready);await page.locator('#activation-gate').evaluate(el=>el.scrollTo({top:0}));
  const result=await page.locator('#activation-gate').evaluate(element=>({viewportOverflow:document.documentElement.scrollWidth>innerWidth+1,localOverflow:element.scrollWidth>element.clientWidth+1,buttons:[...element.querySelectorAll('button')].filter(n=>n.getClientRects().length).map(n=>({text:n.textContent.trim(),height:n.getBoundingClientRect().height,clipped:n.scrollHeight>n.clientHeight+1})),headings:[...element.querySelectorAll('h1,h2')].filter(n=>n.getClientRects().length).map(n=>({text:n.textContent.trim(),clipped:n.scrollWidth>n.clientWidth+1})),mode:element.dataset.authMode}));
  assert(!result.viewportOverflow&&!result.localOverflow,name+' reflows without horizontal overflow');assert(result.buttons.every(row=>row.height>=44&&!row.clipped),name+' actions readable and touch sized');assert(result.headings.every(row=>!row.clipped),name+' headings fit');measurements.push({name,scale,...result});await page.screenshot({path:path.join(out,name+'.png')});
  if(scale===200){const action=page.locator('#activation-gate button:visible').last();if(await action.count()){await action.scrollIntoViewIfNeeded();const box=await action.boundingBox();assert(box.y>=0&&box.y+box.height<=page.viewportSize().height+1,name+' final action stays reachable by scrolling');await page.screenshot({path:path.join(out,name+'-actions.png')});}}
 }
 try{
  for(const [initial,role] of [['coach-a','coach'],['admin-a','club_admin']]){
   const f=await fixture({initial,role,variant:'first-paint'});await f.ready();const paint=await f.page.evaluate(()=>window.__firstAcceptedPaint);assert(paint,'Accepted first paint was observed before any timer/feed rerender');if(role==='coach'){assert(paint.canEdit&&paint.fixtureConfirm&&paint.fixtureShare&&paint.matchPlayed&&paint.training&&paint.features,'Coach affordances exist on first accepted paint: '+JSON.stringify(paint));await openPrivateDialog(f.page);}else assert(paint.canAdmin&&paint.onboarding,'Admin onboarding is available on first accepted paint');cases.push('first-accepted-paint-'+role);await f.close();
  }
  // Recovery validates B before discarding A, then waits for B's actual projected
  // row and actual app render. Same-team cache cannot stand in for that row.
  for(const theme of ['dark','light'])for(const width of [320,393,1024]){
   const f=await fixture({theme,width});await f.ready();assert.match((await snapshot(f.page)).state,/STAFF_COACH-A_FRESH/);
   await openPrivateDialog(f.page,true);const original=await snapshot(f.page);assert(Object.values(original.intents).some(value=>value.includes('COMPATIBLE_FICTIONAL_DRAFT')),'Real editor input persists a compatible Save draft');f.userFailures.add('parent-b');const rejected=f.hold('reject-check',c=>c.path==='/auth/v1/user'&&c.actor==='parent-b');await f.callbackStart(f.callback('parent-b'));await rejected;await locked(f.page);f.release('reject-check');assert.equal(await f.callbackDone(),'error');await locked(f.page);assert.equal((await snapshot(f.page)).uid,original.uid);assert.deepEqual((await snapshot(f.page)).caches,original.caches);assert.deepEqual((await snapshot(f.page)).intents,original.intents);await capture(f,'callback-failed-'+width+'-'+theme);await capture(f,'callback-failed-'+width+'-'+theme+'-200',200);cases.push('rejected-callback-preserves-compatible-login-draft-closes-private-dialog-'+width+'-'+theme);f.userFailures.delete('parent-b');
   const verifying=f.hold('verify-parent',c=>c.path==='/auth/v1/user'&&c.actor==='parent-b');await f.callbackStart(f.callback('parent-b'));await verifying;await locked(f.page);
   await capture(f,'callback-checking-'+width+'-'+theme);f.release('verify-parent');assert.equal(await f.callbackDone(),'recovery');await locked(f.page);assert.equal((await snapshot(f.page)).uid,'fictional-parent-b');
   assert(!Object.values((await snapshot(f.page)).caches).some(value=>value.includes('STAFF_COACH-A')),'Verified identity change evicts staff cache');assert.equal(Object.keys((await snapshot(f.page)).intents).length,0,'Verified different identity evicts private Save candidate');
   for(const scale of [100,200]){if(scale===200)await capture(f,'recovery-'+width+'-'+theme+'-200',scale);else await capture(f,'recovery-'+width+'-'+theme,scale);}
   await f.page.locator('#cloud-new-password').fill('Fictional-new-password-123!');await f.page.locator('#cloud-new-password2').fill('Fictional-new-password-123!');
   const projected=f.hold('parent-projected',c=>c.name==='get_team_state_for_me'&&c.actor==='parent-b');await f.page.locator('#cloud-password-save').click();await projected;await locked(f.page);assert(!await f.page.locator('.app-shell').isVisible());
   f.release('parent-projected');await f.ready();const s=await snapshot(f.page);assert.equal(s.role,'parent');assert.match(s.state,/PROJECTED_PARENT-B_FRESH/);assert.doesNotMatch(s.state,/STAFF_COACH-A/);assert.equal(Object.keys(s.caches).length,0);assert.equal(s.stored,null,'Parent projected state is not persisted in the global app cache');cases.push('recovery-parent-projection-'+width+'-'+theme);await f.close();
  }
  // Error and missing projected state must never unlock or seed old staff data.
  for(const missing of [false,true]){
   const f=await fixture();await f.ready();await f.callbackStart(f.callback('parent-b'));await f.callbackDone();f.rowFailure=!missing;f.rowMissing=missing;
   await f.boot();await locked(f.page);assert.match(await f.page.locator('#activation-gate').innerText(),/unavailable|could not|couldn.t|sign in|try again|information/i);assert.equal(Object.keys((await snapshot(f.page)).caches).length,0);cases.push(missing?'missing-parent-projection-gated':'failed-parent-projection-gated');await f.close();
  }
  for(const rejected of [false,true]){
   const callback=base+'/#access_token=fictional-parent-b-'+(rejected?'rejected':'v2')+'&refresh_token=fictional-parent-b-refresh-v2&type=recovery&expires_in=3600';
   // Rejection uses an unrecognised bearer so the actual validation request is
   // rejected before a session can be installed.
   const f=await fixture({callback:rejected?callback.replace('fictional-parent-b-rejected','unrecognised-fictional-bearer'):callback});await f.page.waitForFunction(()=>!__booting);await locked(f.page);const s=await snapshot(f.page);if(rejected){assert(!s.uid||s.uid==='fictional-coach-a','Rejected initial candidate never installs B');assert.equal(await f.page.evaluate(key=>JSON.parse(localStorage.getItem(key)).user.id,sessionKey),'fictional-coach-a','Compatible stored A survives rejected startup callback');}else assert.equal(s.uid,'fictional-parent-b');assert.equal(s.gate==='newpassword',!rejected);assert.equal(f.calls.filter(c=>c.name==='get_team_state_for_me').length,0);assert(!/access_token|auth_callback/.test(f.page.url()),'Callback credentials removed from visible URL');cases.push(rejected?'initial-rejected-callback-gated':'initial-verified-recovery-callback');await f.close();
  }
  for(const transition of ['verified-callback','cross-tab']){
   const f=await fixture({initial:'admin-a',role:'club_admin'});await f.ready();const marker='FICTIONAL_OLD_PRIVATE_DOM_MARKER';
   // These existing private containers represent already-rendered account data;
   // seed only their fictional contents, keeping actual handlers/API untouched.
   const seeded=await f.page.evaluate(({marker,ids})=>{const present=ids.filter(id=>{const node=document.getElementById(id);if(!node)return false;if(node.tagName==='SELECT'){const option=document.createElement('option');option.value=marker;option.textContent=marker;node.appendChild(option);node.value=marker;}else if('value'in node){node.defaultValue=marker;node.value=marker;}else{const child=document.createElement('span');child.textContent=marker;child.dataset.privateMarker=marker;node.appendChild(child);}return true;});const childName=document.getElementById('parent-add-child-name');childName.defaultValue=marker;childName.setAttribute('value',marker);childName.value=marker;const pitch=document.getElementById('tactics-pitch'),player=document.createElement('span');player.className='tactics-player';player.dataset.privateMarker=marker;player.textContent=marker;pitch.appendChild(player);return {present,notPresent:ids.filter(id=>!present.includes(id)),pitchStaticChildren:[...pitch.children].filter(node=>!node.classList.contains('tactics-player')).length};},{marker,ids:privateDomIds});assert.equal(seeded.present.length,46);privacyDom.push({transition,...seeded});
   if(transition==='verified-callback'){await f.callbackStart(f.callback('parent-b','signup'));await f.callbackDone();}
   else await f.page.evaluate(({key,value})=>{const oldValue=localStorage.getItem(key);localStorage.setItem(key,value);window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue:value,storageArea:localStorage,url:location.href}));},{key:sessionKey,value:JSON.stringify(actorSession(f.actors['parent-b']))});
   const oldDom=await f.page.evaluate(({marker,ids})=>({text:document.body.textContent+'\n'+[...document.querySelectorAll('input,textarea')].map(node=>node.value).join('\n'),html:document.body.innerHTML,retained:[...ids,'parent-add-child-name','tactics-pitch'].filter(id=>{const node=document.getElementById(id);return node&&(node.outerHTML.includes(marker)||String(node.value||'').includes(marker));}),pitchStaticChildren:[...document.getElementById('tactics-pitch').children].filter(node=>!node.classList.contains('tactics-player')).length}),{marker,ids:privateDomIds});assert(!oldDom.text.includes(marker)&&!oldDom.html.includes(marker),'Verified account eviction removes private text/defaults/attributes from hidden DOM: '+oldDom.retained.join(', '));assert.equal(oldDom.pitchStaticChildren,seeded.pitchStaticChildren,'Clearing dynamic private pitch players preserves static pitch structure');cases.push('private-hidden-dom-evicted-'+transition);await f.close();
  }
  // A late staff read cannot alter another accepted account's state/revision.
  for(const returnToA of [false,true]){
   const f=await fixture();await f.ready();const held=f.hold('old-pull',c=>c.name==='get_team_state_for_me'&&c.actor==='coach-a');await f.page.evaluate(()=>{window.__oldPull=ClubHubCloud.pullLatest();});await held;
   await f.callbackStart(f.callback('parent-b','signup'));await f.callbackDone();await f.boot();await f.ready();
   if(returnToA){f.revision=22;f.variant='new-generation';await f.callbackStart(f.callback('coach-a','signup','v3'));await f.callbackDone();await f.boot();await f.ready();}
   const before=await snapshot(f.page);f.release('old-pull',{body:{team_id:teams[0].id,state:projectedState(f.actors['coach-a'],teams[0].id,'obsolete'),restricted:false,revision:999,updated_at:'2026-10-17T13:00:00Z'}});await f.page.evaluate(()=>window.__oldPull);const after=await snapshot(f.page);
   assert.equal(after.uid,before.uid);assert.equal(after.revision,before.revision);assert.equal(after.state,before.state);assert.deepEqual(after.caches,before.caches);assert.equal(after.stored,before.stored);cases.push(returnToA?'same-team-account-a-b-a-stale-generation':'cross-account-delayed-read');await f.close();
  }
  // Exercise genuine staff owner-cache branch, then supersede its refresh.
  {
   const f=await fixture({initial:'admin-a',role:'club_admin'});await f.ready();await f.page.evaluate(()=>ClubHubCloud.switchAdminTeam('fictional-u12-b'));await f.page.evaluate(()=>ClubHubCloud.switchAdminTeam('fictional-u12-a'));
   await f.page.evaluate(()=>ClubHubCloud.switchAdminTeam('fictional-u12-b'));const held=f.hold('cache-refresh',c=>c.name==='get_team_state_for_me'&&c.args.p_team_id==='fictional-u12-a');await f.page.evaluate(()=>ClubHubCloud.switchAdminTeam('fictional-u12-a'));await held;
   await f.page.evaluate(()=>ClubHubCloud.switchAdminTeam('fictional-u12-b'));const before=await snapshot(f.page);f.release('cache-refresh',{body:{team_id:teams[0].id,state:projectedState(f.actors['admin-a'],teams[0].id,'obsolete'),restricted:false,revision:999,updated_at:'2026-10-17T13:00:00Z'}});await f.page.waitForFunction(()=>ClubHubCloud.currentTeam().id==='fictional-u12-b');await f.page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,40)));const after=await snapshot(f.page);assert.equal(after.revision,before.revision);assert.equal(after.state,before.state);assert.deepEqual(after.caches,before.caches);cases.push('staff-owner-cache-superseded-refresh');await f.close();
  }
  // Invalid links preserve a compatible verified login, behind a locked gate;
  // rejected candidates are never installed and cannot open password editing.
  for(const kind of ['rejected-user','missing-refresh','error','malformed']){
   const f=await fixture();await f.ready();const before=await snapshot(f.page);if(kind==='rejected-user')f.userFailures.add('parent-b');
   const uri=kind==='rejected-user'?f.callback('parent-b'):kind==='missing-refresh'?base+'/#access_token=fictional-parent-b-v2&type=recovery':kind==='error'?base+'/#error=access_denied&error_description=Fictional+expired+link':'not a callback URL';
   await f.callbackStart(uri);await f.callbackDone();await locked(f.page);const after=await snapshot(f.page);assert.equal(after.uid,before.uid);assert.notEqual(after.gate,'newpassword');assert.deepEqual(after.caches,before.caches);cases.push('callback-'+kind+'-gated-preserved');await f.close();
  }
  {
   const f=await fixture();await f.ready();await openPrivateDialog(f.page,true);const before=await snapshot(f.page);await f.callbackStart(f.callback('coach-a'));assert.equal(await f.callbackDone(),'recovery');await locked(f.page);const after=await snapshot(f.page);assert.equal(after.uid,before.uid);assert.deepEqual(after.caches,before.caches);assert.deepEqual(after.intents,before.intents);assert.equal(after.stored,before.stored);cases.push('same-user-recovery-preserves-compatible-draft');await f.close();
  }
  // Logout clears and locks before stalled browser push cleanup or logout HTTP.
  for(const stage of ['push','logout']){
   const f=await fixture();await f.ready();await openPrivateDialog(f.page);let waiting;
   if(stage==='push')await f.page.evaluate(()=>{Object.defineProperty(navigator.serviceWorker,'getRegistration',{configurable:true,value:()=>new Promise(resolve=>{window.__releasePush=()=>resolve({pushManager:{getSubscription:async()=>({endpoint:'https://push.example.invalid/fictional-a',unsubscribe:async()=>true})}});})});});
   else waiting=f.hold('logout-http',c=>c.path==='/auth/v1/logout');
   await f.page.evaluate(()=>{window.__logout=ClubHubCloud.signOut();});await locked(f.page);const s=await snapshot(f.page);assert(!s.uid);assert.equal(Object.keys(s.caches).length,0);assert(!s.stored);cases.push('logout-immediate-lock-'+stage);
   if(stage==='push'){await f.page.waitForFunction(()=>typeof __releasePush==='function');await f.page.evaluate(()=>__releasePush());}else{await waiting;f.release('logout-http');}
   await f.close();
  }
  // An old cleanup may finish after the next sign-in, using only A's bearer.
  {
   const f=await fixture();await f.ready();const waiting=f.hold('old-logout',c=>c.path==='/auth/v1/logout');await f.page.evaluate(()=>{window.__logout=ClubHubCloud.signOut();});await waiting;await signin(f,'parent-b',true);await f.ready();const before=await snapshot(f.page);f.release('old-logout');await f.page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,250)));const after=await snapshot(f.page);assert.equal(after.uid,'fictional-parent-b');assert.equal(after.state,before.state);assert(!after.locked);assert(f.calls.filter(c=>c.path==='/auth/v1/logout').every(c=>c.actor==='coach-a'));cases.push('old-logout-cannot-clear-new-signin');await f.close();
  }
  // Cross-tab logout or a different stored account must immediately fence old UI.
  for(const next of ['logout','parent-b','same-user']){
   const f=await fixture();await f.ready();if(next!=='same-user')await openPrivateDialog(f.page);const before=await snapshot(f.page);const nextSession=next==='logout'?null:actorSession(f.actors[next==='same-user'?'coach-a':next],'cross-tab');
   await f.page.evaluate(({key,value})=>{const oldValue=localStorage.getItem(key);if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue:value,storageArea:localStorage,url:location.href}));},{key:sessionKey,value:nextSession?JSON.stringify(nextSession):null});
   if(next==='same-user'){const after=await snapshot(f.page);assert.equal(after.uid,before.uid);assert(!after.locked);assert.deepEqual(after.caches,before.caches);}
   else{await locked(f.page);const s=await snapshot(f.page);assert.equal(Object.keys(s.caches).length,0);assert(!s.stored);if(nextSession)assert.equal(await f.page.evaluate(key=>JSON.parse(localStorage.getItem(key)).user.id,sessionKey),nextSession.user.id);}
   cases.push('cross-tab-'+next);await f.close();
  }
  {
   const f=await fixture({initial:'admin-a',role:'club_admin'});await f.ready();const before=await snapshot(f.page);
   await f.page.evaluate(({key,oldValue,newValue})=>window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue,storageArea:localStorage,url:location.href})),{key:sessionKey,oldValue:JSON.stringify(actorSession(f.actors['coach-a'])),newValue:JSON.stringify(actorSession(f.actors['parent-b']))});
   const after=await snapshot(f.page);assert.equal(after.uid,before.uid);assert.equal(after.state,before.state);assert.equal(after.revision,before.revision);assert.deepEqual(after.caches,before.caches);assert(!after.locked);cases.push('stale-storage-event-canonical-third-session-wins');await f.close();
  }
  // Parent sign-in, approval, revocation and player age checks use real bootstrap.
  for(const [key,role,age,accepted] of [['parent-b','parent',12,true],['pending-parent','pending_parent',12,false],['pending-coach','pending_coach',12,false],['revoked','revoked',12,false],['unknown','invented_role',12,false],['player15','player',15,true],['player9','player',9,false]]){
   const f=await fixture({initial:key,role,age});if(accepted){await f.ready();assert.equal((await snapshot(f.page)).role,role);assert.equal(Object.keys((await snapshot(f.page)).caches).length,0);assert.equal((await snapshot(f.page)).stored,null,'Read-only account has no global persisted projection');}else{await f.page.waitForFunction(()=>!__booting);await locked(f.page);assert.equal(f.calls.filter(c=>c.name==='get_team_state_for_me').length,0);}cases.push('profile-'+key+'-'+(accepted?'accepted':'gated'));await f.close();
  }
  {
   const f=await fixture({initial:null});await f.page.waitForSelector('#cloud-parent-login');await f.page.locator('#cloud-parent-login').click();await signin(f,'coach-a');await f.page.waitForFunction(()=>!document.getElementById('cloud-auth-submit')?.disabled);await locked(f.page);assert.match(await f.page.locator('#cloud-auth-error').innerText(),/approved Parent access/i);assert.equal(f.calls.filter(c=>c.name==='get_team_state_for_me').length,0);cases.push('parent-only-signin-rejects-staff');await f.close();
  }
  // Confirmed capacity changes clear staff projection; pending failure retains
  // the truthful old capacity and does not grant the prospective one.
  {
   const f=await fixture();await f.ready();const hold=f.hold('capacity',c=>c.name==='set_my_capacity');await f.page.evaluate(()=>{window.__capacity=ClubHubCloud.setMyCapacity(true);});await hold;assert.equal((await snapshot(f.page)).role,'coach');f.release('capacity');await f.page.evaluate(()=>window.__capacity);await locked(f.page);assert.equal(Object.keys((await snapshot(f.page)).caches).length,0);
   const projected=f.hold('capacity-projected',c=>c.name==='get_team_state_for_me');await f.page.evaluate(()=>{window.__newBoot=bootTracker();});await projected;await locked(f.page);f.release('capacity-projected');await f.page.evaluate(()=>window.__newBoot);await f.ready();const s=await snapshot(f.page);assert.equal(s.role,'parent');assert.match(s.state,/PROJECTED_COACH-A/);assert.doesNotMatch(s.state,/STAFF_COACH-A/);assert.equal(s.stored,null);cases.push('confirmed-capacity-fresh-projection');await f.close();
  }
  // Ordinary reset stays an email request. Actual form validation/success and
  // errors are rendered in both themes at phone/desktop and 200% text.
  for(const theme of ['dark','light'])for(const width of [320,393,1024])for(const scale of [100,200]){
   const f=await fixture({initial:null,theme,width});await f.page.waitForSelector('#cloud-forgot-password');await f.page.locator('#cloud-forgot-password').click();assert.equal((await snapshot(f.page)).gate,'forgot');assert.equal(await f.page.locator('#cloud-new-password').count(),0);await f.page.locator('#cloud-recover-email').fill('fictional-parent@example.invalid');await f.page.locator('#cloud-recover-submit').click();await f.page.waitForFunction(()=>document.getElementById('cloud-auth-notice').textContent.includes('sent'));await capture(f,'reset-request-'+width+'-'+theme+'-'+scale,scale);assert.equal(f.calls.filter(c=>c.path==='/auth/v1/recover').length,1);assert.equal(f.calls.filter(c=>c.method==='PUT').length,0);cases.push('reset-request-'+width+'-'+theme+'-'+scale);await f.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalWrites,[]);assert.deepEqual(externalRequests,[]);
  const screenshots=fs.readdirSync(out).filter(name=>name.endsWith('.png')).sort();
  const artifactSha256=Object.fromEntries(['app.js','cloud.js','kickoff-updates.js','index.html','cloud.css','app-design-system.css'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')]));
  const result={source:'actual trusted built app/cloud; fictional HTTP routes only; no cloud API or bootstrap replacement',behaviorCases:cases.length,cases,privacyDom,layoutChecks:measurements.length,measurements,screenshots:screenshots.length,screenshotSha256:Object.fromEntries(screenshots.map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,name))).digest('hex')])),artifactSha256,pageErrors:errors,externalWrites,externalRequests};
  fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(result,null,2)+'\n');console.log('PASS actual built account/context isolation: '+cases.length+' behavior cases, '+measurements.length+' layouts, '+screenshots.length+' PNGs; zero page errors/external requests/writes');
 }finally{for(const context of contexts)await context.close().catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
