// Actual built assets and native routes, with fictional in-memory API data only.
// Run after cloudflare/web-app/build.py. External services are blocked.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'friendly-details-review');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/cloud-config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://fictional.supabase.co",anonKey:"fictional-only-no-credentials-00000000000000000000000000"};');}
 if(url.pathname.startsWith('/data/')){res.setHeader('Content-Type','application/json');return res.end('{"clubs":[],"age_groups":[],"fixtures":[]}');}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
// Exercise the built form with fictional data and blocked external services.
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.PITCHKIND_CHROMIUM||'/tmp/chromium',args:['--no-sandbox']});
 const page=await browser.newPage(),errors=[],writes=[],dialogs=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base)return route.continue();if(route.request().method()!=='GET')writes.push(u.origin+u.pathname);return route.fulfill({status:200,contentType:'application/json',body:'[]'});});
 try{
  for(const theme of ['dark','light'])for(const width of [320,393,768,1440]){
   await page.setViewportSize({width,height:900});await page.goto(base+'/');
   await page.waitForFunction(()=>typeof renderAll==='function');
   await page.evaluate(({theme})=>{
    applyTheme(theme);document.querySelector('#app-splash')?.remove();document.body.classList.remove('splash-active','auth-open');document.querySelector('#activation-gate').classList.add('hidden');document.querySelector('.app-shell').classList.remove('account-locked');
    currentRole='coach';adminUiMode='team';account={role:'coach',user:'Fictional reviewer'};
    window.__friendly={saved:null,fail:false};const api=window.ClubHubCloud;
    Object.assign(api,{role:()=>currentRole,realRole:()=>currentRole,actingAsParent:()=>false,isStaffAccount:()=>true,canAdmin:()=>false,canEdit:()=>true,currentTeam:()=>({id:'fictional-team',teamName:'Example Greens',ageGroup:'U9'}),visibleTeamList:()=>[],listMyCoachTeams:async()=>[],listTeamMembers:async()=>[],listParentPlayerLinks:async()=>[],listPlayerAccountLinks:async()=>[],listAnnouncements:async()=>[],listNotifications:async()=>[],listPlayerAppearanceStats:async()=>[],listMessageContacts:async()=>[],listClubMessages:async()=>[],listMatchAttendance:async()=>[],getCoachMatchNote:async()=>null,listMatchAvailability:async()=>[],getKickoffPushSettings:async()=>({available:false}),queueStateSave:()=>{},recordAuditEvent:async()=>{},confirmStateSave:async s=>{if(__friendly.fail)throw Error('Fictional offline');__friendly.saved=JSON.parse(JSON.stringify(s));},listSelkentTeamDirectory:async()=>[{id:'example-opponent',club_name:'Example United',display_name:'Example United',team_label:'Under 9',age_variant:'U9'}]});
    fetchClubDirectoryDetails=async()=>({});refreshFixtureOverviewDirectory=()=>{};refreshMatchOverviewDirectory=()=>{};
    CLUB_CONFIGURATION={settings:{...UNIVERSAL_FALLBACK_SETTINGS,display_name:'Shooters Hill AFC',default_provider_key:'selkent'},providers:[{provider_key:'selkent',provider_type:'selkent',is_primary:true,enabled:true,config:{}}],rules:[],teams:[]};
    state=normalizeState({meta:{clubName:'Shooters Hill AFC',teamName:'Example Greens',ageGroup:'U9',season:'2026/27'},division:{name:'Under 9 Example',teamName:'Example Greens'},selkent:{enabled:false,fixtures:[]},squad:[],matches:[],goals:[],awards:[]});
    renderAll();openNewMatchForCompetition('Friendly');
   },{theme});
   await page.locator('#match-opponent').selectOption('Example United');
   await page.locator('#match-date').fill('2099-10-25');await page.locator('#match-venue').selectOption('N');
   await page.locator('#match-time').fill('10:30');await page.locator('#match-ground-name').fill('Example Playing Fields');await page.locator('#match-address').fill('Fictional ground address');
   const geometry=await page.evaluate(()=>({width:innerWidth,doc:document.documentElement.scrollWidth,fields:['match-time','match-ground-name','match-address'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {id,x:r.x,right:r.right,height:r.height};})}));
   assert(geometry.doc<=width+1,'no horizontal overflow');for(const f of geometry.fields){assert(f.x>=0&&f.right<=width+1,'field within viewport');assert(f.height>=44,'field touch target');}
   if(width===393)await page.screenshot({path:path.join(out,'friendly-form-'+theme+'.png'),fullPage:true});
   await page.locator('#match-form button[type=submit]').click();await page.waitForFunction(()=>currentView==='matches'&&!!__friendly.saved);
   const match=await page.evaluate(()=>__friendly.saved.matches[0]);assert.equal(match.time,'10:30');assert.equal(match.groundName,'Example Playing Fields');assert.equal(match.address,'Fictional ground address');assert.equal(match.status,'scheduled');assert.equal(match.venue,'N');
   // Rehydrate the actual saved payload, then use the native Edit action.
   await page.evaluate(()=>{state=normalizeState(__friendly.saved);renderAll();openMatchDetails(state.matches[0].id);});
   assert.match(await page.locator('#match-detail-summary').innerText(),/Kick-off 10:30/);assert.equal(await page.locator('#match-detail-ground').innerText(),'Example Playing Fields');
   await page.locator('#edit-match-detail').click();
   assert.equal(await page.locator('#match-time').inputValue(),'10:30');assert.equal(await page.locator('#match-ground-name').inputValue(),'Example Playing Fields');assert.equal(await page.locator('#match-address').inputValue(),'Fictional ground address');
   await page.locator('#match-time').fill('11:15');await page.locator('#match-ground-name').fill('Other Example Field');
   if(width===393&&theme==='dark'){
    await page.evaluate(()=>{__friendly.fail=true;});await page.locator('#match-form button[type=submit]').click();await page.waitForFunction(()=>!__matchSubmissionInFlight);assert.equal(await page.locator('#match-time').inputValue(),'11:15');assert.equal(await page.locator('#match-ground-name').inputValue(),'Other Example Field');assert.match(dialogs.at(-1),/has not synced/);await page.evaluate(()=>{__friendly.fail=false;});
   }
   await page.locator('#match-form button[type=submit]').click();await page.waitForFunction(()=>currentView==='matches');
   const projected=await page.evaluate(()=>buildAdminFixtureRows([{team:{id:'fictional-team',ageGroup:'U9',teamName:'Example Greens'},state:__friendly.saved}],null)[0]);assert.equal(projected.time,'11:15');assert.equal(projected.groundName,'Other Example Field');assert.equal(projected.address,'Fictional ground address');
   await page.evaluate(()=>editMatch(state.matches[0].id));for(const id of ['match-time','match-ground-name','match-address'])await page.locator('#'+id).fill('');await page.locator('#match-form button[type=submit]').click();await page.waitForFunction(()=>currentView==='matches');
   const cleared=await page.evaluate(()=>__friendly.saved.matches[0]);for(const key of ['time','groundName','address'])assert.equal(cleared[key],'','can clear unknown details');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('PASS built friendly form: create, cloud payload, rehydrate/edit, detail display, admin projection, clearing TBC, retained retry; 320/393/768/1440 in dark/light; no external writes.');
 }finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({errors,writes,dialogs},null,2));await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
