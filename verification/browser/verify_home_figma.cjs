// Original approved Home fixture preview, verified against native built assets.
// Fictional local role/API fixtures only; external requests are intercepted.
// Run build.py, then node verification/browser/verify_home_figma.cjs [playwright] [out].
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'home-figma-review');
fs.mkdirSync(out,{recursive:true});let base;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/cloud-config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://fictional.supabase.co",anonKey:"fictional-only-no-credentials-00000000000000000000000000"};');}
 if(url.pathname.startsWith('/data/')){res.setHeader('Content-Type','application/json');return res.end('{"clubs":[],"age_groups":[],"fixtures":[]}');}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
const harness=fs.readFileSync(path.resolve('verification/browser/verify_shared_components.cjs'),'utf8');
const prepare=eval('('+harness.slice(harness.indexOf('async function prepare('),harness.indexOf('async function seedResults(')).trim()+')');
const seedResults=eval('('+harness.slice(harness.indexOf('async function seedResults('),harness.indexOf('async function styles(')).trim()+')');
const matrix=[];
for(const theme of ['dark','light']){
 for(const width of [320,393,768,1440])for(const confirmed of [false,true])matrix.push({name:confirmed?'home-confirmed':'home-tbc',role:'coach',confirmed,venue:'H',width,theme});
 for(const venue of ['A','N'])for(const confirmed of [false,true])matrix.push({name:(venue==='A'?'away':'neutral')+(confirmed?'-confirmed':'-tbc'),role:'coach',confirmed,venue,width:393,theme});
 for(const width of [320,393,1440]){
  matrix.push({name:'cup-confirmed',role:'coach',confirmed:true,cup:true,width,theme});
  matrix.push({name:'long-names',role:'coach',confirmed:true,long:true,width,theme});
 }
 matrix.push({name:'cup-tbc',role:'coach',confirmed:false,cup:true,width:393,theme});
 for(const cupVenue of ['H','A','N'])matrix.push({name:'cup-all-'+({H:'home',A:'away',N:'neutral'}[cupVenue]),role:'coach',confirmed:true,cup:true,cupVenue,width:393,theme});
 for(const width of [393,1440]){
  matrix.push({name:'manual-earlier',role:'coach',confirmed:true,manual:true,width,theme});
  matrix.push({name:'empty-after-fixture',role:'coach',confirmed:true,empty:true,width,theme});
 }
 for(const confirmed of [false,true])matrix.push({name:confirmed?'parent-confirmed':'parent-tbc',role:'parent',confirmed,width:393,theme});
 matrix.push({name:'home-text200',role:'coach',confirmed:true,zoom:true,width:320,theme});
 for(const width of [320,393])matrix.push({name:'coach-table-nav',role:'coach',confirmed:true,table:true,width,theme});
 for(const role of ['coach','parent'])matrix.push({name:role+'-notice',role,confirmed:true,notice:true,width:393,theme});
}
async function customise(page,s){
 await page.evaluate(async s=>{
  if(s.venue)state.selkent.fixtures[0].venue=s.venue;
  if(s.cup)state.selkent.fixtures=[{date:'2099-10-25',opponent:'Example Rovers',competition:'Selkent Cup One',venue:'A',time:''},{date:'2099-10-25',opponent:'Example Gunners',competition:'Selkent Cup One',venue:'H',time:''}];
  if(s.cupVenue)for(const f of state.selkent.fixtures)f.venue=s.cupVenue;
  if(s.long){state.meta.teamName='Example Greens Community Football Club';state.division.teamName=state.meta.teamName;state.selkent.fixtures[0].opponent='Example Gunners and Rovers Junior Athletic';}
  state.selkent.fixtureOverrides={};
  if(s.confirmed)for(const f of state.selkent.fixtures)state.selkent.fixtureOverrides[fixtureKitSelectionKey(f)]={time:'10:30',groundName:'Example Playing Fields',address:'Fictional public ground address',confirmedAt:'2026-10-22T11:00:00Z'};
  if(s.manual)state.matches=[{id:'fictional-earlier-friendly',date:'2099-10-20',opponent:'Meadow United',competition:'Friendly',venue:'A',status:'scheduled',time:'09:45',groundName:'Example Recreation Ground',address:'Fictional public ground address'}];
  renderAll();navigate('home',false);
  if(s.notice){
   window.__homeNoticeRead=[];window.__homeNotices=[{id:'fictional-home-notice',title:'Kit reminder',body:"Please check your team's latest kit information before travelling.",audience:'team',team_id:'fictional-team',pinned:true,important:true,created_at:'2026-10-23T09:00:00Z',expires_at:null,read_at:null}];
   window.ClubHubCloud.listAnnouncements=async()=>JSON.parse(JSON.stringify(__homeNotices));
   window.ClubHubCloud.markAnnouncementRead=async id=>{__homeNoticeRead.push(id);const row=__homeNotices.find(n=>n.id===id);if(row)row.read_at=new Date().toISOString();};
   await refreshAnnouncements(false);
  }
  if(s.empty){state.selkent.fixtures=[];state.matches=[];renderAll();navigate('home',false);}
  if(s.zoom)document.documentElement.style.fontSize='200%';
 },s);
 await page.evaluate(()=>document.fonts.ready);
 if(s.role==='parent')await page.waitForFunction(()=>__parentFamilyStatus==='ready'&&__availabilityLoadStatus==='ready');
 if(await page.locator('#next-match-card').isVisible()){
  await page.locator('#next-match-card').scrollIntoViewIfNeeded();
  await page.locator('#next-match-card img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
 }
}
async function measure(page){
 return page.evaluate(()=>{
  const card=document.getElementById('next-match-card'),host=document.getElementById('next-match-home-teams');
  const visible=e=>!!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;
  const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const style=e=>{if(!e)return null;const s=getComputedStyle(e);return{...rect(e),font:s.fontFamily,fontSize:parseFloat(s.fontSize),color:s.color,background:s.backgroundImage,backgroundColor:s.backgroundColor,borderRadius:s.borderRadius,paddingLeft:parseFloat(s.paddingLeft),paddingRight:parseFloat(s.paddingRight)};};
  const f=nextPublishedFixture(),own=matchTeamLabel(ownTeamDisplayName()),canonical=f?canonicalCardRowData(f):null,d=f?(miniCupGroup(f)?parentCupGroupDetails(f):resolvedFixture(f)):null;
  const venueLabel=v=>({H:'Home',A:'Away',N:'Neutral'}[String(v||'').toUpperCase()]||'Venue TBC'),venues=canonical?[...new Set(canonical.rows.map(r=>String(r.fixture.venue||'').toUpperCase()))]:[];
  const expectedVenue=canonical?.group?(venues.length===1?venueLabel(venues[0]):''):venueLabel(f?.venue);
  const rows=[...host.querySelectorAll('.home-fixture-row')].map(row=>({text:row.textContent.trim(),...style(row),own:row.querySelector('.home-fixture-own strong')?.textContent.trim(),name:style(row.querySelector('.home-fixture-own strong')),opponent:{text:row.querySelector('.home-fixture-opponent')?.textContent.trim(),...style(row.querySelector('.home-fixture-opponent'))},crests:[...row.querySelectorAll('.home-fixture-own img')].map(e=>({...style(e),src:e.getAttribute('src'),complete:e.complete,naturalWidth:e.naturalWidth})),opponentImages:row.querySelectorAll('.home-fixture-opponent img').length}));
  const nav=document.getElementById('mobile-primary-nav'),navStyle=getComputedStyle(nav),navButtons=[...nav.querySelectorAll('button')].filter(visible).map(e=>({...style(e),label:e.textContent.trim(),current:e.getAttribute('aria-current'),icons:[...e.querySelectorAll('svg')].some(visible)}));
  const link=document.getElementById('home-team-stats-link'),statsLink={...style(link),visible:visible(link),tag:link.tagName,route:link.dataset.pageRoute,arrow:style(link.querySelector('span:last-child'))};
  return{viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,card:{...style(card),visible:visible(card),tag:card.tagName,disabled:card.disabled,text:card.textContent.trim(),ariaControls:card.getAttribute('aria-controls'),pseudoAfter:getComputedStyle(card,'::after').content,nestedActions:card.querySelectorAll('button,a,input,select').length},heading:style(card.querySelector('.home-fixture-heading')),date:{text:document.getElementById('next-match-home-date').textContent.trim(),datetime:document.getElementById('next-match-home-date').getAttribute('datetime'),ariaLabel:document.getElementById('next-match-home-date').getAttribute('aria-label'),...style(document.getElementById('next-match-home-date'))},meta:{text:document.getElementById('home-fixture-meta')?.textContent.trim(),...style(document.getElementById('home-fixture-meta'))},details:style(card.querySelector('.home-fixture-details')),rows,own,expected:canonical?{date:formatDate(f.date),opponents:canonical.rows.map(r=>r.home===own?r.away:r.home),labels:canonical.rows.map(r=>r.label),venues:canonical.rows.map(r=>String(r.fixture.venue||'').toUpperCase()),time:d?.time||f.time||'',venue:expectedVenue}:null,nextFixture:f?{date:f.date,opponent:f.opponent,competition:f.competition}:null,trainingVisible:visible(document.getElementById('parent-home-training')),parentInfoVisible:visible(document.getElementById('parent-home-match-info')),parentInfo:document.getElementById('parent-home-match-info').textContent.trim(),seasonSummary:document.querySelector('#home-season-record>summary').textContent.trim(),statsLink,nav:{visible:visible(nav),...style(nav),backgroundColor:navStyle.backgroundColor,buttons:navButtons}};
 });
}
function check(s,m){
 const label=`${s.name}-${s.width}-${s.theme}`;
 assert(m.documentWidth<=m.viewport+1,label+': page reflows');
 if(m.statsLink.visible){
  assert.equal(m.statsLink.tag,'A',label+': native statistics link retained');assert.equal(m.statsLink.route,'team-stats',label+': native statistics route retained');
  assert(m.statsLink.height>=44,label+': statistics link touch target');
  if(!s.zoom){assert(Math.abs(m.statsLink.height-50)<=1,label+': approved50px statistics action');assert(Math.abs(m.statsLink.arrow.fontSize-18)<=1,label+': approved18px statistics arrow');}
 }
 assert.equal(m.nav.visible,s.width<=900,label+': original mobile/desktop navigation breakpoint');
 if(m.nav.visible){
  const expected=s.role==='parent'?['Home','Schedule','Inbox','More']:s.table?['Home','Matches','Table','Squad','More']:['Home','Matches','Squad','More'];
  assert.deepEqual(m.nav.buttons.map(b=>b.label),expected,label+': existing role/table destinations retained');
  assert(m.nav.buttons.every(b=>b.height>=58&&b.width>=44&&!b.icons),label+': reviewed text-only navigation touch targets');
  assert(Math.max(...m.nav.buttons.map(b=>b.width))-Math.min(...m.nav.buttons.map(b=>b.width))<=1,label+': equal navigation cells');
  assert.equal(m.nav.buttons.filter(b=>b.current==='page').length,1,label+': one current destination');
  const active=m.nav.buttons.find(b=>b.current==='page');assert.equal(active.label,'Home',label+': Home remains current');
  assert.equal(active.color,'rgb(255, 255, 255)',label+': readable active navigation copy');
  assert.equal(active.backgroundColor,'rgb(20, 92, 54)',label+': approved active navigation green');
  if(s.width>=375&&!s.zoom){assert(Math.abs(m.nav.height-66)<=1,label+': approved66px navigation dock');assert(m.nav.buttons.every(b=>Math.abs(b.height-58)<=1&&Math.abs(b.fontSize-11)<=.1),label+': approved58px navigation cells and11px labels');}
  if(s.width<375&&expected.length===5&&!s.zoom){assert(Math.abs(m.nav.height-82)<=1,label+': reviewed small five-destination82px dock');assert(m.nav.buttons.every(b=>Math.abs(b.height-66)<=1&&Math.abs(b.fontSize-10)<=.1),label+': reviewed small five-destination66px cells and10px labels');}
  const paint=m.nav.background==='none'?m.nav.backgroundColor:m.nav.background;
  const colours=[...paint.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].map(m=>m.slice(1).map(Number));
  assert(colours.length>=1,label+': navigation material present');
  assert(colours.every(rgb=>s.theme==='light'?rgb.every(c=>c>=220):rgb.every(c=>c<=50)),label+': navigation follows light/dark material');
 }
 assert.equal(m.card.tag,'BUTTON',label+': native fixture button retained');
 assert.equal(m.card.ariaControls,'next-fixture-dialog',label+': original dialog target retained');
 assert.equal(m.card.nestedActions,0,label+': no nested interactive controls in native button');
 assert.equal(m.card.visible,s.role!=='parent'||s.confirmed,label+': parent confirmation gate retained');
 assert.equal(m.trainingVisible,s.role==='parent'&&!s.confirmed,label+': original unconfirmed training content');
 assert.equal(m.parentInfoVisible,s.role==='parent'&&s.confirmed,label+': original confirmed parent content');
 if(s.role==='parent'){
  assert(!m.parentInfo.includes('Other Family Child')&&!m.parentInfo.includes('Other Team Child'),label+': other family/team children remain absent');
  if(s.confirmed)assert(m.parentInfo.includes('Alex Example'),label+': own permitted child remains');
 }
 if(!m.card.visible)return;
 if(s.empty){
  assert(m.card.disabled,label+': no-fixture button disabled');assert.equal(m.rows.length,0,label+': old fixture rows cleared');
  assert(!m.date.datetime&&!m.date.ariaLabel,label+': stale accessible fixture date cleared');
  assert(!/Example Gunners|Example Rovers|Meadow United|10:30|09:45/.test(m.card.text),label+': stale names/times cleared');
  assert(!m.expected,label+': no synthetic fixture added');return;
 }
 assert(!m.card.disabled,label+': existing fixture button active');assert(m.card.height>=44,label+': native touch target');
 assert(m.heading,label+': approved integrated date/header present');
 assert(m.date.text.toLowerCase().includes(m.expected.date.split(' ').slice(0,2).join(' ').toLowerCase())&&!/kick-off|group start/i.test(m.date.text),label+': header contains correct date alone');
 assert.equal(m.date.datetime,m.nextFixture.date,label+': full machine-readable fixture date retained');
 assert.equal(m.date.ariaLabel,m.expected.date,label+': full accessible date retained');
 assert(m.meta&&m.meta.text,label+': approved fixture footer present');
 if(m.expected.venue)assert(m.meta.text.toLowerCase().includes(m.expected.venue.toLowerCase()),label+': venue context retained');
 else assert(!/\b(?:home|away|neutral)\b/i.test(m.meta.text),label+': mixed Cup locations are not replaced by misleading aggregate venue');
 assert(s.cup?/group starts?|group start/i.test(m.meta.text):/kick-off/i.test(m.meta.text),label+': original fixture/group time context');
 assert(m.meta.text.includes(m.expected.time||'TBC'),label+': existing confirmed or TBC time retained');
 assert(/Details/i.test(m.card.text+' '+m.card.pseudoAfter),label+': native Details affordance visible');
 assert(m.details,label+': approved Details label belongs to native button');
 assert.equal(m.rows.length,s.cup?2:1,label+': one row per original matchup');
 for(const [i,row] of m.rows.entries()){
  assert(row.own===m.own,label+': own club identity remains primary');
  assert(row.opponent.text?.includes(m.expected.opponents[i]),label+': native opponent order retained');
  assert.equal(row.crests.length,1,label+': one unchanged own crest per row');assert.equal(row.opponentImages,0,label+': approved simple opponent line');
  for(const crest of row.crests){assert(crest.width>=44&&crest.width<=48&&crest.height>=44&&crest.height<=48,label+': approved46px crest');assert(crest.complete&&crest.naturalWidth>0,label+': own crest asset loaded');}
  assert(row.name&&/Barlow Condensed/.test(row.name.font),label+': approved condensed own-club typography');
  assert(row.name.fontSize>=22&&row.name.fontSize>=row.opponent.fontSize*1.5,label+': own-club name leads compact opponent line');
  assert.equal(row.name.color,s.theme==='dark'?'rgb(255, 255, 255)':'rgb(17, 23, 21)',label+': readable theme copy');
  for(const item of [row,row.name,row.opponent])assert(item.x>=m.card.x-1&&item.right<=m.card.right+1,label+': fixture copy stays within card');
  if(s.cup){assert(row.text.includes('Group game'),label+': native group label retained');assert(row.text.toLowerCase().includes(({H:'home',A:'away',N:'neutral'}[m.expected.venues[i]])),label+': per-game home/away context retained');}
 }
 if(s.manual)assert.deepEqual(m.nextFixture,{date:'2099-10-20',opponent:'Meadow United',competition:'Friendly'},label+': manually scheduled earlier fixture still first');
}
async function interact(page,s){
 await page.locator('#next-match-card').click();await page.locator('#next-fixture-dialog').waitFor({state:'visible'});
 assert(await page.locator('#next-match-versus').isVisible(),'native Home button opens existing fixture dialog');
 assert.equal(await page.locator('#next-match-share').isVisible(),s.role==='coach','dialog share role guard retained');
 assert.equal(await page.locator('#next-match-confirmation-editor').isVisible(),s.role==='coach'&&!s.confirmed,'confirmation editor guard retained');
 if(s.cup)assert.equal(await page.locator('#next-match-versus .canonical-v11-fixture').count(),2,'Home preview does not replace canonical Cup detail rows');
 if(s.role==='coach'){
  await page.evaluate(()=>{window.__homeShares=[];window.ClubHubNative={shareMatchCard:(data,caption)=>__homeShares.push({prefix:data.slice(0,22),caption})};});
  await page.locator('#next-match-share').click();
  if(s.confirmed){await page.waitForFunction(()=>window.__homeShares.length===1);assert.equal(await page.evaluate(()=>__homeShares[0].prefix),'data:image/png;base64,','Home detail share still renders native PNG');}
  else{assert.equal(await page.evaluate(()=>__homeShares.length),0,'unconfirmed fixture cannot be shared');}
 }
 await page.locator('#next-fixture-dialog [data-close-dialog]').first().click();assert(!await page.locator('#next-fixture-dialog').isVisible(),'native close returns to Home');
}
async function seasonRecord(page,s){
 await page.evaluate(()=>{
  state.matches=[{id:'home-review-win',date:'2026-10-01',opponent:'Example United',competition:'Friendly',venue:'H',status:'played',gf:2,ga:1},{id:'home-review-draw',date:'2026-10-08',opponent:'Example Rovers',competition:'Friendly',venue:'A',status:'played',gf:1,ga:1},{id:'home-review-loss',date:'2026-10-15',opponent:'Example Athletic',competition:'Friendly',venue:'N',status:'played',gf:0,ga:1}];renderDashboard();
 });
 const summary=page.locator('#home-season-record>summary');await summary.click();
 assert(await page.locator('#home-season-record').evaluate(e=>e.open),'native Season record disclosure opens');
 const value=await page.evaluate(()=>{
  const metricIds=['overall-played','overall-wins','overall-draws','overall-losses','overall-gf','overall-ga','friendly-played','friendly-wins','friendly-draws','friendly-losses'];
  return{values:Object.fromEntries(metricIds.map(id=>[id,document.getElementById(id).textContent])),panels:[...document.querySelectorAll('#home-season-record :is(.running-count-card,#league-summary-card)')].map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return{radius:s.borderRadius,paddingLeft:parseFloat(s.paddingLeft),paddingRight:parseFloat(s.paddingRight),width:r.width};}),metrics:[...document.querySelectorAll('#home-season-record :is(.running-main strong,#league-played-count)')].map(e=>{const s=getComputedStyle(e);return{font:s.fontFamily,size:parseFloat(s.fontSize)};}),summary:document.querySelector('#home-season-record>summary').textContent.trim(),overflow:document.documentElement.scrollWidth>innerWidth};
 });
 assert.deepEqual(value.values,{'overall-played':'3','overall-wins':'1','overall-draws':'1','overall-losses':'1','overall-gf':'3','overall-ga':'3','friendly-played':'3','friendly-wins':'1','friendly-draws':'1','friendly-losses':'1'},'Season record preserves native calculations');
 assert(value.summary.includes('Overall · Friendlies · League'),'approved summary copy restored');
 assert.equal(value.panels.length,3,'all native season panels remain');
 for(const panel of value.panels){assert.equal(panel.radius,'16px','season panels use existing shared16px material');assert(panel.paddingLeft>=19&&panel.paddingRight>=19,'season panels retain reviewed20px padding');}
 assert(value.metrics.every(m=>m.font.includes('Barlow Condensed')&&m.size>=28),'season metrics use reviewed display typography: '+JSON.stringify(value.metrics));assert(!value.overflow,'open season panels reflow');
 await page.screenshot({path:path.join(out,`season-open-${s.width}-${s.theme}.png`),fullPage:true});
 await page.evaluate(()=>renderAll());assert(await page.locator('#home-season-record').evaluate(e=>e.open),'render preserves native open disclosure state');
 await summary.click();assert(!await page.locator('#home-season-record').evaluate(e=>e.open),'native Season record disclosure closes');return value;
}
async function navigateHome(page){
 await page.locator('#mobile-primary-nav button').filter({hasText:'More'}).click();await page.waitForFunction(()=>currentView==='more');
 await page.locator('#mobile-primary-nav button').filter({hasText:'Home'}).click();await page.waitForFunction(()=>currentView==='home');
}
async function noticeReview(page,s,statsLink){
 const m=await page.evaluate(()=>{
  const panel=document.getElementById('home-club-notices'),article=panel.querySelector('.club-notice'),body=article.querySelector('p'),title=article.querySelector('strong'),heading=panel.querySelector('h3'),action=article.querySelector('[data-read-announcement]');
  const style=e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,font:c.fontFamily,fontSize:parseFloat(c.fontSize),background:c.backgroundImage,backgroundColor:c.backgroundColor,radius:c.borderRadius,shadow:c.boxShadow,paddingTop:parseFloat(c.paddingTop),paddingBottom:parseFloat(c.paddingBottom),borderBottom:parseFloat(c.borderBottomWidth)};};
  return{panel:style(panel),article:{...style(article),text:article.textContent.trim(),classes:article.className},body:{...style(body),text:body.textContent},title:{...style(title),text:title.textContent},heading:{...style(heading),text:heading.textContent,prefix:getComputedStyle(heading,'::before').content},action:style(action),family:style(document.getElementById('parent-home-family')),unread:document.getElementById('home-notices-unread').textContent,time:article.querySelector('time').textContent};
 });
 const label=s.role+' notice '+s.theme;
 assert.equal(m.title.text,'Kit reminder',label+': title retained');assert(m.body.text.includes('latest kit information'),label+': full body retained');
 assert(m.article.text.includes('Pinned')&&m.article.text.includes('Important')&&m.article.text.includes('U9 Example Greens'),label+': audience and priority metadata retained');
 assert(m.article.classes.includes('unread')&&m.unread==='1 unread'&&m.time,label+': unread count and timestamp retained');
 if(s.role==='coach'){
  assert(m.panel.y>=statsLink.bottom-1,label+': staff notices follow season/statistics');
  assert.equal(m.article.background,'none',label+': staff row remains open');assert.equal(m.article.backgroundColor,'rgba(0, 0, 0, 0)',label+': staff row exposes canvas');
  assert.equal(m.article.radius,'0px',label+': staff row uses divider rather than raised box');assert.equal(m.article.shadow,'none',label+': staff row has no box shadow');
  assert(m.article.paddingTop>=16&&m.article.paddingBottom>=16&&m.article.borderBottom>=1,label+': readable padded divider row');
  assert(m.heading.font.includes('Inter')&&m.heading.fontSize===12&&m.heading.prefix.includes('03'),label+': approved Club notices heading');
  assert(m.title.font.includes('Inter')&&m.title.fontSize===16&&m.body.fontSize===13,label+': approved notice typography');
  assert(m.action.height>=44&&m.action.y>=m.body.bottom-1,label+': native Mark read is a footer touch target');
 }else{
  assert(m.panel.y<m.family.y,label+': parent Team updates stay before family');
  assert.equal(m.heading.text,'Team updates',label+': parent heading retained');assert.equal(m.article.radius,'16px',label+': parent raised material retained');
  assert(m.article.shadow!=='none'&&(m.article.background!=='none'||m.article.backgroundColor!=='rgba(0, 0, 0, 0)'),label+': parent notice keeps material depth');
 }
 await page.locator('#home-club-notices').screenshot({path:path.join(out,`notice-panel-${s.role}-${s.theme}.png`)});
 await page.locator('#home-club-notices [data-read-announcement="fictional-home-notice"]').click();
 await page.waitForFunction(()=>window.__homeNoticeRead.length===1&&__announcementRows.find(n=>n.id==='fictional-home-notice')?.read_at);
 m.read=await page.evaluate(()=>({calls:__homeNoticeRead,readAt:__announcementRows.find(n=>n.id==='fictional-home-notice')?.read_at,classes:document.querySelector('#home-club-notices .club-notice').className,remainingActions:document.querySelectorAll('#home-club-notices [data-read-announcement]').length,unreadHidden:document.getElementById('home-notices-unread').classList.contains('hidden')}));
 assert.deepEqual(m.read.calls,['fictional-home-notice'],label+': original delegated handler calls local API stub once');
 assert(m.read.readAt&&m.read.classes.split(' ').includes('read')&&m.read.remainingActions===0&&m.read.unreadHidden,label+': native read state and unread badge update');
 await page.locator('#home-club-notices').screenshot({path:path.join(out,`notice-panel-read-${s.role}-${s.theme}.png`)});
 await page.screenshot({path:path.join(out,`notice-read-${s.role}-${s.theme}.png`),fullPage:true});return m;
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PITCHKIND_CHROMIUM?{executablePath:process.env.PITCHKIND_CHROMIUM}:{}),args:['--no-sandbox']});const cases=[],errors=[],externalWrites=[];
 try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base)return route.continue();if(route.request().method()!=='GET')externalWrites.push({method:route.request().method(),url:u.origin+u.pathname});return route.fulfill({status:200,contentType:u.hostname==='www.google.com'?'text/html':'application/json',body:u.hostname==='www.google.com'?'<!doctype html><body>Fictional public venue map</body>':'[]'});});
  for(const s of matrix){
   await prepare(page,s.role,s.width,s.theme,s.confirmed);if(s.table)await seedResults(page);await customise(page,s);const m=await measure(page);check(s,m);
   const label=`${s.name}-${s.width}-${s.theme}`;await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,label+'.png'),fullPage:true});
   if(m.card.visible)await page.locator('#next-match-card').screenshot({path:path.join(out,label+'-card.png')});
   if(s.width===393&&s.theme==='dark'&&['home-confirmed','home-tbc','cup-confirmed','parent-confirmed'].includes(s.name))await interact(page,s);
   if(s.name==='home-confirmed'&&[393,1440].includes(s.width))m.season=await seasonRecord(page,s);
   if(s.width===393&&s.theme==='dark'&&['coach-table-nav','parent-confirmed'].includes(s.name))await navigateHome(page);
   if(s.notice)m.notice=await noticeReview(page,s,m.statsLink);
   cases.push({...s,...m});console.log('PASS '+label);
  }
  assert.deepEqual(errors,[],'no runtime errors');assert.deepEqual(externalWrites,[],'no external writes');console.log(`PASS original Home Figma preview: ${cases.length} native built cases, fixture order, role gates, empty reset and native detail/share controls.`);
 }finally{
  const hashes=Object.fromEntries(['app.js','index.html','sunday-graphics.css','shared-surfaces.css','shooters-hill-logo.png','service-worker.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
  fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({date:new Date().toISOString(),assetRoot:root,hashes,cases,errors,externalWrites},null,2));await browser.close();server.close();
 }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
