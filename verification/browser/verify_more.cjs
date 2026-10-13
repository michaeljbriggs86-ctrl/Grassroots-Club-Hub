// Render the built app using fictional state; never contact authenticated services.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'more-browser-review');
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
 const browser=await chromium.launch({headless:true,...(process.env.PITCHKIND_CHROMIUM?{executablePath:process.env.PITCHKIND_CHROMIUM}:{}),args:['--no-sandbox']});
 const page=await browser.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 try{
  for(const theme of ['dark','light'])for(const width of [320,393,1024])for(const role of ['admin','coach','assistant_coach','parent','player']){
   await prepare(page,role,width,theme);
   await page.locator(width<=900?'[data-mobile-tab="more"]':'[data-nav="more"]').click();
   assert.equal(await page.evaluate(()=>currentView),'more');assert.equal(await page.locator('#more-title').innerText(),'More');
   assert.equal(await page.locator('#mobile-more-sheet').count(),0,'More does not open an intermediate dialog');
   const bounds=await geometry(page,'#view-more');assert.equal(bounds.pageOverflow,false);assert.equal(bounds.localOverflow,false);assert(bounds.buttons.every(b=>b.height>=44));assert.match(bounds.font,/Inter/);
   const routes=await page.locator('#view-more [data-page-route]:visible').evaluateAll(nodes=>nodes.map(n=>n.dataset.pageRoute));
   if(['parent','player'].includes(role))assert(routes.every(r=>['appearance','my-account','contacts','raise-concern'].includes(r)));
   if(role==='player'){assert.deepEqual(routes,['appearance','my-account']);assert.equal(await page.locator('#mobile-notification-bell').isVisible(),false);assert.equal(await page.locator('#mobile-context-switch').isVisible(),false);}
   if(role==='admin')assert(routes.includes('coach-documents')&&routes.includes('season-control')&&routes.includes('app-access'));
   if(['coach','assistant_coach'].includes(role))assert(routes.includes('training-settings')&&routes.includes('feature-settings')&&!routes.includes('season-control'));
   await page.screenshot({path:path.join(out,role+'-'+width+'-'+theme+'.png'),fullPage:true});
   await page.locator('#view-more [data-page-route="appearance"]').click();
   assert.equal(await page.evaluate(()=>currentView),'appearance');assert.equal(await page.locator('#appearance-settings').evaluate(el=>el.open),true);assert(await page.locator('#appearance-theme').isVisible());
   const settings=await geometry(page,'#view-appearance');assert.equal(settings.pageOverflow,false);assert.equal(settings.localOverflow,false);
   await page.locator('#appearance-theme').selectOption(theme==='dark'?'light':'dark');
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme==='dark'?'light':'dark');
   await page.locator('#view-appearance [data-page-route="more"]').click();assert.equal(await page.evaluate(()=>currentView),'more');
   await page.locator('#view-more [data-page-route="my-account"]').click();assert(await page.locator('#access-panel').isVisible());
   await page.locator('#view-my-account [data-page-route="more"]').click();
   if(['coach','assistant_coach'].includes(role)){
    await page.locator('#view-more [data-page-route="training-settings"]').click();assert(await page.locator('#training-weekly-form').isVisible());assert.equal((await geometry(page,'#view-training-settings')).pageOverflow,false);
    await page.locator('#view-training-settings [data-page-route="more"]').click();
    await page.locator('#view-more [data-page-route="feature-settings"]').click();assert(await page.locator('#save-feature-settings').isVisible());
    await page.locator('#view-feature-settings [data-page-route="more"]').click();
    await page.evaluate(()=>{state.features.awards=false;renderFeatureSettings();syncMobileNavigation();});
    assert.equal(await page.locator('[data-more-awards]').isVisible(),false);
   }
   if(role==='admin'){
    await page.locator('#view-more [data-page-route="season-control"]').click();assert(await page.locator('#archive-current-season').isVisible());
    await page.locator('#view-season-control [data-page-route="more"]').click();
    await page.locator('#view-more [data-page-route="club-compliance"]').click();assert(await page.locator('#compliance-welfare-name').isVisible());
    await page.locator('#view-club-compliance [data-page-route="more"]').click();
   }
   if(['parent','player'].includes(role))for(const forbidden of ['training-settings','feature-settings','season-control','club-compliance']){await page.evaluate(route=>navigate(route,false),forbidden);assert.notEqual(await page.evaluate(()=>currentView),forbidden);}
   results.push({role,width,theme,routes,bounds});
  }
  await prepare(page,'admin',393,'dark');await page.evaluate(()=>{adminUiMode='view';renderAll();navigate('more',false);});
  assert.equal(await page.locator('#view-more [data-more-role="admin"]').first().isVisible(),false);assert.equal(await page.locator('#view-more [data-more-role="coach"]').first().isVisible(),false);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({results,errors},null,2));
  console.log('PASS: 30 role/theme/viewport More flows, settings/back links, appearance, retained forms, direct-route denial and read-only context');
 }catch(e){await page.screenshot({path:path.join(out,'failed-check.png'),fullPage:true});throw e;}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
