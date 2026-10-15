// Built app verification with fictional in-memory data; external services are blocked.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'notification-visual-review');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/cloud-config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://fictional.supabase.co",anonKey:"fictional-only-no-credentials-00000000000000000000000000"};');}
 if(url.pathname.startsWith('/data/')){res.setHeader('Content-Type','application/json');return res.end('{"clubs":[],"age_groups":[],"fixtures":[]}');}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
let base;
async function prepare(page,width,theme,admin=false){
 await page.setViewportSize({width,height:900});await page.goto(base+'/');await page.waitForFunction(()=>typeof renderAll==='function');
 await page.evaluate(({theme,admin})=>{
  applyTheme(theme);document.getElementById('app-splash')?.remove();document.body.classList.remove('splash-active','auth-open');document.getElementById('activation-gate').classList.add('hidden');document.querySelector('.app-shell').classList.remove('account-locked');
  account={role:admin?'admin':'coach',user:'Fictional reviewer'};currentRole=account.role;adminUiMode=admin?'club':'team';
  window.__notesFixture={failLoad:false,failRead:false,marks:[],rows:[{id:'fixture-a',title:'Fixture update with a long title that wraps naturally',body:'The next fixture is at Example Sports Ground. Check Matches for the latest details.\nThis is a fictional update.',type:'fixture_change',created_at:'2026-10-13T14:00:00Z',read_at:null},{id:'fixture-b',title:'Availability reminder',body:'Please respond to your availability request.',type:'availability_reminder',created_at:'2026-10-13T12:00:00Z',read_at:null}]};
  const api=window.ClubHubCloud;
  Object.defineProperty(api,'session',{configurable:true,value:{user:{id:'fictional-user'}}});
  Object.defineProperty(api,'context',{configurable:true,value:{profile:{user_id:'fictional-user',club_id:'fictional-club',role:currentRole}}});
  Object.assign(api,{currentTeam:()=>({id:'fictional-team',name:'Example Greens',age_group:9}),role:()=>currentRole,canEdit:()=>true,actingAsParent:()=>false,visibleTeamList:()=>[],getClubOverview:async()=>({teams:[],coaches:[]}),listMessageContacts:async()=>[],listClubMessages:async()=>[],listAnnouncements:async()=>[],
   listNotifications:async()=>{if(__notesFixture.failLoad)throw Error('Fictional offline');return JSON.parse(JSON.stringify(__notesFixture.rows));},
   markNotificationRead:async id=>{__notesFixture.marks.push(id);if(__notesFixture.failRead&&id==='fixture-b')throw Error('Fictional write failure');__notesFixture.rows.find(n=>n.id===id).read_at=new Date().toISOString();}});
  state=normalizeState({meta:{clubName:'Shooters Hill AFC',teamName:'Example Greens with a long team name',ageGroup:'U9',season:'2026/27'},squad:[],matches:[],goals:[],awards:[]});
  __notesFixture.rows[0].important=true;
  api.listAnnouncements=async()=>__notesFixture.rows.length?[{id:'notice-read',title:'Training reminder',body:'Training is at Example Sports Ground this Monday.',read_at:'2026-10-13T10:00:00Z',created_at:'2026-10-13T09:00:00Z'}]:[];
  __notificationScopeKey='';__appNotifications=[];__notificationStamp=0;__announcementRows=[];renderAll();navigate('home',false);renderNotificationCenter();
 },{theme,admin});await page.evaluate(()=>document.fonts.ready);
}
async function checks(page,width,theme,role){
 await prepare(page,width,theme);
 await page.evaluate(role=>{
  currentRole=role;account.role=role;Object.defineProperty(ClubHubCloud,'context',{configurable:true,value:{profile:{user_id:'fictional-user',club_id:'fictional-club',role}}});
  window.__kick={calls:0,fail:false,stale:false,registered:0,on:false,unsubscribed:0};window.__pushPermission='default';
  Object.defineProperty(Notification,'permission',{configurable:true,get:()=>__pushPermission});Notification.requestPermission=async()=>{__pushPermission='granted';return 'granted';};
  const subscription={endpoint:'https://fcm.googleapis.com/fictional',toJSON:()=>({endpoint:'https://fcm.googleapis.com/fictional',keys:{p256dh:'A'.repeat(87),auth:'A'.repeat(22)}}),unsubscribe:async()=>{__kick.on=false;__kick.unsubscribed++;return true;}};
  navigator.serviceWorker.getRegistration=async()=>({active:true,pushManager:{getSubscription:async()=>__kick.on?subscription:null,subscribe:async()=>{__kick.on=true;return subscription;}}});
  Object.assign(ClubHubCloud,{getKickoffPushSettings:async()=>({available:true,public_key:'A'.repeat(87),subscribed:__kick.on}),registerKickoffPush:async()=>{__kick.registered++;},unregisterKickoffPush:async()=>{},
   acknowledgeKickoffUpdate:async id=>{__kick.calls++;if(__kick.fail)throw Error('offline');if(__kick.stale){__notesFixture.rows[0].update_id='00000000-0000-0000-0000-000000000099';__notesFixture.rows[0].details.time='11:15';__notesFixture.rows[0].body=__notesFixture.rows[0].body.replace('10:30','11:15');throw Error('KICKOFF_DETAILS_CHANGED');}await new Promise(r=>setTimeout(r,100));const stamp='2026-10-14T12:00:00Z';__notesFixture.rows.find(r=>r.update_id===id).seen_at=stamp;return stamp;},listAnnouncements:async()=>[]});
  __notesFixture.rows=[{id:'kickoff-1',update_id:'00000000-0000-0000-0000-000000000001',type:'kickoff_update',title:'Kick-off details added',body:'U12 Green · Sun 18 October\nShooters Hill AFC vs Example United\nKick-off 10:30\nExample Playing Fields · Public ground address\nProvisional: awaiting the other club’s confirmation',details:{time:'10:30'},created_at:'2026-10-14T11:50:00Z',read_at:null,seen_at:null,confirmation_totals:role==='coach'?{coaches:2,coaches_seen:1,parents:12,parents_seen:8}:null,delivery_totals:role==='coach'?{queued:14}:null}];
  __announcementRows=[];__notificationStamp=0;ClubHubKickoffUpdates.reset();renderAll();
 },role);
 await page.locator('#notification-bell').click();await page.waitForFunction(()=>document.querySelector('#notification-list [data-kickoff-check]'));
 const dialog=page.locator('#notification-dialog'),checkbox=dialog.locator('[data-kickoff-check]'),confirm=dialog.locator('[data-kickoff-confirm]');
 assert.equal(await page.evaluate(()=>__kick.calls),0,'opening is not acknowledgement');assert(await confirm.isDisabled());
 assert.equal(await dialog.locator('.kickoff-totals').count(),role==='coach'?1:0,'parent does not see family receipt totals');
 await checkbox.check();assert(await confirm.isEnabled());await page.screenshot({path:path.join(out,`pending-${role}-${width}-${theme}.png`)});
 if(width===320){
  await dialog.evaluate(el=>{const nodes=[...el.querySelectorAll('.kickoff-confirmation *,.kickoff-push-panel *')];const sizes=nodes.map(n=>({n,size:parseFloat(getComputedStyle(n).fontSize),before:n.getAttribute('style')}));for(const {n,size,before} of sizes){n.dataset.zoomBefore=before||'';n.style.fontSize=(size*2)+'px';}});
  const enlarged=await dialog.evaluate(el=>({overflow:el.scrollWidth>el.clientWidth+1,clipped:[...el.querySelectorAll('.kickoff-confirmation button,.kickoff-push-panel button')].filter(n=>n.scrollHeight>n.clientHeight+1).length}));assert.deepEqual(enlarged,{overflow:false,clipped:0},'320px acknowledgement/device controls reflow at 200% text');await page.screenshot({path:path.join(out,`text200-${role}-${width}-${theme}.png`)});
  await dialog.evaluate(el=>{for(const n of el.querySelectorAll('[data-zoom-before]')){n.setAttribute('style',n.dataset.zoomBefore);delete n.dataset.zoomBefore;}});
 }
 const geometry=await dialog.evaluate(el=>({overflow:el.scrollWidth>el.clientWidth+1,buttons:[...el.querySelectorAll('button')].filter(n=>n.getBoundingClientRect().height).map(n=>n.getBoundingClientRect().height),checkbox:el.querySelector('.kickoff-checkbox').getBoundingClientRect().height}));assert.equal(geometry.overflow,false);assert(geometry.checkbox>=44);assert(geometry.buttons.every(h=>h>=44));
 await page.evaluate(()=>__kick.fail=true);await confirm.click();await page.waitForFunction(()=>document.querySelector('#notification-list .kickoff-error'));assert.equal(await checkbox.isChecked(),true,'failed write retains checkbox');assert.equal(await dialog.locator('.kickoff-seen').count(),0);await page.screenshot({path:path.join(out,`failed-${role}-${width}-${theme}.png`)});
 await page.evaluate(()=>__kick.fail=false);await confirm.click();await page.waitForFunction(()=>document.querySelector('#notification-list .kickoff-seen'));assert.match(await dialog.locator('.kickoff-seen').innerText(),/Seen by you/);assert.equal(await page.evaluate(()=>__notesFixture.marks.length),0,'confirmation does not mark read');
 await page.screenshot({path:path.join(out,`seen-${role}-${width}-${theme}.png`)});
 await page.evaluate(()=>{__notesFixture.rows[0].seen_at=null;__notificationStamp=0;__kick.stale=true;});await page.locator('#notifications-refresh').click();await page.waitForFunction(()=>document.querySelector('#notification-list [data-kickoff-check]'));
 await checkbox.check();await confirm.click();await page.waitForFunction(()=>document.querySelector('#notification-status').textContent.includes('changed while'));
 assert.equal(await dialog.locator('.kickoff-seen').count(),0);assert.equal(await checkbox.isChecked(),false);assert(await confirm.isDisabled(),'stale version requires fresh consent');await page.screenshot({path:path.join(out,`changed-${role}-${width}-${theme}.png`)});
 await page.waitForFunction(()=>document.querySelector('[data-kickoff-push-toggle]')?.textContent==='Turn on push');
 await dialog.locator('[data-kickoff-push-toggle]').click();await page.waitForFunction(()=>document.querySelector('[data-kickoff-push-toggle]').textContent==='Turn off push');assert.equal(await page.evaluate(()=>__kick.registered>0),true);
 await dialog.locator('[data-kickoff-push-toggle]').click();await page.waitForFunction(()=>document.querySelector('[data-kickoff-push-toggle]').textContent==='Turn on push');assert.equal(await page.evaluate(()=>__kick.unsubscribed),1);
 await page.evaluate(async()=>{__kick.on=true;await ClubHubKickoffUpdates.disableForLogout();});assert.equal(await page.evaluate(()=>__kick.unsubscribed),2,'logout unsubscribes the device');
 await page.evaluate(()=>{__appNotifications=[];__notesFixture.rows=[];__notificationStamp=0;});await page.locator('#notifications-refresh').click();await page.waitForFunction(()=>document.getElementById('notification-list').textContent.includes('No notifications yet'));
 await page.locator('.notification-close').click();return {width,theme,role,geometry};
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PITCHKIND_CHROMIUM?{executablePath:process.env.PITCHKIND_CHROMIUM}:{}),args:['--no-sandbox']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 const results=[];try{
  for(const theme of ['dark','light'])for(const width of [320,393,1024])for(const role of ['coach','parent'])results.push(await checks(page,width,theme,role));
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({results,errors},null,2));console.log('PASS built kick-off receipts: coach/parent, both themes, phones/wider, explicit checkbox, failed writes, seen success, stale version, no inferred read/seen, device push on/off/logout and empty state.');
 }catch(e){await page.screenshot({path:path.join(out,'failed-check.png'),fullPage:true});throw e;}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
