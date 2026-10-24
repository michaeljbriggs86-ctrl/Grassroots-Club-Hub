// Matches lead-card regression: built assets, native renderers and controls.
// All review data is fictional. External requests are intercepted; no account,
// message, calendar service or production data is used. Run build.py first.
// node verification/browser/verify_matches_scene.cjs [playwright-module] [out]
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'matches-scene-review');
fs.mkdirSync(out,{recursive:true});let base;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/cloud-config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://fictional.supabase.co",anonKey:"fictional-only-no-credentials-00000000000000000000000000"};');}
 if(url.pathname.startsWith('/data/')){res.setHeader('Content-Type','application/json');return res.end('{"clubs":[],"age_groups":[],"fixtures":[]}');}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
// Reuse the established role/API fixture setup, not a replacement card renderer.
const harness=fs.readFileSync(path.resolve('verification/browser/verify_shared_components.cjs'),'utf8');
const prepare=eval('('+harness.slice(harness.indexOf('async function prepare('),harness.indexOf('async function seedResults(')).trim()+')');
const matrix=[];
for(const theme of ['dark','light']){
 for(const width of [320,393,768,1440])for(const confirmed of [false,true])matrix.push({name:confirmed?'coach-confirmed':'coach-unconfirmed',role:'coach',confirmed,width,theme});
 for(const confirmed of [false,true])matrix.push({name:confirmed?'parent-confirmed':'parent-unconfirmed',role:'parent',confirmed,width:393,theme});
 for(const width of [320,393,1440])matrix.push({name:'coach-cup',role:'coach',confirmed:true,cup:true,width,theme});
 matrix.push({name:'parent-cup',role:'parent',confirmed:true,cup:true,width:393,theme});
 for(const width of [320,393,1440]){
  matrix.push({name:'manual-friendly',role:'coach',confirmed:true,manual:true,width,theme});
  matrix.push({name:'long-names',role:'coach',confirmed:true,long:true,width,theme});
 }
 matrix.push({name:'coach-text200',role:'coach',confirmed:true,zoom:true,width:320,theme});
}
async function customise(page,scenario){
 await page.evaluate(scenario=>{
  if(scenario.cup){
   state.selkent.fixtures=[{date:'2099-10-25',opponent:'Example Gunners',competition:'Selkent Cup One',venue:'H',time:''},{date:'2099-10-25',opponent:'Example Rovers',competition:'Selkent Cup One',venue:'A',time:''}];
   state.selkent.fixtureOverrides={};
   for(const fixture of state.selkent.fixtures)state.selkent.fixtureOverrides[fixtureKitSelectionKey(fixture)]={time:'10:30',groundName:'Example Playing Fields',address:'Fictional public ground address',confirmedAt:'2026-10-22T11:00:00Z'};
  }
  if(scenario.manual)state.matches=[{id:'fictional-earlier-friendly',date:'2099-10-20',opponent:'Meadow United',competition:'Friendly',venue:'H',status:'scheduled',time:'09:45',groundName:'Example Recreation Ground',address:'Fictional public ground address'}];
  if(scenario.long){
   state.meta.teamName='Example Greens Community Football Club';state.division.teamName=state.meta.teamName;
   const f=state.selkent.fixtures[0];f.opponent='Example Gunners and Rovers Junior Athletic';
   state.selkent.fixtureOverrides={};state.selkent.fixtureOverrides[fixtureKitSelectionKey(f)]={time:'10:30',groundName:'Example Community Recreation and Sports Playing Fields',address:'Fictional public playing field address near the community pavilion entrance',confirmedAt:'2026-10-22T11:00:00Z'};
  }
  renderAll();navigate('matches',false);if(scenario.zoom)document.documentElement.style.fontSize='200%';
 },scenario);
 await page.evaluate(()=>document.fonts.ready);
}
async function measure(page){
 return page.evaluate(()=>{
  const card=document.getElementById('matches-next-fixture');
  const visible=el=>!!el&&!el.hidden&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0;
  const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const style=el=>{const s=getComputedStyle(el);return{...rect(el),background:s.backgroundImage,backgroundColor:s.backgroundColor,borderWidths:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],shadow:s.boxShadow,color:s.color,font:s.fontFamily,fontSize:s.fontSize};};
  const surfaces=['#matches-next-versus','#matches-next-fixture .fixture-date-with-calendar','#matches-next-fixture>.match-venue-card'].map(selector=>({selector,...style(document.querySelector(selector))}));
  const buttons=[...card.querySelectorAll('button')].filter(visible).map(el=>({id:el.id,text:el.textContent.trim(),...style(el)}));
  const nodes=[card,...card.querySelectorAll('*')];
  const sceneImages=nodes.flatMap(el=>[getComputedStyle(el).backgroundImage,getComputedStyle(el,'::before').backgroundImage,getComputedStyle(el,'::after').backgroundImage]).filter(s=>s.includes('pitch-portrait.webp')||s.includes('pitch-wide.webp'));
  const headerScene=getComputedStyle(document.querySelector('.app-shell'),'::before').backgroundImage;
  const badges=[...card.querySelectorAll('.canonical-v11-badge')].map(el=>({...style(el),image:el.querySelector('img')?.getAttribute('src')}));
  const matchups=[...card.querySelectorAll('.canonical-v11-teams')].map(el=>({versus:rect(el.querySelector('.canonical-v11-v')),badges:[...el.querySelectorAll('.canonical-v11-badge')].map(rect)}));
  const names=[...card.querySelectorAll('.canonical-v11-side strong')].map(el=>({text:el.textContent,...style(el)}));
  const sceneCopy=[...card.querySelectorAll('.panel-heading .kicker,.panel-heading h3,.canonical-v11-label,.canonical-v11-v,.fixture-date-copy span,#matches-next-when')].filter(visible).map(el=>({text:el.textContent.trim(),...style(el)}));
  const calendar=document.getElementById('matches-next-calendar'),map=document.getElementById('matches-next-map-preview');
  const f=nextPublishedFixture();
  return{viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,cardVisible:visible(card),placeholderVisible:visible(document.getElementById('parent-matches-placeholder')),card:style(card),surfaces,buttons,sceneImages,headerScene,badges,matchups,names,sceneCopy,labels:[...card.querySelectorAll('.canonical-v11-label')].map(el=>el.textContent.trim()),rows:card.querySelectorAll('.canonical-v11-fixture').length,shareVisible:visible(document.getElementById('matches-next-share')),playedVisible:visible(document.getElementById('matches-next-played')),copyVisible:visible(document.getElementById('matches-next-copy')),calendar:{visible:visible(calendar),hidden:calendar.hidden,classes:calendar.className},mapVisible:visible(map),mapSrc:document.getElementById('matches-next-map-frame').getAttribute('src'),when:document.getElementById('matches-next-when').textContent,ground:document.getElementById('matches-next-ground').textContent,nextFixture:f?{date:f.date,opponent:f.opponent,competition:f.competition}:null};
 });
}
function check(s,m){
 const label=`${s.name}-${s.width}-${s.theme}`;
 assert(m.documentWidth<=m.viewport+1,label+': page reflows');
 assert.equal(m.cardVisible,s.role!=='parent'||s.confirmed,label+': existing confirmed-parent gate');
 assert.equal(m.placeholderVisible,s.role==='parent'&&!s.confirmed,label+': unconfirmed parent placeholder');
 if(!m.cardVisible)return;
 assert(m.sceneImages.length,label+': approved field photograph is present on card');
 assert(m.sceneImages.some(s=>s.includes('/graphics/match-pitch-portrait.webp')),label+': fixture uses the approved distinct touchline image');
 assert(m.headerScene.includes('/graphics/pitch-wide.webp')&&!m.headerScene.includes('match-pitch-portrait.webp'),label+': original masthead photograph remains distinct');
 for(const surface of m.surfaces){
  assert.equal(surface.background,'none',label+': information remains open '+surface.selector);
  assert.equal(surface.backgroundColor,'rgba(0, 0, 0, 0)',label+': no inset fill '+surface.selector);
  assert.equal(surface.shadow,'none',label+': no inset panel shadow '+surface.selector);
  assert(surface.borderWidths.filter(v=>parseFloat(v)>0).length<=1,label+': divider rather than enclosed panel '+surface.selector);
 }
 assert.equal(m.rows,s.cup?2:1,label+': original canonical matchup count');
 if(s.cup)assert.deepEqual(m.labels,['Group game','Group game'],label+': both native Cup labels remain');
 assert.equal(m.badges.length,m.rows*2,label+': two unchanged crest slots per fixture');
 for(const badge of m.badges){assert(badge.width>=72&&badge.height>=72,label+': raised legible crest');assert(badge.shadow!=='none',label+': crest depth');}
 for(const matchup of m.matchups){
  const centres=[matchup.versus,...matchup.badges].map(r=>r.y+r.height/2);
  assert(Math.max(...centres)-Math.min(...centres)<=4,label+': crests and versus share one visual centre');
 }
 for(const name of m.names){
  assert(/Barlow Condensed|Anton/.test(name.font),label+': graphic team typography');
  assert(name.x>=m.card.x-1&&name.right<=m.card.right+1,label+': team name stays within card');
  assert(parseFloat(name.fontSize)>=22,label+': team name remains legible');
  assert.equal(name.color,'rgb(255, 255, 255)',label+': team name contrasts with field photograph');
 }
 for(const copy of m.sceneCopy)assert.equal(copy.color,'rgb(255, 255, 255)',label+': photo text stays readable '+copy.text);
 for(const button of m.buttons){assert(button.width>=43&&button.height>=43,label+': touch target '+button.id);assert(button.x>=m.card.x-1&&button.right<=m.card.right+1,label+': action reflow '+button.id);}
 assert.equal(m.shareVisible,s.role==='coach',label+': share stays coach-only');
 assert.equal(m.playedVisible,false,label+': future result action remains hidden');
 assert.equal(m.copyVisible,false,label+': hidden legacy action remains hidden');
 // Calendar's original hidden class stays authoritative; no styling revives it.
 assert(m.calendar.classes.includes('hidden')&&!m.calendar.visible,label+': original calendar visibility');
 assert.equal(m.mapVisible,s.confirmed,label+': venue map follows existing confirmation data');
 if(s.confirmed){assert(m.when.includes(s.manual?'09:45':'10:30'),label+': confirmed time');assert(m.mapSrc?.includes('maps'),label+': native map URL');}
 else{assert(m.when.includes('TBC'),label+': unconfirmed time');assert.equal(m.ground,'Venue TBC',label+': unconfirmed venue');}
 if(s.manual)assert.deepEqual(m.nextFixture,{date:'2099-10-20',opponent:'Meadow United',competition:'Friendly'},label+': chronological manual fixture preserved');
}
async function interact(page,s){
 await page.locator('#matches-next-details').click();await page.locator('#next-fixture-dialog').waitFor({state:'visible'});
 assert(await page.locator('#next-match-versus').isVisible(),'native match detail graphic opens');
 assert.equal(await page.locator('#next-match-share').isVisible(),s.role==='coach','dialog sharing retains role gate');
 await page.locator('#next-fixture-dialog [data-close-dialog]').first().click();
 assert(!await page.locator('#next-fixture-dialog').isVisible(),'native close returns to Matches');
 if(s.role==='coach'){
  await page.evaluate(()=>{window.__matchesShares=[];window.ClubHubNative={shareMatchCard:(data,caption)=>__matchesShares.push({prefix:data.slice(0,22),caption})};});
  await page.locator('#matches-next-share').click();
  await page.waitForFunction(()=>window.__matchesShares.length===1);
  const share=await page.evaluate(()=>window.__matchesShares[0]);
  assert.equal(share.prefix,'data:image/png;base64,','native share still renders actual PNG');
  assert(share.caption.includes('Example Playing Fields')&&share.caption.includes('10:30'),'share retains fixture information');
 }
}
async function manualShare(page){
 await page.locator('[data-scroll-to="friendly-match-section"]').click();
 await page.locator('[data-details-match="fictional-earlier-friendly"]').first().click();
 await page.locator('#match-detail-dialog').waitFor({state:'visible'});
 assert(await page.locator('#share-match-detail').isVisible(),'manually created fixture retains share action');
 await page.evaluate(()=>{window.__manualShares=[];window.ClubHubNative={shareMatchCard:(data,caption)=>__manualShares.push({prefix:data.slice(0,22),caption})};});
 await page.locator('#share-match-detail').click();await page.waitForFunction(()=>window.__manualShares.length===1);
 const share=await page.evaluate(()=>window.__manualShares[0]);
 assert.equal(share.prefix,'data:image/png;base64,','manual fixture still produces PNG');
 assert(share.caption.includes('Meadow United')&&share.caption.includes('09:45'),'manual share uses selected fixture details');
 await page.locator('#match-detail-dialog [data-close-dialog]').first().click();
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const cases=[],errors=[],externalWrites=[];
 try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base)return route.continue();if(route.request().method()!=='GET')externalWrites.push({method:route.request().method(),url:u.origin+u.pathname});return route.fulfill({status:200,contentType:u.hostname==='www.google.com'?'text/html':'application/json',body:u.hostname==='www.google.com'?'<!doctype html><body>Fictional public venue map</body>':'[]'});});
  for(const scenario of matrix){
   await prepare(page,scenario.role,scenario.width,scenario.theme,scenario.confirmed);await customise(page,scenario);
   const m=await measure(page);check(scenario,m);
   const label=`${scenario.name}-${scenario.width}-${scenario.theme}`;
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,label+'.png'),fullPage:true});
   if(m.cardVisible)await page.locator('#matches-next-fixture').screenshot({path:path.join(out,label+'-card.png')});
   if(scenario.width===393&&scenario.theme==='dark'&&['coach-confirmed','parent-confirmed'].includes(scenario.name))await interact(page,scenario);
   if(scenario.width===393&&scenario.theme==='dark'&&scenario.manual)await manualShare(page);
   cases.push({...scenario,...m});console.log('PASS '+label);
  }
  assert.deepEqual(errors,[],'no runtime errors');assert.deepEqual(externalWrites,[],'no external writes');
  console.log(`PASS Matches restoration: ${cases.length} native built layouts; role gates, Cup labels, chronological manual fixture, details and PNG share.`);
 }finally{
  const hashes=Object.fromEntries(['app.js','index.html','shared-surfaces.css','service-worker.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
  fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({date:new Date().toISOString(),assetRoot:root,hashes,cases,errors,externalWrites},null,2));
  await browser.close();server.close();
 }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
