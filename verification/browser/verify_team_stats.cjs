// Native Player & team stats presentation, data parity and access regression.
// Fictional API data only. No replacement markup, styles, or external writes.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const {chromium} = require(process.argv[2] || 'playwright');
const root = path.resolve('cloudflare/web-app/dist');
const out = path.resolve(process.argv[3] || 'team-stats-review');
fs.mkdirSync(out, {recursive:true});
function readableOnCanvas(color,canvas,label) {
  const channels=color.match(/[\d.]+/g).map(Number),bg=canvas.slice(1).match(/../g).map(n=>parseInt(n,16));
  const alpha=channels[3]??1,fg=bg.map((c,i)=>channels[i]*alpha+c*(1-alpha));
  const luminance=rgb=>rgb.map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  const a=luminance(fg),b=luminance(bg),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  assert(contrast>=4.5,`${label}: normal text contrasts with its canvas, got ${contrast}: ${color}`);
}
let base;
const helper = fs.readFileSync('verification/browser/verify_shared_components.cjs','utf8');
const prepare = eval('(' + helper.slice(helper.indexOf('async function prepare('),helper.indexOf('async function seedResults(')).trim() + ')');
const server = http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/cloud-config.js') {
    res.setHeader('Content-Type','text/javascript');
    return res.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://fictional.supabase.co",anonKey:"fictional-only-no-credentials-00000000000000000000000000"};');
  }
  if (url.pathname.startsWith('/data/')) {res.setHeader('Content-Type','application/json');return res.end('{"clubs":[],"age_groups":[],"fixtures":[]}');}
  const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {res.writeHead(404);return res.end();}
  res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
