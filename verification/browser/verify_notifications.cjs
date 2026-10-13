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
  __notificationScopeKey='';__appNotifications=[];__notificationStamp=0;__announcementRows=[];renderAll();navigate('home',false);renderNotificationCenter();
 },{theme,admin});await page.evaluate(()=>document.fonts.ready);
}
async function checks(page,width,theme){
 await prepare(page,width,theme);
 const bell=page.locator('#notification-bell');assert(await bell.isVisible(),'hero bell stays visible on phones');
 const geometry=await bell.evaluate(el=>{const b=el.getBoundingClientRect(),h=el.closest('.hero').getBoundingClientRect(),copy=document.querySelector('.hero-copy').getBoundingClientRect();return {bell:b.toJSON(),hero:h.toJSON(),copy:copy.toJSON(),overflow:document.documentElement.scrollWidth>innerWidth};});
 assert.equal(geometry.overflow,false);assert(geometry.bell.width>=44&&geometry.bell.height>=44);assert(geometry.bell.right<=geometry.hero.right&&geometry.bell.top>=geometry.hero.top);assert(geometry.copy.right-56<=geometry.bell.left+1,'hero copy reserves room for corner bell');
 await page.screenshot({path:path.join(out,'hero-'+width+'-'+theme+'.png'),fullPage:false});
 await bell.click();await page.waitForFunction(()=>document.querySelectorAll('#notification-list .notification-item').length===2);
 assert.match(await bell.getAttribute('aria-label'),/2 unread/);assert.equal(await page.evaluate(()=>__notesFixture.marks.length),0,'opening never marks read');
 const modal=page.locator('#notification-dialog');assert(await modal.isVisible());
 const bounds=await modal.evaluate(el=>({overflow:el.scrollWidth>el.clientWidth+1,box:el.getBoundingClientRect().toJSON(),surface:getComputedStyle(el).backgroundColor,item:getComputedStyle(el.querySelector('.notification-item')).backgroundColor,copy:getComputedStyle(el.querySelector('.notification-item p')).color,buttons:[...el.querySelectorAll('button')].filter(n=>n.getBoundingClientRect().height).map(n=>n.getBoundingClientRect().height)}));
 assert.equal(bounds.overflow,false);assert(bounds.box.width<=width&&bounds.box.height<=900);assert(bounds.buttons.every(h=>h>=44));assert.notEqual(bounds.surface,bounds.copy);
 for(let i=0;i<14;i++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.getElementById('notification-dialog').contains(document.activeElement)),'native dialog traps keyboard focus');}
 await page.screenshot({path:path.join(out,'notifications-'+width+'-'+theme+'.png'),fullPage:false});
 await page.evaluate(()=>__notesFixture.failRead=true);await page.locator('#notifications-mark-all').click();await page.waitForFunction(()=>document.getElementById('notification-status').textContent.includes('Some updates'));
 assert.match(await page.locator('#notification-unread').innerText(),/1 unread/);await page.screenshot({path:path.join(out,'partial-read-'+width+'-'+theme+'.png'),fullPage:false});
 await page.evaluate(()=>__notesFixture.failRead=false);await page.locator('#notifications-mark-all').click();await page.waitForFunction(()=>document.getElementById('notification-unread').textContent==='All caught up');
 assert.deepEqual(await page.evaluate(()=>__notesFixture.marks),['fixture-a','fixture-b','fixture-b']);assert.equal(await page.locator('#notifications-mark-all').isVisible(),false);
 await page.locator('.notification-close').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'notification-bell');
 await page.evaluate(()=>{__notesFixture.rows=[];__notesFixture.failLoad=true;__appNotifications=[];__notificationStamp=0;});await bell.click();await page.waitForFunction(()=>document.getElementById('notification-list').textContent.includes('Could not load'));
 assert.doesNotMatch(await page.locator('#notification-list').innerText(),/No notifications yet/);await page.screenshot({path:path.join(out,'load-error-'+width+'-'+theme+'.png'),fullPage:false});
 await page.evaluate(()=>__notesFixture.failLoad=false);await page.locator('#notifications-refresh').click();await page.waitForFunction(()=>document.getElementById('notification-list').textContent.includes('No notifications yet'));
 await page.screenshot({path:path.join(out,'empty-'+width+'-'+theme+'.png'),fullPage:false});await page.locator('.notification-close').click();
 return {width,theme,geometry,bounds};
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 const results=[];
 try{
  for(const theme of ['dark','light'])for(const width of [320,393,1024])results.push(await checks(page,width,theme));
  await prepare(page,393,'dark',true);await page.locator('#notification-bell').click();await page.waitForFunction(()=>currentView==='inbox'&&__communicationsTab==='notifications');assert.equal(await page.locator('#notification-dialog').isVisible(),false,'Admin retains communications destination');await page.screenshot({path:path.join(out,'admin-notifications-dark.png'),fullPage:true});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({results,errors},null,2));console.log('PASS built notifications: hero corner, phones/wider, both themes, open without read, focus, partial writes, errors/retry/empty and Admin destination');
 }catch(e){await page.screenshot({path:path.join(out,'failed-check.png'),fullPage:true});throw e;}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

