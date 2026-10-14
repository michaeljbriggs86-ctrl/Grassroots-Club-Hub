// Actual built app; fictional club/teams only, with all external requests blocked.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'cup-freshness-review');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/cloud-config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://fictional.supabase.co",anonKey:"fictional-only-no-credentials-00000000000000000000000000"};');}
 if(url.pathname.startsWith('/data/')){res.setHeader('Content-Type','application/json');return res.end('{"clubs":[],"age_groups":[]}');}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
let base;
async function checks(page,width,theme,role){
 await page.setViewportSize({width,height:900});await page.goto(base+'/');await page.waitForFunction(()=>typeof renderAll==='function');
 await page.evaluate(async({theme,role})=>{
  applyTheme(theme);document.getElementById('app-splash')?.remove();document.body.classList.remove('splash-active','auth-open');document.getElementById('activation-gate').classList.add('hidden');document.querySelector('.app-shell').classList.remove('account-locked');
  account={role,user:'Fictional reviewer'};currentRole=role;adminUiMode=role==='admin'?'club':'team';
  const team={id:'fictional-team',ageGroup:'U12',teamName:'Example Greens',leagueName:'Shooters Hill AFC Example Greens',division:'Example division'};
  const api=window.ClubHubCloud;
  Object.defineProperty(api,'session',{configurable:true,value:{user:{id:'fictional-user'}}});
  Object.defineProperty(api,'context',{configurable:true,value:{profile:{user_id:'fictional-user',club_id:'fictional-club',role}}});
  Object.assign(api,{currentTeam:()=>team,role:()=>currentRole,canEdit:()=>true,actingAsParent:()=>false,visibleTeamList:()=>[team],getClubOverview:async()=>[{team,state:{matches:[]}}],listMessageContacts:async()=>[],listClubMessages:async()=>[],listAnnouncements:async()=>[],listNotifications:async()=>[]});
  state=normalizeState({meta:{clubName:'Shooters Hill AFC',teamName:'Example Greens',ageGroup:'U12',season:'2026/27'},squad:[],matches:[],goals:[],awards:[]});
  window.__cupFeed={schema_version:2,provider:'Selkent',last_updated:'2026-10-14T19:00:00Z',cup_results_status:'stale_retained',cup_results_last_updated:'2026-10-12T13:49:27Z',coverage:{published_results:{parser_status:'verified_scored_rows_v1',cup_parser_status:'verified_cup_scored_rows_v1'}},age_groups:[{age_group:'U12',standings:[],published_results:[{date:'2026-10-11',home:'Shooters Hill AFC Example Greens',away:'Example Blues',homeGoals:2,awayGoals:1,competition:'Selkent Cup One',round:'Round One',provider_cup_id:'cupCombined6-1',provider_match_ref:'A'}]}]};
  window.ClubHubStaticSelkent.loadResults=async()=>__cupFeed;
  window.ClubHubStaticSelkent.loadDirectory=async()=>({leagues:[]});
  __adminPublishedFeed=null;__clubResultsStamp=0;__clubResultsWeekend='2026-10-10';__clubResultsCompetition='cup';
  renderAll();navigate('club',false);setClubTab('results');await refreshClubResults(false);
 },{theme,role});await page.evaluate(()=>document.fonts.ready);
 const status=page.locator('#club-results-source-status');await status.waitFor({state:'visible'});
 assert.match(await status.innerText(),/Cup results could not refresh.*12 Oct.*14:49/);
 assert.match(await page.locator('#club-results-list').innerText(),/Example Blues/);
 for(const zoom of [100,200]){
  await page.evaluate(zoom=>document.documentElement.style.fontSize=zoom+'%',zoom);
  const bounds=await status.evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect(),next=document.getElementById('club-results-list').getBoundingClientRect();return{width:r.width,left:r.left,right:r.right,parentLeft:p.left,parentRight:p.right,bottom:r.bottom,nextTop:next.top,text:el.textContent};});
  assert(bounds.left>=bounds.parentLeft-1&&bounds.right<=bounds.parentRight+1,'warning fits the content width');
  assert(bounds.bottom<=bounds.nextTop+1,'warning reflows without overlapping result rows');
  await page.screenshot({path:path.join(out,`${role}-${theme}-${width}-${zoom}.png`),fullPage:true});
 }
 await page.evaluate(async()=>{__cupFeed.cup_results_status='verified_current';await refreshClubResults(false);});
 assert.equal(await status.textContent(),'','successful recovery clears the warning');
 assert.match(await page.locator('#club-results-list').innerText(),/Example Blues/,'recovery keeps cup rows visible');
 await page.evaluate(async()=>{__cupFeed=null;__adminPublishedFeed=null;await refreshClubResults(false);});
 assert.match(await status.innerText(),/Selkent feed unavailable/,'existing unavailable state remains');
 return{role,theme,width,staleDate:'12 Oct, 14:49',recovery:true};
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});const results=[];
 try{for(const role of ['coach','admin'])for(const theme of ['dark','light'])for(const width of [320,393,1024]){
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  results.push(await checks(page,width,theme,role));assert.deepEqual(errors,[],'no browser errors');await page.close();
 }fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(results,null,2));console.log('PASS built cup freshness states:',results.length,'role/theme/viewport flows at ordinary and 200% text');}
 finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