async function seed(page,mode='populated'){
 await page.evaluate(mode=>{
  Object.assign(state.features,{goals:mode!=='minimal',assists:mode!=='minimal',awards:mode!=='minimal',bookings:mode!=='minimal'});
  state.matches=mode==='empty'?[]:[{id:'stats-played',date:'2026-10-18',opponent:'Example United',competition:'Friendly',status:'played',gf:6,ga:4,venue:'H'}, {id:'stats-abandoned',date:'2026-10-25',opponent:'Example Rangers',competition:'Friendly',status:'abandoned',gf:null,ga:null,venue:'A'}];
  state.goals=mode==='empty'?[]:[{matchId:'stats-played',player:'Jamie Example',goals:16}];
  state.assists=mode==='empty'?[]:[{matchId:'stats-played',player:'Jamie Example',assists:3}];
  state.awards=mode==='empty'?[]:[{id:'stats-award',matchId:'stats-played',player:'Jamie Example',type:'Player of the match'}];
  state.bookings=[];
  if(mode==='empty')state.squad=[];
  __appearanceStats=[{player_name:'Jamie Example',appearances:9,starts:7,recorded:10}];
  ClubHubCloud.listPlayerAppearanceStats=async()=>__appearanceStats;
  renderAll();navigate('team-stats',false);renderSeasonPlayerStats();
 },mode);
 await page.locator('#view-team-stats').waitFor({state:'visible'});
 await page.evaluate(()=>document.fonts.ready);
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),page=await browser.newPage(),cases=[],errors=[],writes=[];
 page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(12000);
 await page.route('**/*',route=>{const req=route.request(),u=new URL(req.url());if(u.origin===base)return route.continue();if(req.method()!=='GET')writes.push(u.origin+u.pathname);return route.fulfill({status:200,contentType:'application/json',body:'[]'});});
 try{
  for(const theme of ['light','dark'])for(const width of [320,393,549,700,1024,1440])for(const mode of ['populated','minimal','empty']){
   await prepare(page,'coach',width,theme);await seed(page,mode);
   const m=await page.evaluate(()=>{const root=document.querySelector('#view-team-stats'),grid=root.querySelector('.dashboard-grid'),panels=[...grid.children].filter(e=>e.getClientRects().length),table=root.querySelector('table'),button=root.querySelector('.person-name-button');return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,gridColumns:getComputedStyle(grid).gridTemplateColumns,panels:panels.map(p=>({width:p.getBoundingClientRect().width,x:p.getBoundingClientRect().x,y:p.getBoundingClientRect().y,shadow:getComputedStyle(p).boxShadow,background:getComputedStyle(p).backgroundImage})),titleFont:getComputedStyle(root.querySelector('h2')).fontFamily,tableWidth:table.getBoundingClientRect().width,tableScroll:table.parentElement.scrollWidth,tableClient:table.parentElement.clientWidth,bodyRows:root.querySelectorAll('tbody tr').length,profileTarget:button?.getBoundingClientRect().height,profileDecoration:button?getComputedStyle(button).textDecorationLine:'',heads:root.querySelector('thead').innerText,playerCells:[...root.querySelectorAll('td[data-label]')].map(c=>({label:c.dataset.label,text:c.textContent})),miniShirts:root.querySelectorAll('.mini-jersey').length,emojiBadges:root.querySelectorAll('.shield-mini').length};});cases.push({theme,width,mode,...m});
   assert(m.documentWidth<=width+1,'viewport containment');assert(m.tableScroll<=m.tableClient+1,'contribution rows reflow without horizontal scrolling');assert(m.titleFont.includes('Barlow Condensed'),'current display typography');assert.equal(m.miniShirts,0);assert.equal(m.emojiBadges,0);assert(m.panels.every(p=>p.shadow==='none'&&p.background==='none'),'unboxed ruled sections');
   if(width<700)assert(m.panels.every(p=>Math.abs(p.x-m.panels[0].x)<1),'phone summaries stack');
   if(mode==='empty')assert((await page.locator('#season-player-stats-body').innerText()).includes('No active players yet.'));
   else{assert(m.profileTarget>=44,'profile touch target');assert.equal(m.profileDecoration,'none','no legacy underlined name');const row=page.locator('#season-player-stats-body tr').filter({hasText:'Jamie Example'});assert.equal(await row.locator('[data-label="Apps"]').textContent(),'9');assert.equal(await row.locator('[data-label="Attendance"]').textContent(),'90%');
    if(mode==='populated'){assert.equal(await row.locator('[data-label="Goals"]').textContent(),'16');assert.equal(await row.locator('[data-label="Assists"]').textContent(),'3');assert.equal(await row.locator('[data-label="G+A"]').textContent(),'19');assert.equal(await row.locator('[data-label="Awards"]').textContent(),'1');assert.match(await page.locator('#recent-matches').innerText(),/Abandoned/);assert.equal(await page.locator('#top-scorers .rank-value').textContent(),'16');}
    else assert.equal(await row.locator('[data-label="Goals"],[data-label="Assists"],[data-label="Awards"],[data-label="G+A"]').count(),0,'disabled feature columns absent');
   }
   if([393,1440].includes(width)&&mode==='populated')await page.screenshot({path:path.join(out,width+'-'+theme+'.png'),fullPage:true});
   if(width===393&&mode==='populated'){await page.locator('.award-history-inline>summary').click();assert(await page.locator('#awards-list').isVisible(),'native award disclosure retained');await page.locator('.award-history-inline>summary').click();await page.locator('#view-team-stats [data-nav="matches"]').click();assert.equal(await page.evaluate(()=>currentView),'matches','All matches action retained');}
  }
  for(const theme of ['light','dark']){await prepare(page,'coach',320,theme);await seed(page);await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'200% text reflows');await page.screenshot({path:path.join(out,'320-'+theme+'-text200.png'),fullPage:true});}
  for(const role of ['parent','player']){await prepare(page,role,393,'light');await page.evaluate(()=>navigate('team-stats',false));assert.notEqual(await page.evaluate(()=>currentView),'team-stats',role+' restricted age cannot enter stats');}
  assert.deepEqual(errors,[],'no native runtime errors');assert.deepEqual(writes,[],'no external writes');console.log('PASS native team stats: '+cases.length+' width/theme/feature states, accurate contributions, abandoned label, phone reflow, current typography, 44px controls, award disclosure, navigation, text zoom and restricted roles');
 }finally{fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({cases,errors,writes},null,2));await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
