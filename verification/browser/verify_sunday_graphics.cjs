// Actual built assets and native routes, with fictional in-memory API data only.
// Run after cloudflare/web-app/build.py. External services are blocked.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'sunday-graphics-review');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/cloud-config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://fictional.supabase.co",anonKey:"fictional-only-no-credentials-00000000000000000000000000"};');}
 if(url.pathname.startsWith('/data/')){res.setHeader('Content-Type','application/json');return res.end('{"clubs":[],"age_groups":[],"fixtures":[]}');}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
let base;
async function prepare(page,role,width,theme,confirmed=false){
 await page.setViewportSize({width,height:900});await page.goto(base+'/');await page.waitForFunction(()=>typeof renderAll==='function');
 await page.evaluate(({role,theme,confirmed})=>{
  applyTheme(theme);document.querySelector('#app-splash')?.remove();document.body.classList.remove('splash-active','auth-open');document.querySelector('#activation-gate').classList.add('hidden');document.querySelector('.app-shell').classList.remove('account-locked');
  account={role,user:'Fictional reviewer'};currentRole=role;adminUiMode=role==='admin'?'club':'team';
  window.__sunday={uid:'fictional-'+role,team:'fictional-team',saves:[],links:[{parent_user_id:'fictional-parent',team_id:'fictional-team',player_name:'Alex Example',shirt_number:1},{parent_user_id:'other-parent',team_id:'fictional-team',player_name:'Other Family Child'},{parent_user_id:'fictional-parent',team_id:'other-team',player_name:'Other Team Child'}]};
  const api=window.ClubHubCloud;
  Object.defineProperty(api,'session',{configurable:true,get:()=>({user:{id:__sunday.uid,email:'fictional@example.invalid'}})});
  Object.defineProperty(api,'context',{configurable:true,get:()=>({profile:{user_id:__sunday.uid,club_id:'fictional-club',role:currentRole,full_name:currentRole==='coach'?'Taylor Example':'Fictional '+currentRole},real_role:currentRole})});
  Object.assign(api,{role:()=>currentRole,realRole:()=>currentRole,actingAsParent:()=>false,isStaffAccount:()=>role!=='parent',canAdmin:()=>role==='admin',canEdit:()=>role!=='parent',currentTeam:()=>({id:__sunday.team,name:'Example Greens',teamName:'Example Greens',ageGroup:'U9',age_group:9}),visibleTeamList:()=>[{id:'fictional-team',teamName:'Example Greens',ageGroup:'U9'}],listMyCoachTeams:async()=>[],listTeamMembers:async()=>[],listPendingParentRequests:async()=>[],listParentPlayerLinks:async()=>JSON.parse(JSON.stringify(__sunday.links)),listPlayerAccountLinks:async()=>[],listAnnouncements:async()=>[],listNotifications:async()=>[],listPlayerAppearanceStats:async()=>[],listMessageContacts:async()=>[],listClubMessages:async()=>[],listClubCoaches:async()=>[],listPendingCoachRequests:async()=>[],getClubOverview:async()=>[],getCoachQualifications:async()=>({records:[],revision:0}),listMatchAttendance:async()=>[],listMatchAvailability:async()=>[{player_name:'Jamie Example',status:'available'},{player_name:'Morgan Example',status:'unsure'}],saveMatchAvailability:async payload=>__sunday.saves.push(payload),getKickoffPushSettings:async()=>({available:false}),listContactDirectory:async()=>({self:{user_id:__sunday.uid},contacts:[]})});
  fetchClubDirectoryDetails=async()=>({});refreshFixtureOverviewDirectory=()=>{};
  CLUB_CONFIGURATION={settings:{...UNIVERSAL_FALLBACK_SETTINGS,display_name:'Shooters Hill AFC',default_provider_key:'selkent'},providers:[],rules:[],teams:[]};
  const fixture={date:'2099-10-25',opponent:'Example Gunners',competition:'Division',venue:'H',time:''};
  state=normalizeState({meta:{clubName:'Shooters Hill AFC',teamName:'Example Greens',ageGroup:'U9',season:'2026/27'},division:{name:'Under 9 Example',teamName:'Example Greens'},selkent:{enabled:false,fixtures:[fixture],fixtureOverrides:{}},squad:[{name:'Alex Example',number:1,role:'goalkeeper',status:'active'},{name:'Jamie Example',number:4,role:'outfield',status:'active'},{name:'Morgan Example',number:7,role:'outfield',status:'active'},{name:'Riley Example',number:9,role:'outfield',status:'inactive'}],matches:[],goals:[],assists:[],awards:[],features:{tactics:true}});
  if(confirmed)state.selkent.fixtureOverrides[fixtureKitSelectionKey(fixture)]={time:'10:30',groundName:'Example Playing Fields',address:'Fictional public ground address',confirmedAt:'2026-10-22T11:00:00Z'};
  __parentFamilyKey='';__parentFamilyLinks=[];__parentFamilyStatus='loading';renderAll();navigate(role==='admin'?'club':'home',false);
 },{role,theme,confirmed});
 await page.evaluate(()=>document.fonts.ready);
 if(role==='parent')await page.waitForFunction(()=>__parentFamilyStatus==='ready'&&__availabilityLoadStatus==='ready');
 if(role==='admin')await page.waitForFunction(()=>!document.getElementById('admin-club-overview').classList.contains('hidden'));
}
async function capture(page,label,width,theme,measurements,failures){
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.evaluate(async()=>{await Promise.all([...document.images].filter(i=>i.getClientRects().length).map(i=>i.decode().catch(()=>{})));});
 const m=await page.evaluate(()=>{
  const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
  const r=e=>{const q=e.getBoundingClientRect();return {x:q.x,y:q.y,width:q.width,height:q.height,right:q.right,bottom:q.bottom};};
  const style=(selector,pseudo)=>{const e=document.querySelector(selector);if(!e)return null;const s=getComputedStyle(e,pseudo);return {background:s.backgroundImage,backgroundColor:s.backgroundColor,radius:s.borderRadius,padding:s.padding,opacity:s.opacity,position:s.position,width:s.width};};
  const modal=document.querySelector('dialog[open]'),scope=modal||document.querySelector('.view.active');
  const fixtureSelectors=['.modal-heading','.next-match-confirmed-bar','#next-match-versus','.canonical-v11-badge','.canonical-v11-badge > *','#next-match-when','.fixture-date-with-calendar'];
  return {documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,bodyClass:document.body.className,
   images:[...scope.querySelectorAll('img')].filter(visible).map(e=>({src:e.getAttribute('src'),loaded:e.complete&&e.naturalWidth>0,...r(e)})),
   controls:[...scope.querySelectorAll('button,a[href],select,input:not([type=hidden])')].filter(visible).map(e=>({name:e.getAttribute('aria-label')||e.textContent.trim().slice(0,70),tag:e.tagName,disabled:e.disabled,...r(e)})),
   shirtNumbers:[...scope.querySelectorAll('.graphic-shirt-number,.graphic-shirt-initials,.graphic-shirt-badge')].filter(visible).map(e=>({text:e.textContent,slot:r(e.parentElement),...r(e)})),
   squad:[...document.querySelectorAll('#squad-list .workspace-directory-row')].filter(visible).map(r),
   sceneTitle:document.querySelector('#home-scene-title')?.textContent,shirt:document.querySelector('#home-scene-shirt img')?.getAttribute('src')||null,
   garments:[...scope.querySelectorAll('.graphic-shirt')].map(e=>({display:getComputedStyle(e).display,...r(e)})),
   styles:{nextMatch:style('#next-match-card'),squadBanner:style('#view-squad .squad-banner'),shellAfter:style('.app-shell','::after'),nav:style('#top-nav-tabs')},
   fixtureDebug:modal?.id==='next-fixture-dialog'?{html:document.querySelector('#next-match-versus')?.outerHTML,elements:fixtureSelectors.flatMap(selector=>[...modal.querySelectorAll(selector)].map(e=>{const s=getComputedStyle(e);return {selector,tag:e.tagName,classes:e.className,html:e.outerHTML,...r(e),style:{position:s.position,display:s.display,padding:s.padding,margin:s.margin,minHeight:s.minHeight,maxHeight:s.maxHeight,width:s.width,height:s.height,background:s.backgroundImage,backgroundColor:s.backgroundColor,borderRadius:s.borderRadius,objectFit:s.objectFit,flex:s.flex,alignItems:s.alignItems,justifyContent:s.justifyContent}};}))}:null};
 });
 const issues=[];
 if(m.documentWidth>width+1)issues.push('document overflow');
 for(const img of m.images)if(!img.loaded)issues.push('image failed: '+img.src);
 for(const c of m.controls)if(c.height<43.9)issues.push('short control: '+c.name+' '+c.height);
 for(const n of m.shirtNumbers)if(n.x<n.slot.x-1||n.right>n.slot.right+1||n.y<n.slot.y-1||n.bottom>n.slot.bottom+1)issues.push('shirt overlay outside garment slot');
 if(label==='squad'&&width<600&&m.squad.length>1&&Math.abs(m.squad[0].y-m.squad[1].y)<1)issues.push('phone squad names need full-width rows beside their shirts');
 if(label==='squad'&&m.garments.some(g=>g.display==='none'||g.height<100))issues.push('squad garment is hidden or collapsed');
 if(label.startsWith('match-')&&m.fixtureDebug){
  for(const badge of m.fixtureDebug.elements.filter(e=>e.selector==='.canonical-v11-badge'||e.selector==='.canonical-v11-badge > *')){
   if(badge.width<70||Math.abs(badge.width-badge.height)>1)issues.push('raised fixture badge mount must be square: '+badge.width+'x'+badge.height);
  }
 }
 measurements.push({label,width,theme,...m,issues});if(issues.length)failures.push({label,width,theme,issues});
 await page.screenshot({path:path.join(out,`${label}-${width}-${theme}.png`),fullPage:true});
 return m;
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PITCHKIND_CHROMIUM?{executablePath:process.env.PITCHKIND_CHROMIUM}:{}),args:['--no-sandbox']});
 const page=await browser.newPage(),errors=[],externalWrites=[],failures=[],measurements=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base)return route.continue();if(route.request().method()!=='GET')externalWrites.push(u.origin+u.pathname);if(u.hostname==='www.google.com')return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><body>Fictional venue map</body>'});return route.fulfill({status:200,contentType:'application/json',body:'[]'});});
 try{
  if(process.argv[4]==='fixture'){
   await prepare(page,'coach',393,'dark',true);await page.locator('#next-match-card').click();
   await capture(page,'match-confirmed',393,'dark',measurements,failures);
   assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);return;
  }
  for(const theme of ['dark','light']){
   for(const width of [320,393,768,1440]){
    await prepare(page,'coach',width,theme);
    assert.equal(await page.locator('#home-scene-shirt .graphic-shirt-initials').innerText(),'TE');
    assert.equal(await page.locator('#home-scene-shirt .graphic-shirt-badge').getAttribute('src'),'shooters-hill-logo.png');
    await capture(page,'coach-home',width,theme,measurements,failures);
    await page.evaluate(()=>navigate('squad',false));
    assert.equal(await page.locator('#squad-list .goalkeeper .graphic-shirt-art').getAttribute('src'),'graphics/shirt-goalkeeper.webp');
    assert.equal(await page.locator('#squad-list .outfield .graphic-shirt-art').first().getAttribute('src'),'graphics/shirt-outfield.webp');
    await capture(page,'squad',width,theme,measurements,failures);
    await page.locator('#squad-list [data-player-profile="Alex Example"]').click();
    await page.locator('.graphic-profile-hero').waitFor({state:'visible'});
    assert.equal(await page.locator('.graphic-profile-hero .graphic-shirt-number').innerText(),'1');
    assert(await page.locator('[data-edit-player="1"]').isVisible());
    await capture(page,'player-profile',width,theme,measurements,failures);
    await page.locator('#person-profile-back').click();await page.waitForFunction(()=>currentView==='squad');
    if(width===393||width===1440){
     await page.evaluate(()=>navigate('home',false));await page.locator('#next-match-card').click();await page.locator('#next-fixture-dialog').waitFor({state:'visible'});
     assert.match(await page.locator('#next-match-when').innerText(),/TBC/);
     await capture(page,'match-unconfirmed',width,theme,measurements,failures);
     await page.locator('#next-fixture-action-bar [data-close-dialog]').click();
     await prepare(page,'coach',width,theme,true);await page.locator('#next-match-card').click();
     assert.match(await page.locator('#next-match-when').innerText(),/10:30/);
     await capture(page,'match-confirmed',width,theme,measurements,failures);
     await page.locator('#next-fixture-action-bar [data-close-dialog]').click();
    }
   }
   for(const width of [320,393,1440]){
    await prepare(page,'parent',width,theme);
    assert(await page.locator('#parent-home-training').isVisible());assert(!await page.locator('#parent-home-match-info').isVisible());
    assert.equal(await page.locator('#home-scene-title').textContent(),'Training this week');
    assert.equal(await page.locator('#home-scene-shirt .graphic-shirt-art').getAttribute('src'),'graphics/shirt-goalkeeper.webp');
    assert.doesNotMatch(await page.locator('#parent-home-family-list').innerText(),/Other Family|Other Team/);
    await capture(page,'parent-training',width,theme,measurements,failures);
    await prepare(page,'parent',width,theme,true);
    assert(await page.locator('#parent-home-match-info').isVisible());assert(!await page.locator('#parent-home-training').isVisible());
    assert.equal(await page.locator('#home-scene-title').textContent(),'Your matchday');
    await capture(page,'parent-matchday',width,theme,measurements,failures);
    await page.locator('#parent-home-family-list [data-player-profile="Alex Example"]').click();await page.locator('.graphic-profile-hero').waitFor({state:'visible'});
    assert.doesNotMatch(await page.locator('.player-profile-stats').innerText(),/Goals|Assists|Starts|No-shows/);
    assert(!await page.locator('[data-edit-player]').isVisible());
    await page.locator('#person-profile-back').click();await page.waitForFunction(()=>currentView==='home');
    await page.evaluate(()=>{__parentFamilyKey='different-user:different-team';renderGraphicIdentity();});
    assert(!await page.locator('#home-scene-shirt').isVisible(),'stale family identity must clear garment');
    await prepare(page,'admin',width,theme);await capture(page,'admin-home',width,theme,measurements,failures);
    assert(!await page.locator('#home-scene-shirt').isVisible());
    assert(await page.locator('#admin-home-share').isDisabled(),'unavailable public feed must not enable sharing');
   }
  }
  await prepare(page,'coach',320,'dark');await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  await capture(page,'coach-home-text200',320,'dark',measurements,failures);
  assert.deepEqual(errors,[],'runtime errors');assert.deepEqual(externalWrites,[],'no live writes');
  assert.deepEqual(failures,[],'rendered geometry / assets');
  console.log('PASS Sunday graphics: built assets; coach/parent/admin; phone/tablet/desktop; both themes; photographic kit identity; native profile/back, confirmation and family privacy.');
 }finally{
  fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({date:new Date().toISOString(),measurements,failures,errors,externalWrites},null,2));
  await browser.close();await new Promise(r=>server.close(r));
 }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
