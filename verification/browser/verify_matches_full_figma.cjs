// Original full Matches/preparation (490:10237/10268) and Sunday dialog519:10559.
// Exercise the real built app with fictional API state; never inject CSS or write
// to production. Run build.py first; pass Playwright module and output directory.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'matches-full-figma-review');
fs.mkdirSync(out,{recursive:true});let base;
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/cloud-config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://fictional.supabase.co",anonKey:"fictional-only-no-credentials-00000000000000000000000000"};');}
 if(u.pathname.startsWith('/data/')){res.setHeader('Content-Type','application/json');return res.end('{"clubs":[],"age_groups":[],"fixtures":[]}');}
 const file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
const harness=fs.readFileSync('verification/browser/verify_shared_components.cjs','utf8');
const prepare=eval('('+harness.slice(harness.indexOf('async function prepare('),harness.indexOf('async function seedResults(')).trim()+')');
const leadHarness=fs.readFileSync('verification/browser/verify_matches_scene.cjs','utf8');
const nativeCustomise=eval('('+leadHarness.slice(leadHarness.indexOf('async function customise('),leadHarness.indexOf('async function measure(')).trim()+')');
const matrix=[];
for(const theme of ['dark','light']){
 for(const width of [393,320,768,1440])for(const confirmed of [true,false])matrix.push({name:confirmed?'confirmed':'unconfirmed',role:'coach',confirmed,width,theme,venue:'H'});
 for(const venue of ['A','N'])matrix.push({name:venue==='A'?'away':'neutral',role:'coach',confirmed:true,width:393,theme,venue});
 for(const width of [320,393,1440])matrix.push({name:'cup',role:'coach',confirmed:true,cup:true,width,theme});
 matrix.push({name:'cup-tbc',role:'coach',confirmed:false,cup:true,width:393,theme});
 for(const confirmed of [true,false])matrix.push({name:confirmed?'parent-confirmed':'parent-unconfirmed',role:'parent',confirmed,width:393,theme});
 for(const width of [320,393,1440])matrix.push({name:'long-names',role:'coach',confirmed:true,long:true,width,theme});
 matrix.push({name:'text200',role:'coach',confirmed:true,zoom:true,width:320,theme});
 matrix.push({name:'manual-earlier',role:'coach',confirmed:true,manual:true,width:393,theme});
}
async function customise(page,s){
 await nativeCustomise(page,s);
 if(s.venue&&s.venue!=='H'||s.cup&&!s.confirmed)await page.evaluate(s=>{
  if(s.venue){const f=state.selkent.fixtures[0],d=fixtureOverride(f);f.venue=s.venue;state.selkent.fixtureOverrides={};if(s.confirmed)state.selkent.fixtureOverrides[fixtureKitSelectionKey(f)]={...d};}
  if(s.cup&&!s.confirmed)state.selkent.fixtureOverrides={};
  renderAll();navigate('matches',false);
 },s);
 await page.evaluate(()=>document.fonts.ready);
}
async function pageMeasurement(page){return page.evaluate(()=>{
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const visible=e=>!!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;
 const style=e=>{if(!e)return null;const s=getComputedStyle(e);return{...rect(e),visible:visible(e),text:e.textContent.trim(),font:s.fontFamily,fontSize:parseFloat(s.fontSize),weight:s.fontWeight,lineHeight:s.lineHeight,background:s.backgroundImage,fill:s.backgroundColor,shadow:s.boxShadow,border:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft],radius:s.borderRadius};};
 const panel=document.getElementById('matchday-dashboard');
 return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,title:style(document.getElementById('matches-screen-title')),prep:style(panel),prepTitle:style(document.getElementById('matchday-dashboard-title')),prepFields:[...panel.querySelectorAll('.matchday-dashboard-grid>article')].filter(visible).map(e=>({id:e.querySelector('strong')?.id,...style(e),label:style(e.querySelector(':scope>span')),value:style(e.querySelector(':scope>strong')),helper:style(e.querySelector(':scope>small'))})),prepStatus:style(document.getElementById('matchday-dashboard-status')),note:style(panel.querySelector('.matchday-dashboard-note')),noteSummary:style(panel.querySelector('.matchday-dashboard-note>summary')),actions:[...panel.querySelectorAll('.matchday-dashboard-actions>:is(button,a)')].filter(visible).map(style),fixtureVisible:visible(document.getElementById('matches-next-fixture')),placeholderVisible:visible(document.getElementById('parent-matches-placeholder')),parentResults:document.querySelectorAll('#league-match-list [data-details-match],#cup-games-body [data-details-match]').length};
});}
function approx(actual,expected,message,tolerance=1){assert(Math.abs(actual-expected)<=tolerance,message+': '+actual+' vs '+expected);}
function openSurface(s,label){assert(s,label+' exists');assert.equal(s.background,'none',label+' has no nested material');assert.equal(s.fill,'rgba(0, 0, 0, 0)',label+' is open');assert.equal(s.shadow,'none',label+' has no nested shadow');assert(s.border.filter(v=>parseFloat(v)>0).length<=1,label+' uses at most a divider');}
function checkPage(s,m){const id=s.name+'-'+s.width+'-'+s.theme;
 assert(m.documentWidth<=m.viewport+1,id+': page reflows');assert(/Barlow Condensed/.test(m.title.font),id+': reviewed condensed page title');if(!s.zoom)approx(m.title.fontSize,32,id+': current Matches32px heading');
 assert.equal(m.fixtureVisible,s.role!=='parent'||s.confirmed,id+': parent confirmation gate');assert.equal(m.placeholderVisible,s.role==='parent'&&!s.confirmed,id+': parent TBC placeholder');
 if(s.role==='parent'){assert(!m.prep.visible,id+': staff preparation remains hidden');assert.equal(m.parentResults,0,id+': U9 parent results remain absent');return;}
 assert(m.prep.visible,id+': staff prep remains present');for(const p of m.prep.padding)approx(parseFloat(p),16,id+': original prep padding');
 approx(m.prepStatus.y-m.prepTitle.bottom,8,id+': original prep title/status gap8');assert.equal(m.prep.radius,'20px',id+': original prep corner');assert(m.prepTitle.font.includes('Inter'),id+': original Inter prep title');if(!s.zoom)approx(m.prepTitle.fontSize,18,id+': prep title18');
 assert(m.prepFields.length>=5,id+': native date/venue/availability/squad/formation remain');
 for(const f of m.prepFields){openSurface(f,id+': prep '+f.id);for(const p of f.padding)approx(parseFloat(p),0,id+': open field padding');if(!s.zoom){approx(f.label.fontSize,12,id+': field label12');approx(f.value.fontSize,16,id+': field value16');if(f.helper)approx(f.helper.fontSize,12,id+': field helper12');}}
 const squad=m.prepFields.find(x=>x.id==='matchday-dashboard-squad'),formation=m.prepFields.find(x=>x.id==='matchday-dashboard-formation');assert(squad&&formation,id+': squad/formation retained');approx(squad.y,formation.y,id+': paired squad/formation row');assert(squad.right<=formation.x+1,id+': columns do not overlap');
 openSurface(m.note,id+': private note');assert(m.noteSummary.height>=44,id+': private note native target');
 assert(m.prepStatus.width>=m.prep.width-40,id+': acknowledgement uses available row width');for(const b of m.actions){assert(b.width>=44&&b.height>=50,id+': prep action target '+b.text);assert(b.x>=m.prep.x-1&&b.right<=m.prep.right+1,id+': prep action reflow');}
}
async function dialogMeasurement(page){return page.evaluate(()=>{
 const dialog=document.getElementById('next-fixture-dialog'),scene=document.getElementById('next-match-versus');
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const visible=e=>!!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;
 const style=e=>{if(!e)return null;const s=getComputedStyle(e);return{...rect(e),visible:visible(e),text:e.textContent.trim(),font:s.fontFamily,fontSize:parseFloat(s.fontSize),color:s.color,background:s.backgroundImage,fill:s.backgroundColor,shadow:s.boxShadow,border:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],cssWidth:parseFloat(s.width),cssHeight:parseFloat(s.height),transform:s.transform};};
 const badge=e=>{const before=getComputedStyle(e,'::before'),after=getComputedStyle(e,'::after');return{...style(e),image:e.querySelector('img')?{src:e.querySelector('img').getAttribute('src'),complete:e.querySelector('img').complete,naturalWidth:e.querySelector('img').naturalWidth}:null,rim:before.backgroundImage,mount:after.backgroundImage,mountWidth:parseFloat(after.width),mountHeight:parseFloat(after.height)};};
 const rows=[...scene.querySelectorAll('.sunday-dialog-row')].map(e=>({label:e.querySelector('.canonical-v11-label')?.textContent.trim(),date:{...style(e.querySelector('.sunday-dialog-date')),datetime:e.querySelector('.sunday-dialog-date')?.getAttribute('datetime'),accessible:e.querySelector('.sunday-dialog-date')?.getAttribute('aria-label')},sides:[...e.querySelectorAll('.sunday-dialog-identities>.canonical-v11-side')].map(side=>({kind:side.classList.contains('sunday-own')?'own':'opponent',name:side.querySelector('strong')?.textContent.trim(),copy:style(side.querySelector('strong')),badge:badge(side.querySelector('.canonical-v11-badge'))})),identities:style(e.querySelector('.sunday-dialog-identities'))}));
 const fixture=nextPublishedFixture(),data=canonicalCardRowData(fixture),model=canonicalMatchCardFrameworkV13Recovery(fixture),own=matchTeamLabel(ownTeamDisplayName());
 return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,dialog:{...style(dialog),scrollWidth:dialog.scrollWidth,clientWidth:dialog.clientWidth},scroll:{...style(document.getElementById('next-fixture-scroll')),scrollWidth:document.getElementById('next-fixture-scroll').scrollWidth,clientWidth:document.getElementById('next-fixture-scroll').clientWidth,scrollHeight:document.getElementById('next-fixture-scroll').scrollHeight,clientHeight:document.getElementById('next-fixture-scroll').clientHeight},scene:style(scene),rows,expected:{own,date:fixture.date,fullDate:formatDate(fixture.date),time:model.time||'TBC',ground:model.ground,group:!!data.group,rows:data.rows.map(r=>({home:r.home,away:r.away,venue:String(r.fixture.venue||'').toUpperCase(),label:r.label})),confirmed:data.rows.some(r=>fixtureDetailsConfirmed(r.fixture))},kickoff:style(scene.querySelector('.sunday-dialog-kickoff')),timeLabel:style(scene.querySelector('.sunday-dialog-time-label')),timeContext:style(scene.querySelector('.sunday-dialog-time-context')),timestamp:document.getElementById('next-match-when').textContent.trim(),timestampParent:style(document.getElementById('next-match-when').parentElement),ground:style(document.getElementById('next-match-ground')),venue:style(dialog.querySelector('.next-fixture-venue')),availability:style(document.getElementById('match-availability-panel')),availabilityTitle:style(dialog.querySelector('.match-availability-head>strong')),availabilityCount:style(document.getElementById('match-availability-count')),availabilityNumber:style(dialog.querySelector('.availability-response-number')),summary:style(document.getElementById('coach-availability-summary')),groups:dialog.querySelectorAll('.availability-summary-group').length,parentControls:style(document.getElementById('parent-availability-controls')),parentChoices:[...dialog.querySelectorAll('#availability-player option')].map(e=>e.textContent),editor:style(document.getElementById('next-match-confirmation-editor')),share:style(document.getElementById('next-match-share')),edit:style(document.getElementById('next-match-edit')),map:style(document.getElementById('next-match-map-preview')),mapHref:document.getElementById('next-match-map').getAttribute('href'),copy:style(document.getElementById('next-match-copy')),calendar:style(document.getElementById('next-match-calendar')),buttons:[...dialog.querySelectorAll('button')].filter(visible).map(e=>({id:e.id,...style(e)}))};
});}
function checkDialog(s,m){const id=s.name+'-'+s.width+'-'+s.theme,factor=s.zoom?2:1;
 assert(m.dialog.visible,id+': native dialog is open');assert(m.documentWidth<=m.viewport+1,id+': document reflows while dialog open');assert(m.dialog.scrollWidth<=m.dialog.clientWidth+1,id+': dialog has no horizontal overflow');assert(m.scroll.scrollWidth<=m.scroll.clientWidth+1,id+': native inner scroll has no horizontal overflow');assert(m.scene.background.includes('pitch-portrait.webp'),id+': original photographic dialog scene');
 assert.equal(m.rows.length,s.cup?2:1,id+': canonical matchups retained');
 for(const [i,r] of m.rows.entries()){
  const expected=m.expected.rows[i];assert.equal(r.date.datetime,m.expected.date,id+': machine-readable date');assert.equal(r.date.accessible,m.expected.fullDate,id+': full accessible date');assert(r.date.text&&!r.date.text.includes('Kick-off'),id+': display date is separate from kick-off');
  assert.deepEqual(r.sides.map(x=>x.name.replace(/^v\s+/i,'')),[expected.home,expected.away],id+': canonical H/A team order');if(s.cup)assert(r.label.includes('Group game'),id+': Cup row labels retained');assert(r.label.includes(({H:'Home',A:'Away',N:'Neutral'})[expected.venue]||'Venue TBC'),id+': actual H/A/N context');
  const own=r.sides.find(x=>x.kind==='own'),opponent=r.sides.find(x=>x.kind==='opponent');assert(own&&opponent,id+': both identity roles present');assert.equal(own.name,m.expected.own,id+': own canonical identity');
  approx(own.badge.cssWidth,125,id+': original own mount125');approx(opponent.badge.cssWidth,111,id+': original opponent mount111');assert(own.badge.rim.includes('own-rim.svg')&&own.badge.mount.includes('own-mount.svg'),id+': original own physical layers');assert(opponent.badge.rim.includes('opponent-rim.svg')&&opponent.badge.mount.includes('opponent-mount.svg'),id+': original opponent physical layers');
  assert(own.badge.image?.complete&&own.badge.image.naturalWidth>0,id+': original own badge loaded');assert(Math.abs(own.badge.mountWidth-own.badge.cssWidth)<=3,id+': own static mount and badge slot proportional');assert(Math.abs(opponent.badge.mountWidth-opponent.badge.cssWidth)<=3,id+': opponent static mount and badge slot proportional');
  assert(own.copy.font.includes('Barlow Condensed'),id+': own condensed display name');assert(opponent.copy.font.includes('Inter'),id+': opponent supporting type');if(s.width>=393&&!s.zoom)approx(own.copy.fontSize,34,id+': own display name34');approx(opponent.copy.fontSize,18*factor,id+': opponent18');assert(opponent.copy.y>=own.copy.bottom-1,id+': team names stack instead of equal columns');
  for(const c of [own.copy,opponent.copy,r.date]){assert(c.x>=m.dialog.x-1&&c.right<=m.dialog.right+1,id+': dialog copy stays within bounds');assert.equal(c.color,'rgb(255, 255, 255)',id+': scene copy stays white in both themes');}
 }
 assert(m.kickoff&&m.timeLabel,id+': original standalone kick-off hierarchy');assert.equal(m.kickoff.text,m.expected.time,id+': time is data/TBC without duplication');approx(m.kickoff.fontSize,57*factor,id+': original57px kick-off');approx(m.timeLabel.fontSize,11*factor,id+': original11px time label');assert(m.timeLabel.text.toLowerCase().includes(s.cup?'group':'kick'),id+': proper ordinary/group time label');assert(m.timeContext.text.includes(m.expected.confirmed?'Details confirmed':'Awaiting confirmation'),id+': true confirmation context');assert(m.timestamp.includes(m.expected.fullDate)&&m.timestamp.includes(m.expected.time),id+': original full timestamp remains accessible');assert(m.timestampParent.width<=2&&m.timestampParent.height<=2,id+': old combined timestamp is visually clipped');
 openSurface(m.venue,id+': compact venue row');approx(m.ground.fontSize,14*factor,id+': original venue type14');assert.equal(m.ground.text,m.expected.ground,id+': native canonical venue state retained');
 if(m.availability.visible){openSurface(m.availability,id+': availability section');approx(m.availabilityTitle.fontSize,22*factor,id+': original availability heading22');if(m.availabilityNumber){assert(m.availabilityNumber.font.includes('Anton'),id+': original availability count type');approx(m.availabilityNumber.fontSize,48*factor,id+': original availability count48');assert.equal(m.availabilityNumber.text,s.role==='parent'?'0':'2',id+': role-scoped native update count preserved');}}
 assert.equal(m.share.visible,s.role==='coach',id+': original share role gate');assert(!m.copy.visible&&!m.calendar.visible,id+': legacy hidden actions stay hidden');assert.equal(m.map.visible,s.confirmed||!!s.cup,id+': map follows known native venue, including Cup default');if(m.map.visible)assert(m.mapHref?.includes('maps'),id+': real Maps link retained');
 if(s.role==='parent'){assert(!m.editor.visible&&!m.edit.visible,id+': parent cannot edit');assert(m.parentChoices.every(n=>!n.includes('Other Family')&&!n.includes('Other Team')),id+': own permitted child choices only');}else{assert(m.groups>=4,id+': all original availability groups remain');assert.equal(m.editor.visible,!m.expected.confirmed,id+': original data-driven editor confirmation state');}
 for(const b of m.buttons){assert(b.width>=43&&b.height>=43,id+': native button touch target '+b.id);assert(b.x>=m.dialog.x-1&&b.right<=m.dialog.right+1,id+': native button reflows '+b.id);}
}
async function inspectScrollableContent(page,s,id){
 const access=await page.evaluate(async()=>{
  const scroll=document.getElementById('next-fixture-scroll'),dialog=document.getElementById('next-fixture-dialog');
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const visible=e=>!!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;
  const sample=(target)=>{target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});const r=rect(target),v=rect(scroll);return {target:r,scroll:v,scrollTop:scroll.scrollTop,clientWidth:scroll.clientWidth,scrollWidth:scroll.scrollWidth};};
  const timing=sample(dialog.querySelector('.sunday-dialog-kickoff'));
  return {timing};
 });
 function contained(a,label){assert(a.scrollWidth<=a.clientWidth+1,id+': inner reflow after '+label);assert(a.target.y>=a.scroll.y-1&&a.target.bottom<=a.scroll.bottom+1,id+': '+label+' can scroll fully into view');}
 contained(access.timing,'kick-off');
 if(s.cup||s.zoom||s.long||s.width===320){await page.screenshot({path:path.join(out,id+'-timing.png')});}
 if(await page.locator('#match-availability-panel').isVisible()){
  const groups=page.locator('#coach-availability-summary details');
  if(s.role==='coach'&&await groups.count()){await groups.first().locator('summary').click();assert(await groups.first().evaluate(e=>e.open),id+': native availability disclosure opens');}
  await page.locator('.match-availability-head>strong').scrollIntoViewIfNeeded();
  access.availability=await page.evaluate(()=>{
   const scroll=document.getElementById('next-fixture-scroll'),heading=document.querySelector('.match-availability-head>strong');
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
   return {target:rect(heading),scroll:rect(scroll),scrollTop:scroll.scrollTop,clientWidth:scroll.clientWidth,scrollWidth:scroll.scrollWidth,rows:[...document.querySelectorAll('.availability-summary-group[open] .availability-player-row')].map(e=>({...rect(e),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,select:e.querySelector('select')?rect(e.querySelector('select')):null}))};
  });contained(access.availability,'availability heading');
  for(const row of access.availability.rows){assert(row.scrollWidth<=row.clientWidth+1,id+': available player row reflows');assert(row.x>=access.availability.scroll.x-1&&row.right<=access.availability.scroll.right+1,id+': available player stays in scroll bounds');if(row.select){assert(row.select.width>=44&&row.select.height>=44,id+': native player selector retains touch size');assert(row.select.right<=row.right+1,id+': native player selector fits row');}}
  access.detail=await page.evaluate(role=>{
   const scroll=document.getElementById('next-fixture-scroll'),target=role==='coach'?document.querySelector('.availability-summary-group[open] .availability-player-row'):document.querySelector('#parent-availability-controls label');
   if(!target)return null;target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
   return {target:rect(target),scroll:rect(scroll),scrollTop:scroll.scrollTop,clientWidth:scroll.clientWidth,scrollWidth:scroll.scrollWidth};
  },s.role);
  assert(access.detail,id+': permitted availability detail exists');contained(access.detail,'permitted player control');
  if(s.cup||s.zoom||s.long||s.width===320){await page.screenshot({path:path.join(out,id+'-availability.png')});}
 }
 const done=page.locator('#next-fixture-action-bar [data-close-dialog]');await done.focus();
 access.footer=await done.evaluate(e=>{const r=e.getBoundingClientRect(),d=document.getElementById('next-fixture-dialog').getBoundingClientRect();return {target:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height},dialog:{x:d.x,y:d.y,right:d.right,bottom:d.bottom},active:document.activeElement===e};});
 assert(access.footer.active,id+': footer Done is keyboard reachable');assert(access.footer.target.y>=access.footer.dialog.y-1&&access.footer.target.bottom<=access.footer.dialog.bottom+1,id+': footer Done remains visible after scroll');
 return access;
}
async function shareGuard(page,s){
 await page.evaluate(()=>{window.__fullFigmaShares=[];window.ClubHubNative={shareMatchCard:(data,caption)=>__fullFigmaShares.push({prefix:data.slice(0,22),caption})};});
 await page.locator('#next-match-share').click();
 if(s.confirmed){await page.waitForFunction(()=>__fullFigmaShares.length===1);const item=await page.evaluate(()=>__fullFigmaShares[0]);assert.equal(item.prefix,'data:image/png;base64,','native actual PNG still generated');assert(item.caption.includes('Example')&&item.caption.includes(s.manual?'09:45':'10:30'),'share retains true native timing/venue');}
 else assert.equal(await page.evaluate(()=>__fullFigmaShares.length),0,'unconfirmed fixture does not generate a share');
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const cases=[],errors=[],externalWrites=[];
 const sourceHashes=()=>Object.fromEntries(['app.js','index.html','matches-page.css','fixture-dialog.css','service-worker.js','graphics/pitch-portrait.webp','graphics/match-pitch-portrait.webp','graphics/fixture/ground-shadow.svg','graphics/fixture/own-rim.svg','graphics/fixture/own-mount.svg','graphics/fixture/opponent-rim.svg','graphics/fixture/opponent-mount.svg','graphics/fixture/green-reflection.svg'].map(f=>{const b=fs.readFileSync(path.join(root,f)),source=path.join('app/src/main/assets',f),sourceBytes=fs.readFileSync(f==='service-worker.js'?'cloudflare/web-app/service-worker.js':source);assert(b.equals(sourceBytes),'exact built/source bytes: '+f);return[f,crypto.createHash('sha256').update(b).digest('hex')];}));
 const hashes=sourceHashes();
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base)return route.continue();if(route.request().method()!=='GET')externalWrites.push({method:route.request().method(),url:u.origin+u.pathname});return route.fulfill({status:200,contentType:u.hostname==='www.google.com'?'text/html':'application/json',body:u.hostname==='www.google.com'?'<!doctype html><body>Fictional public venue map</body>':'[]'});});
  for(const s of (process.env.PITCHKIND_FULL_FIGMA_DIAGNOSTIC?matrix.slice(0,1):matrix).slice(Number(process.env.PITCHKIND_FULL_FIGMA_START||0))){
   const id=s.name+'-'+s.width+'-'+s.theme;await prepare(page,s.role,s.width,s.theme,s.confirmed);await customise(page,s);const p=await pageMeasurement(page);checkPage(s,p);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,id+'-page.png'),fullPage:true});
   let d=null;
   if(p.fixtureVisible){await page.locator('#matches-next-details').click();await page.locator('#next-fixture-dialog').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('match-availability-count').textContent.includes('Loading'));d=await dialogMeasurement(page);fs.writeFileSync(path.join(out,'current-case.json'),JSON.stringify({...s,page:p,dialog:d},null,2));await page.locator('#next-fixture-scroll').evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.join(out,id+'-dialog.png')});await page.locator('#next-match-versus').screenshot({path:path.join(out,id+'-scene.png')});checkDialog(s,d);d.scrollAccess=await inspectScrollableContent(page,s,id);
    if(s.role==='coach'&&s.width===393&&s.theme==='dark'&&['confirmed','unconfirmed'].includes(s.name))await shareGuard(page,s);
    await page.locator('#next-fixture-dialog [data-close-dialog]').first().click();assert(!await page.locator('#next-fixture-dialog').isVisible(),id+': native close returns to Matches');}
   cases.push({...s,page:p,dialog:d});fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({date:new Date().toISOString(),assetRoot:root,hashes,cases,errors,externalWrites},null,2));console.log('PASS '+id);
  }
  assert.deepEqual(sourceHashes(),hashes,'build/source stayed unchanged throughout run');assert.deepEqual(errors,[],'no native runtime errors');assert.deepEqual(externalWrites,[],'no external writes');console.log(`PASS full Matches/Figma: ${cases.length} native page/dialog cases; original hierarchy, dynamic data, roles and native actions.`);
 }finally{fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({date:new Date().toISOString(),assetRoot:root,hashes,cases,errors,externalWrites},null,2));await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
