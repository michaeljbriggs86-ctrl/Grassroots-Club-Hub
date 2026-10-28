// Render the built app using fictional state; never contact authenticated services.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'hero-context-browser-review');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/cloud-config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://fictional.supabase.co",anonKey:"fictional-only-no-credentials-00000000000000000000000000"};');}
 if(url.pathname.startsWith('/data/')){res.setHeader('Content-Type','application/json');return res.end('{"clubs":[],"age_groups":[],"fixtures":[]}');}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
let base;
async function prepare(page,role,width,theme){
 await page.setViewportSize({width,height:900});await page.goto(base+'/');await page.waitForFunction(()=>typeof renderAll==='function');
 await page.evaluate(({role,theme})=>{
  applyTheme(theme);document.getElementById('app-splash')?.remove();document.body.classList.remove('splash-active','auth-open');document.getElementById('activation-gate').classList.add('hidden');document.querySelector('.app-shell').classList.remove('account-locked');
  account={role,user:'Fictional reviewer'};currentRole=role;adminUiMode=role==='admin'?'club':'team';
  const api=window.ClubHubCloud;
  Object.defineProperty(api,'session',{configurable:true,value:{user:{id:'fictional-user',email:'reviewer@example.invalid'}}});
  Object.defineProperty(api,'context',{configurable:true,value:{profile:{user_id:'fictional-user',club_id:'fictional-club',role}}});
  Object.assign(api,{currentTeam:()=>({id:'fictional-team',name:'Example Greens',teamName:'Example Greens',ageGroup:'U9',age_group:9}),role:()=>currentRole,canEdit:()=>['admin','coach','assistant_coach'].includes(currentRole),actingAsParent:()=>false,visibleTeamList:()=>[],getClubOverview:async()=>({teams:[],coaches:[]}),listMessageContacts:async()=>[],listClubMessages:async()=>[],listAnnouncements:async()=>[],listNotifications:async()=>[],listMyCoachTeams:async()=>[]});
  CLUB_CONFIGURATION={settings:{...UNIVERSAL_FALLBACK_SETTINGS,display_name:'Shooters Hill AFC',default_provider_key:'selkent'},providers:[],rules:[],teams:[]};
  state=normalizeState({meta:{clubName:'Shooters Hill AFC',teamName:'Example Greens',ageGroup:role==='player'?'U15':'U9',season:'2026/27'},squad:[],matches:[],goals:[],awards:[]});
  renderAll();renderNotificationCenter();navigate('home',false);
 },{role,theme});await page.evaluate(()=>document.fonts.ready);
}
async function geometry(page,selector){return page.locator(selector).evaluate(el=>({pageOverflow:document.documentElement.scrollWidth>innerWidth+1,localOverflow:el.scrollWidth>el.clientWidth+1,width:el.getBoundingClientRect().width,buttons:[...el.querySelectorAll('a,button')].filter(n=>n.getClientRects().length).map(n=>({text:n.textContent.trim(),height:n.getBoundingClientRect().height})),font:getComputedStyle(el).fontFamily}));}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.PITCHKIND_CHROMIUM,args:['--no-sandbox']});
 const page=await browser.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 async function seed(role,theme,width,count=2,dual=false){
  await prepare(page,role,width,theme);
  await page.evaluate(({count,dual})=>{
   const api=window.ClubHubCloud;
   const team={id:'fictional-team',teamName:'Example Greens',name:'Example Greens',ageGroup:'U9'};
   const rows=[{team_id:'fictional-team',name:'Example Greens',age_group:9,is_active:true},{team_id:'other-team',name:'Example Whites',age_group:12,is_active:false}].slice(0,count);
   api.coachTeam=()=>dual?team:null;api.assignedTeam=()=>team;api.visibleTeamList=()=>[team];
   api.listMyCoachTeams=async()=>rows;
   window.__heroCalls=[];api.switchMyCoachTeam=async id=>{window.__heroCalls.push(id);throw Error('Injected offline failure');};
   __coachTeamsLoaded=false;__coachTeams=[];renderAll();
  },{count,dual});
  await page.evaluate(()=>refreshCoachTeamSwitch(false));
 }
 try{
  for(const theme of ['dark','light'])for(const width of [320,393,1024]){
   await seed('admin',theme,width,2,true);
   assert(await page.locator('#hero-profile-switch').isVisible());
   assert.equal(await page.locator('#hero-profile-switch').innerText(),'Coach view');
   const compact=await page.locator('.hero').evaluate(el=>{
    const hero=el.getBoundingClientRect(),identity=el.querySelector('.hero-inner').getBoundingClientRect(),actions=el.querySelector('.hero-context-actions').getBoundingClientRect(),label=el.querySelector('#hero-mode-pill'),title=el.querySelector('h1').getBoundingClientRect();
    const copy=el.querySelector('.hero-copy'),range=document.createRange();range.selectNodeContents(copy);
    const textFits=[...range.getClientRects()].every(r=>r.right<=actions.left+1||r.bottom<=actions.top+1);
    return {height:hero.height,textFits,aligned:innerWidth<374?actions.top>=identity.bottom:Math.abs(identity.top-actions.top)<2,roleBelowTitle:label.getBoundingClientRect().top>=title.bottom-1,roleBackground:getComputedStyle(label).backgroundColor,roleBorder:getComputedStyle(label).borderTopWidth};
   });
   assert(compact.aligned,'shared header top-aligns actions and stacks them below identity on narrow phones');
   assert(compact.textFits,'all identity text stays clear of the controls');
   assert(compact.roleBelowTitle,'role is metadata below the heading');
   assert.equal(compact.roleBackground,'rgba(0, 0, 0, 0)');assert.equal(compact.roleBorder,'0px');
   assert(compact.height<180,'responsive Admin hero remains compact');
   await page.screenshot({path:path.join(out,'compact-admin-'+width+'-'+theme+'.png')});
   await page.locator('#hero-profile-switch').click();
   assert.equal(await page.evaluate(()=>adminUiMode),'coach');
   await page.evaluate(()=>refreshCoachTeamSwitch(false));
   assert.equal(await page.locator('#hero-profile-switch').innerText(),'Admin view');
   assert(await page.locator('#hero-team-switch').isVisible());
   const b=await geometry(page,'.hero');assert.equal(b.pageOverflow,false);/* Decorative hero watermark may extend behind its clipped edge. */assert(b.buttons.every(x=>x.height>=44));
   const bounds=await page.locator('.hero').evaluate(el=>{
    const r=el.getBoundingClientRect();return [...el.querySelectorAll('button,select')].filter(n=>n.getClientRects().length).every(n=>{const b=n.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right+1&&b.top>=r.top&&b.bottom<=r.bottom+1;});
   });assert(bounds);
   await page.screenshot({path:path.join(out,'dual-admin-'+width+'-'+theme+'.png')});
   await page.locator('#hero-profile-switch').click();assert.equal(await page.evaluate(()=>adminUiMode),'club');assert.equal(await page.locator('#hero-team-switch').isVisible(),false);
   for(const role of ['coach','assistant_coach']){
    await seed(role,theme,width);
    assert.equal(await page.locator('#hero-profile-switch').isVisible(),false);
    assert(await page.locator('#hero-team-switch').isVisible());
    await page.locator('#hero-team-switch').selectOption('other-team');
    assert.equal(await page.locator('#hero-team-switch').inputValue(),'fictional-team');
    assert.match(await page.locator('#hero-team-status').innerText(),/previous team/);
    assert.deepEqual(await page.evaluate(()=>window.__heroCalls),['other-team']);
    assert.equal((await geometry(page,'.hero')).pageOverflow,false);
    await page.screenshot({path:path.join(out,role+'-'+width+'-'+theme+'.png')});
    await seed(role,theme,width,1);assert.equal(await page.locator('#hero-coaching-teams').isVisible(),false);
   }
   results.push({theme,width,bounds:b,compact});
  }
  for(const role of ['admin','parent','player','pending_parent']){
   await seed(role,'dark',320,2,false);assert.equal(await page.locator('#hero-profile-switch').isVisible(),false);assert.equal(await page.locator('#hero-team-switch').isVisible(),false);
  }
  await seed('coach','dark',320);
  await page.evaluate(()=>{currentView='add';__matchFormDirty=true;});
  page.once('dialog',d=>d.dismiss());await page.locator('#hero-team-switch').selectOption('other-team');
  assert.deepEqual(await page.evaluate(()=>window.__heroCalls),[]);assert.equal(await page.evaluate(()=>__matchFormDirty),true);assert.equal(await page.locator('#hero-team-switch').inputValue(),'fictional-team');
  await page.evaluate(()=>{currentView='home';__matchFormDirty=false;window.ClubHubCloud.listMyCoachTeams=async()=>{throw Error('offline');};});
  await page.evaluate(()=>refreshCoachTeamSwitch(false,true));assert(await page.locator('#hero-team-retry').isVisible());assert.match(await page.locator('#hero-team-status').innerText(),/Could not load/);
  await page.evaluate(()=>{window.ClubHubCloud.listMyCoachTeams=async()=>[{team_id:'fictional-team',name:'Example Greens',age_group:9,is_active:true},{team_id:'other-team',name:'Example Whites',age_group:12}];});
  await page.locator('#hero-team-retry').click();await page.waitForFunction(()=>!document.getElementById('hero-team-switch').classList.contains('hidden'));
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';renderAll();});assert.equal((await geometry(page,'.hero')).pageOverflow,false);
  await page.screenshot({path:path.join(out,'coach-320-200percent.png')});
  await seed('admin','dark',320,2,true);
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';renderAll();});
  assert.equal((await geometry(page,'.hero')).pageOverflow,false);
  assert(await page.locator('#hero-profile-switch').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'enlarged button text remains inside its target');
  await page.screenshot({path:path.join(out,'compact-admin-320-200percent.png')});
  for(const width of [320,393]){
   await seed('admin','light',width,1,true);
   await page.evaluate(()=>{adminUiMode='view';window.ClubHubCloud.currentTeam=()=>({id:'fictional-team',name:'Example United Youth Development Greens',teamName:'Example United Youth Development Greens',ageGroup:'U9'});renderAll();});
   assert.equal(await page.locator('#hero-mode-pill').innerText(),'Read only');assert(await page.locator('#hero-admin-preview-back').isVisible());
   assert.equal((await geometry(page,'.hero')).pageOverflow,false);
   assert.match(await page.locator('#hero-team-name').innerText(),/DEVELOPMENT/);
   await page.screenshot({path:path.join(out,'compact-preview-long-'+width+'.png')});
  }
  await seed('parent','dark',393);
  await page.evaluate(()=>{Object.assign(window.ClubHubCloud,{isStaffAccount:()=>true,actingAsParent:()=>true,realRole:()=> 'club_admin'});renderTeamIdentity();});
  assert.equal(await page.locator('#hero-mode-pill').innerText(),'Parent');assert.equal(await page.locator('#hero-profile-switch').isVisible(),false);assert.equal(await page.locator('#hero-team-switch').isVisible(),false);
  await seed('admin','dark',320,2,true);
  await page.evaluate(()=>{currentView='add';__matchFormDirty=true;});
  page.once('dialog',d=>d.dismiss());await page.locator('#hero-profile-switch').click();
  assert.equal(await page.evaluate(()=>adminUiMode),'club');assert.equal(await page.evaluate(()=>__matchFormDirty),true);
  await seed('coach','light',393);
  await page.evaluate(()=>{window.ClubHubCloud.switchMyCoachTeam=id=>{window.__heroCalls.push(id);return new Promise(r=>window.__finishHeroSwitch=r);};});
  await page.locator('#hero-team-switch').selectOption('other-team');
  assert(await page.locator('#hero-team-switch').isDisabled());assert.match(await page.locator('#hero-team-status').innerText(),/Switching team/);
  assert.deepEqual(await page.evaluate(()=>window.__heroCalls),['other-team']);
  const reloaded=page.waitForEvent('framenavigated');await page.evaluate(()=>window.__finishHeroSwitch());await reloaded;
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({results,errors},null,2));
  console.log('PASS hero context: themes/viewports, dual Admin, multi-team coach/assistant, single team, denied roles, failed switch rollback, role/team unsaved cancellation, retry, enlarged text, pending lock and successful reload');
 }catch(e){await page.screenshot({path:path.join(out,'failed-check.png'),fullPage:true});throw e;}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
