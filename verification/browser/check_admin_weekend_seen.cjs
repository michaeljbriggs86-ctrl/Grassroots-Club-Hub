// Built Admin UI with fictional in-memory services. No live accounts, responses or sends.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');

async function run(playwrightModule=process.argv[2]||'playwright',output=process.argv[3]||'kickoff-response-review'){
 const {chromium}=require(playwrightModule),root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(output,'admin-weekend-seen');
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/cloud-config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://fictional.supabase.co",anonKey:"fictional-only-no-credentials-00000000000000000000000000"};');}
  if(url.pathname.startsWith('/data/')){res.setHeader('Content-Type','application/json');return res.end('{"clubs":[],"age_groups":[],"fixtures":[]}');}
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PITCHKIND_CHROMIUM?{executablePath:process.env.PITCHKIND_CHROMIUM}:{}),args:['--no-sandbox']});
 // The device date deliberately differs from London around midnight.
 const context=await browser.newContext({timezoneId:'Pacific/Honolulu'}),page=await context.newPage(),errors=[],external=[],results=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.route('**/*',route=>{
  if(new URL(route.request().url()).origin===base)return route.continue();
  external.push({method:route.request().method(),url:route.request().url()});
  return route.fulfill({status:200,contentType:'application/json',body:'[]'});
 });
 const container=()=>page.locator('#kickoff-weekend-seen');
 const summary=()=>container().locator('[data-kickoff-weekend-summary]');
 const count=()=>container().locator('[data-kickoff-weekend-count]');
 const group=name=>container().locator('[data-kickoff-weekend-group="'+name+'"]');
 async function prepare({width=393,theme='dark'}={}){
  await page.setViewportSize({width,height:1050});await page.goto(base+'/');
  await page.waitForFunction(()=>typeof renderAll==='function'&&typeof ClubHubKickoffUpdates?.setAdminWeekend==='function');
  await page.evaluate(({theme})=>{
   applyTheme(theme);document.getElementById('app-splash')?.remove();document.body.classList.remove('splash-active','auth-open');document.getElementById('activation-gate').classList.add('hidden');document.querySelector('.app-shell').classList.remove('account-locked');
   account={role:'admin',user:'Fictional Admin'};currentRole='admin';adminUiMode='club';
   const clone=value=>JSON.parse(JSON.stringify(value));
   window.__week={uid:'fictional-admin',club:'fictional-club',role:'admin',realRole:'admin',capacity:'staff',team:'fictional-team-a',calls:0,homeCalls:0,writes:[],rows:[],hold:false,fail:false,malformed:false};
   const api=window.ClubHubCloud;
   Object.defineProperty(api,'session',{configurable:true,get:()=>({user:{id:__week.uid}})});
   Object.defineProperty(api,'context',{configurable:true,get:()=>({profile:{user_id:__week.uid,club_id:__week.club,role:__week.realRole==='admin'?'club_admin':__week.realRole},acting_as_parent:__week.capacity==='parent'})});
   Object.assign(api,{
    currentTeam:()=>({id:__week.team,name:'Example Greens',age_group:9}),role:()=>__week.role,realRole:()=>__week.realRole,
    canEdit:()=>__week.role==='admin'&&__week.capacity!=='parent',canAdmin:()=>__week.realRole==='admin'&&__week.capacity!=='parent',actingAsParent:()=>__week.capacity==='parent',isStaffAccount:()=>__week.realRole==='admin',
    visibleTeamList:()=>[],getClubOverview:async()=>{__week.homeCalls++;return [];},listClubCoaches:async()=>[],listPendingCoachRequests:async()=>[],listMessageContacts:async()=>[],listClubMessages:async()=>[],listAnnouncements:async()=>[],listNotifications:async()=>[],getKickoffPushSettings:async()=>({available:false}),
    listKickoffUpdatesForAdmin:async()=>{__week.calls++;const snapshot=clone(__week.rows),fail=__week.fail,malformed=__week.malformed;if(__week.hold)await new Promise(resolve=>{__week.release=resolve;});if(fail)throw Error('Fictional offline');return malformed?{unexpected:'not rows'}:snapshot;},
    acknowledgeKickoffAsCoach:async()=>{__week.writes.push('coach');throw Error('Counter must not acknowledge');},respondKickoffParentAvailability:async()=>{__week.writes.push('parent');throw Error('Counter must not RSVP');},markNotificationRead:async()=>{__week.writes.push('read');throw Error('Counter must not mark read');}
   });
   if(window.ClubHubStaticSelkent)Object.assign(ClubHubStaticSelkent,{loadResults:async()=>({clubs:[],age_groups:[],fixtures:[]}),loadDirectory:async()=>({clubs:[]})});
   state=normalizeState({meta:{clubName:'Shooters Hill AFC',teamName:'Example Greens',ageGroup:'U9',season:'2026/27'},squad:[],matches:[],goals:[],awards:[]});
   ClubHubKickoffUpdates.reset();renderAll();navigate('home',false);
   document.getElementById('admin-club-overview').classList.remove('hidden');
   // Exercise the real snapshot-to-render path, rather than setting module dates directly.
   __week.snapshot=()=>{const snap=buildAdminHomeSnapshot([],[],[],[],[],{fixtures:[]},null);snap.identity=adminWeekendShareIdentity();__adminHomeSnapshot=snap;renderAdminHome(snap);return snap.dates;};
   __week.dates=__week.snapshot();
   const at='2026-10-15T22:30:00Z';
   __week.coach=(id,name,seen=false,extra={})=>({user_id:id,name,acknowledged_at:seen?at:null,revision_current:seen,...extra});
   __week.row=(id,date,coaches,extra={})=>({update_id:id,team_id:'team-'+id,team_name:'Example team '+id,fixture_key:date+'|example opponent|H|division',revision:2,details:{date,time:'10:30',opponent:'Example opponent '+id,ground:'Public example ground',status:'confirmed'},created_at:at,coaches,parents:{total:99,available:40,unavailable:10,pending:49,changed:0},...extra});
   __week.standard=()=>{
    const [sat,sun]=__week.dates,next=new Date(sat+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+7);
    return [
     __week.row('league',sat,[__week.coach('multi','Example Multi Coach',true),__week.coach('seen','Example Seen Coach',true),__week.coach('read-only','Example Read-only Coach',false,{read_at:at,seen_at:at,delivered_at:at})]),
     __week.row('cup-one',sun,[__week.coach('multi','Example Multi Coach',false),__week.coach('stale','Example Stale Coach',true,{revision_current:false})],{details:{date:sun,time:'11:30',opponent:'Example Cup One',status:'provisional'}}),
     __week.row('cup-two',sun,[__week.coach('multi','Example Multi Coach',true),__week.coach('same-name-a','Example Same Name',true),__week.coach('same-name-b','Example Same Name',false)],{details:{date:sun,time:'12:00',opponent:'Example Cup Two',status:'confirmed'}}),
     __week.row('next-week',next.toISOString().slice(0,10),[__week.coach('next-only','Example Next Weekend',false),__week.coach('seen','Example Seen Coach',false)])
    ];
   };
  },{theme});
  await page.evaluate(()=>document.fonts.ready);
  // Allow the initial ordinary Admin refresh to settle, then start an explicit isolated read.
  await page.evaluate(async()=>{await refreshAdminClubOverview(false);__week.dates=__week.snapshot();await ClubHubKickoffUpdates.refreshAdmin(false);});
 }
 async function load(kind='standard'){
  await page.evaluate(async kind=>{__week.rows=kind==='standard'?__week.standard():[];await ClubHubKickoffUpdates.refreshAdmin(false);},kind);
 }
 async function expectCount(value){await page.waitForFunction(value=>document.querySelector('[data-kickoff-weekend-count]')?.textContent.replace(/\s+/g,'')===value.replace(/\s+/g,''),value);}
 async function open(){if(!await container().locator('details').evaluate(el=>el.open))await summary().click();}
 async function capture(name){await page.screenshot({path:path.join(out,name+'.png'),fullPage:false});}

 async function aggregation(){
  await prepare();await load();await expectCount('2/6 seen');
  assert.match(await summary().innerText(),/^Coaches\s*·\s*2\/6\s*seen/i);
  assert.equal(await container().locator('details[open]').count(),0,'compact counter starts collapsed');
  const calls=await page.evaluate(()=>__week.calls);await summary().focus();await page.keyboard.press('Enter');
  assert.equal(await container().locator('details[open]').count(),1,'native details supports keyboard opening');
  await summary().focus();await page.keyboard.press('Space');assert.equal(await container().locator('details[open]').count(),0,'Space closes native details');await page.keyboard.press('Space');assert.equal(await container().locator('details[open]').count(),1,'Space reopens native details');
  assert.equal(await group('outstanding').locator('[data-kickoff-weekend-coach]').count(),4);
  assert.equal(await group('seen').locator('[data-kickoff-weekend-coach]').count(),2);
  const order=await container().locator('[data-kickoff-weekend-group]').evaluateAll(nodes=>nodes.map(n=>n.dataset.kickoffWeekendGroup));
  assert.deepEqual(order,['outstanding','seen']);
  assert.equal(await container().locator('[data-kickoff-weekend-coach="multi"]').count(),1,'one coach across league and cup receipts is counted once');
  assert.equal(await group('outstanding').locator('[data-kickoff-weekend-coach="multi"]').count(),1,'one unacknowledged receipt keeps the coach outstanding');
  assert.equal(await group('outstanding').locator('[data-kickoff-weekend-coach="read-only"]').count(),1,'read/delivery timestamps never count as explicit acknowledgement');
  assert.equal(await group('outstanding').locator('[data-kickoff-weekend-coach="stale"]').count(),1,'old revision acknowledgement is outstanding');
  assert.equal(await container().locator('[data-kickoff-weekend-coach="next-only"]').count(),0,'next weekend is excluded');
  assert.equal(await group('seen').locator('[data-kickoff-weekend-coach="seen"]').count(),1,'next weekend pending receipt does not affect this weekend');
  assert.equal(await container().locator('[data-kickoff-weekend-coach="same-name-a"]').count(),1);
  assert.equal(await container().locator('[data-kickoff-weekend-coach="same-name-b"]').count(),1,'matching display names do not collapse separate users');
  const pending=group('outstanding').locator('[data-kickoff-weekend-coach="multi"]');
  assert.match(await pending.innerText(),/Example Cup One/);assert.match(await pending.innerText(),/Provisional/i);
  assert.equal(await pending.locator('[data-kickoff-weekend-update="league"]').count(),0,'only pending contexts are listed for an outstanding coach');
  assert.doesNotMatch(await container().innerText(),/Parent|Child|99|49/,'compact counter contains no family details or parent aggregates');
  assert.equal(await page.evaluate(()=>__week.calls),calls,'expanding reads cached status without an RPC or save');
  assert.deepEqual(await page.evaluate(()=>__week.writes),[]);
  await page.evaluate(async()=>{__week.rows[1].coaches[0].acknowledged_at='2026-10-15T23:00:00Z';__week.rows[1].coaches[0].revision_current=true;await ClubHubKickoffUpdates.refreshAdmin(false);});
  await expectCount('3/6 seen');assert.equal(await group('seen').locator('[data-kickoff-weekend-coach="multi"]').count(),1,'all current receipts now move the coach to Seen');
  await page.evaluate(async()=>{__week.rows[0].update_id='league-new-revision';__week.rows[0].revision++;__week.rows[0].coaches.find(coach=>coach.user_id==='seen').acknowledged_at=null;__week.rows[0].coaches.find(coach=>coach.user_id==='seen').revision_current=false;await ClubHubKickoffUpdates.refreshAdmin(false);});
  await expectCount('2/6 seen');assert.equal(await group('outstanding').locator('[data-kickoff-weekend-coach="seen"]').count(),1,'a new current revision requires a fresh acknowledgement');
  results.push('unique coaches, all receipt revisions, read-not-ack, provisional, pending contexts and next-week exclusion');
 }

 async function states(){
  await prepare();await load();await expectCount('2/6 seen');
  await page.evaluate(()=>{__week.hold=true;void ClubHubKickoffUpdates.refreshAdmin(false);});await page.waitForFunction(()=>!!__week.release);
  assert.match(await container().innerText(),/Loading|Checking/i);assert.equal(await count().count(),0,'loading never retains a stale numeric claim');await capture('loading-393-dark');
  await page.evaluate(()=>{__week.hold=false;__week.release();});await expectCount('2/6 seen');
  await page.evaluate(async()=>{__week.fail=true;await ClubHubKickoffUpdates.refreshAdmin(false);});
  assert.match(await container().innerText(),/unavailable|could not|try again/i);assert.equal(await count().count(),0);assert.equal(await container().locator('[data-kickoff-weekend-coach]').count(),0);
  await capture('error-393-dark');await page.evaluate(()=>__week.fail=false);await container().locator('[data-kickoff-admin-refresh]').click();await expectCount('2/6 seen');
  await page.evaluate(async()=>{__week.rows=[];await ClubHubKickoffUpdates.refreshAdmin(false);});
  assert.match(await container().innerText(),/no .*update|no .*release|not .*release/i);assert.equal(await count().count(),0,'no releases is not a fabricated0/0');await capture('empty-393-dark');
  await page.evaluate(async()=>{__week.rows=[__week.row('unaddressed',__week.dates[0],[])];await ClubHubKickoffUpdates.refreshAdmin(false);});
  assert.match(await container().innerText(),/no .*coach/i);assert.equal(await count().count(),0,'no addressed coaches has no numeric fraction');
  await page.evaluate(async()=>{__week.malformed=true;await ClubHubKickoffUpdates.refreshAdmin(false);});
  assert.match(await container().innerText(),/unavailable|could not|try again/i);assert.equal(await count().count(),0,'malformed service responses are errors');
  for(const bad of ['missing-id','string-revision','invalid-timestamp']){
   await page.evaluate(async bad=>{__week.malformed=false;__week.rows=__week.standard();const coach=__week.rows[0].coaches[0];if(bad==='missing-id')delete coach.user_id;if(bad==='string-revision')coach.revision_current='true';if(bad==='invalid-timestamp')coach.acknowledged_at='not a timestamp';await ClubHubKickoffUpdates.refreshAdmin(false);},bad);
   assert.equal(await count().count(),0,bad+' does not partially count a valid-looking subset');assert.match(await container().innerText(),/unavailable/i);
  }
  await page.evaluate(async()=>{__week.malformed=false;__week.rows=Array.from({length:99},(_,i)=>__week.row('cap-'+i,__week.dates[0],[__week.coach('coach-'+i,'Example capped coach '+i,true)]));await ClubHubKickoffUpdates.refreshAdmin(false);});
  await expectCount('99/99 seen');
  await page.evaluate(async()=>{const next=new Date(__week.dates[0]+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+7);__week.rows=Array.from({length:100},(_,i)=>__week.row('cap-'+i,i?next.toISOString().slice(0,10):__week.dates[0],[__week.coach('coach-'+i,'Example capped coach '+i,true)]));await ClubHubKickoffUpdates.refreshAdmin(false);});
  assert.equal(await count().count(),0,'raw100-row limit suppresses exact totals even after weekend filtering');
  assert.doesNotMatch(await container().innerText(),/\b\d+\s*\/\s*\d+\s*seen\b/i);assert.match(await container().innerText(),/unavailable|complete|limit|refresh/i);await capture('capped-393-dark');
  results.push('loading, retry, empty, no addressed coaches, malformed and capped response states');
 }

 async function scopes(){
  for(const change of ['capacity','account','club','role','team-preview']){
   await prepare();await load();await expectCount('2/6 seen');
   await page.evaluate(()=>{__week.hold=true;void ClubHubKickoffUpdates.refreshAdmin(false);});await page.waitForFunction(()=>!!__week.release);
   await page.evaluate(change=>{
    if(change==='capacity'){__week.capacity='parent';__week.role='parent';currentRole='parent';}
    if(change==='account')__week.uid='fictional-other-admin';
    if(change==='club')__week.club='fictional-other-club';
    if(change==='role'){__week.realRole='coach';__week.role='coach';currentRole='coach';}
    if(change==='team-preview')adminUiMode='team';
    ClubHubKickoffUpdates.renderAdmin();__week.hold=false;__week.release();
   },change);
   await page.waitForTimeout(100);
   assert.equal(await container().locator('[data-kickoff-weekend-coach]').count(),0,change+' change clears names and fences the old RPC');
   assert.equal(await count().count(),0,change+' change clears count');
   if(change==='capacity'||change==='role'||change==='team-preview'){
    assert.equal(await container().isVisible(),false);
    const before=await page.evaluate(()=>__week.calls);await page.evaluate(()=>ClubHubKickoffUpdates.refreshAdmin(false));assert.equal(await page.evaluate(()=>__week.calls),before,'unauthorized role/capacity never requests named status');
   }
  }
  await prepare();await load();await expectCount('2/6 seen');await page.evaluate(()=>window.dispatchEvent(new Event('clubhub-signed-out')));
  assert.equal(await container().locator('[data-kickoff-weekend-coach]').count(),0);assert.equal(await count().count(),0,'sign-out clears the count and names synchronously');
  results.push('real role, Parent capacity, account/club changes and sign-out fence late RPCs');
 }

 async function dates(){
  await prepare();
  const boundary=await page.evaluate(()=>[
   adminShareWeekendDates(new Date('2026-10-18T22:59:59Z')),
   adminShareWeekendDates(new Date('2026-10-18T23:00:00Z')),
   adminShareWeekendDates(new Date('2026-10-25T23:30:00Z')),
   adminShareWeekendDates(new Date('2026-10-26T00:00:00Z'))
  ]);
  assert.deepEqual(boundary,[['2026-10-17','2026-10-18'],['2026-10-24','2026-10-25'],['2026-10-24','2026-10-25'],['2026-10-31','2026-11-01']],'London weekend rollover follows BST/GMT, independent of device timezone');
  const route=await page.evaluate(()=>{const original=ClubHubKickoffUpdates.setAdminWeekend,calls=[];ClubHubKickoffUpdates.setAdminWeekend=value=>{calls.push([...value]);return original(value);};const expected=__week.snapshot();ClubHubKickoffUpdates.setAdminWeekend=original;return {expected,calls,shown:document.getElementById('admin-home-weekend-dates').textContent};});
  assert.deepEqual(route.calls,[route.expected],'actual Admin snapshot render supplies its dates to the counter');assert(route.shown.length>0);
  const refresh=await page.evaluate(async()=>{const before=__week.homeCalls;await refreshAdminClubOverview(false);return {before,after:__week.homeCalls,dates:__adminHomeSnapshot?.dates,status:document.getElementById('admin-overview-meta').textContent};});
  assert(refresh.after>refresh.before,'actual Admin refresh fetches a new snapshot');assert.deepEqual(refresh.dates,route.expected);assert.match(refresh.status,/Updated/);
  await load();await expectCount('2/6 seen');
  for(const outcome of ['success','failure']){
   await prepare();await load();await expectCount('2/6 seen');await open();
   await page.evaluate(outcome=>{__week.hold=true;__week.fail=outcome==='failure';delete __week.release;void ClubHubKickoffUpdates.refreshAdmin(false);},outcome);await page.waitForFunction(()=>!!__week.release);
   await page.evaluate(()=>{
    __week.oldRelease=__week.release;const original=adminShareWeekendDates,previous=[...__week.dates],next=previous.map(value=>{const date=new Date(value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+7);return date.toISOString().slice(0,10);});__week.originalDates=original;adminShareWeekendDates=()=>next;
    __week.hold=false;__week.fail=false;__week.rows=[__week.row('new-week',next[0],[__week.coach('new-week-coach','Example New Weekend Coach',true)])];ClubHubKickoffUpdates.setAdminWeekend(next);
   });
   await expectCount('1/1 seen');assert.equal(await container().locator('details[open]').count(),0,'rollover closes the old expanded list');
   assert.equal(await container().locator('[data-kickoff-weekend-coach="multi"]').count(),0,'switching weekend removes old coach names');
   await page.evaluate(()=>__week.oldRelease());await page.waitForTimeout(100);await expectCount('1/1 seen');
   assert.equal(await container().locator('[data-kickoff-weekend-coach="new-week-coach"]').count(),1,'late old-week '+outcome+' cannot replace or clear the new week');
   await page.evaluate(()=>{adminShareWeekendDates=__week.originalDates;__week.rows=__week.standard();ClubHubKickoffUpdates.setAdminWeekend(adminShareWeekendDates());});await expectCount('2/6 seen');
  }
  results.push('London BST/GMT rollover, real snapshot route and late old-week success/failure fences');
 }

 async function layout(width,theme){
  await prepare({width,theme});await load();await expectCount('2/6 seen');await capture('collapsed-'+width+'-'+theme);await open();
  const metrics=await container().evaluate(el=>{
   const hero=el.closest('.admin-home-weekend'),style=getComputedStyle(hero),color=value=>{const probe=document.createElement('span');probe.style.color=value;hero.append(probe);const result=getComputedStyle(probe).color.match(/[\d.]+/g).map(Number);probe.remove();return result;};
   const lum=rgb=>rgb.slice(0,3).map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,i)=>sum+value*[.2126,.7152,.0722][i],0);
   // The current Sunday/Figma weekend section is transparent over the theme
   // canvas. Measure its rendered material, not the retired green hero colours.
   const canvas=color(style.getPropertyValue('--sh-canvas'));
   const paints=style.backgroundImage.match(/rgba?\([^)]+\)|#[\da-f]{3,8}\b/gi)||[style.backgroundColor];
   const backgrounds=paints.map(paint=>{const rgb=color(paint),alpha=rgb[3]??1;return rgb.slice(0,3).map((value,i)=>value*alpha+canvas[i]*(1-alpha));});
   const contrast=node=>{const s=getComputedStyle(node),rgb=color(s.color),opacity=Number(s.opacity)*(rgb[3]??1);return Math.min(...backgrounds.map(bg=>{const foreground=rgb.slice(0,3).map((value,i)=>value*opacity+bg[i]*(1-opacity)),a=lum(foreground),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}));};
   return {overflow:el.scrollWidth>el.clientWidth+1,viewportOverflow:document.documentElement.scrollWidth>innerWidth+1,summaryHeight:el.querySelector('summary').getBoundingClientRect().height,summaryContrast:contrast(el.querySelector('summary')),contextContrast:contrast(el.querySelector('.kickoff-weekend-context')),contextFontSize:getComputedStyle(el.querySelector('.kickoff-weekend-context')).fontSize,heroBackground:style.backgroundImage,groups:[...el.querySelectorAll('[data-kickoff-weekend-group]')].map(n=>({group:n.dataset.kickoffWeekendGroup,overflow:n.scrollWidth>n.clientWidth+1}))};
  });
  assert.equal(metrics.overflow,false);assert.equal(metrics.viewportOverflow,false);assert(metrics.summaryHeight>=44,'native summary retains44px target');assert(metrics.groups.every(g=>!g.overflow));await capture('expanded-'+width+'-'+theme);
  assert(metrics.summaryContrast>=4.5,'summary contrast across its actual theme material');assert(metrics.contextContrast>=4.5,'context contrast includes its opacity');assert.equal(metrics.contextFontSize,'12px');
  if(width===320){
   await container().evaluate(el=>{const sizes=[...el.querySelectorAll('*')].map(node=>[node,parseFloat(getComputedStyle(node).fontSize)]);for(const [node,size] of sizes){node.dataset.beforeStyle=node.getAttribute('style')||'';node.style.fontSize=size*2+'px';}});
   const enlarged=await container().evaluate(el=>({overflow:el.scrollWidth>el.clientWidth+1,clipped:[...el.querySelectorAll('summary,li')].filter(n=>n.scrollHeight>n.clientHeight+1).length}));
   assert.deepEqual(enlarged,{overflow:false,clipped:0},'320px reflows at200% text');await capture('text200-'+width+'-'+theme);
  }
  results.push({width,theme,metrics});
 }
 try{
  await aggregation();await states();await scopes();await dates();
  for(const theme of ['dark','light'])for(const width of [320,393,1600])await layout(width,theme);
  assert.deepEqual(errors,[]);assert.equal(external.filter(request=>request.method!=='GET').length,0,'no external writes');assert.deepEqual(await page.evaluate(()=>__week.writes),[]);
  fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({results,errors,external_requests_intercepted:external.length},null,2));
  console.log('PASS built Admin weekend seen: distinct coaches/all current receipts, read-not-ack, provisional, London snapshot dates, next-week exclusion, cap without numeric claim, loading/error/retry/empty, role/capacity/late-RPC fences,320/393/1600 dark/light and200% text; no live writes.');
 }catch(error){await page.screenshot({path:path.join(out,'failed-check.png'),fullPage:true});throw error;}
 finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
module.exports={run};if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
