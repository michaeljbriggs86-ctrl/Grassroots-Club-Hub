// Native Admin Home regression for the live 65px response-column failure.
// Fictional API data only. No replacement markup, styles, or external writes.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const {chromium} = require(process.argv[2] || 'playwright');
const root = path.resolve('cloudflare/web-app/dist');
const out = path.resolve(process.argv[3] || 'admin-home-grid-review');
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
async function responseState(page, stateName) {
  await page.evaluate(async stateName => {
    ClubHubKickoffUpdates.resetAdmin();
    ClubHubCloud.listKickoffUpdatesForAdmin = async () => {
      if (stateName === 'loading') return new Promise(() => {});
      if (stateName === 'error') throw Error('Fictional read failure');
      if (stateName === 'empty') return [];
      return [{update_id:'fictional-update',team_id:'fictional-team',team_name:'Example Greens',revision:1,
        details:{date:'2099-10-25',time:'10:30',opponent:'Example visiting team with a longer club name',ground:'Example playing fields',status:'confirmed'},
        coaches:[{user_id:'fictional-coach',name:'Taylor Example',revision_current:true,acknowledged_at:null}],parents:{available:3,pending:2}}];
    };
    if (stateName === 'loading') void ClubHubKickoffUpdates.refreshAdmin(false);
    else await ClubHubKickoffUpdates.refreshAdmin(false);
  }, stateName);
  await page.locator('#kickoff-admin-panel').waitFor({state:'visible'});
}
async function measure(page) {
  return page.evaluate(() => {
    const box = el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const panel=document.getElementById('kickoff-admin-panel'),weekend=document.querySelector('.admin-home-weekend');
    return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,grid:box(panel.parentElement),panel:box(panel),weekend:box(weekend),
      title:box(document.getElementById('kickoff-admin-title')),button:box(panel.querySelector('[data-kickoff-admin-refresh]')),
      people:box(document.getElementById('admin-home-people')),status:document.getElementById('kickoff-admin-status').textContent,
      articles:panel.querySelectorAll('.kickoff-admin-card').length,hidden:panel.hidden,
      canvas:getComputedStyle(weekend).getPropertyValue('--sh-canvas').trim(),
      seenColors:[...weekend.querySelectorAll('#kickoff-weekend-seen p,#kickoff-weekend-seen summary')].filter(el=>el.getClientRects().length).map(el=>({text:el.textContent,color:getComputedStyle(el).color}))};
  });
}
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),cases=[],errors=[],externalWrites=[];
  page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(12000);
  await page.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.origin===base)return route.continue();if(request.method()!=='GET')externalWrites.push(url.origin+url.pathname);return route.fulfill({status:200,contentType:'application/json',body:'[]'});});
  try {
    const widths=process.env.PITCHKIND_GRID_BASELINE==='1'?[1363]:[320,393,768,900,901,1024,1199,1200,1363,1399,1400,1440,1920];
    for(const theme of ['dark','light'])for(const width of widths) {
      await prepare(page,'admin',width,theme);
      for(const stateName of ['loading','empty','error','populated']) {
        await responseState(page,stateName);const m=await measure(page);cases.push({theme,width,stateName,...m});
        assert(m.documentWidth<=m.viewport+1,`${width}/${theme}: viewport containment`);
        assert(m.panel.width>=Math.min(288,m.grid.width)-1,`${width}/${theme}: response panel has readable width, got ${m.panel.width}`);
        for(const b of [m.title,m.button])assert(b.x>=m.panel.x-1&&b.right<=m.panel.right+1,`${width}/${theme}: response title/action inside panel`);
        assert(m.button.height>=52,`${width}/${theme}: native response target`);
        assert(m.seenColors.length,'native weekend acknowledgement status rendered');
        for(const label of m.seenColors)readableOnCanvas(label.color,m.canvas,`${width}/${theme}: ${label.text}`);
        if(width>=1200){assert(Math.abs(m.weekend.y-m.panel.y)<1,`${width}: operational sections share row`);assert(m.panel.x>=m.weekend.right,`${width}: operational columns do not overlap`);}
        else if(width>=901){assert(Math.abs(m.panel.width-m.grid.width)<1,`${width}: smaller desktop stacks full width`);assert(m.panel.y>=m.weekend.bottom,`${width}: response section below weekend`);}
        if(stateName==='populated')assert.equal(m.articles,1,'native response renderer uses fictional API row');
        if(stateName==='error')assert(m.status.includes('Could not load'),'native read failure remains visible');
        if([320,901,1363,1440].includes(width)&&['error','populated'].includes(stateName))await page.screenshot({path:path.join(out,`${width}-${theme}-${stateName}.png`),fullPage:true});
      }
      await page.evaluate(()=>ClubHubKickoffUpdates.resetAdmin());const hidden=await measure(page);assert(hidden.hidden,'reset retains hidden gate');
      if(width>=901)assert(Math.abs(hidden.weekend.width-hidden.grid.width)<1,'weekend fills row without response section');
    }
    for(const width of [320,901,1363])for(const theme of ['dark','light']){
      await prepare(page,'admin',width,theme);await page.evaluate(()=>document.documentElement.style.fontSize='200%');await responseState(page,'populated');
      const m=await measure(page);cases.push({width,theme,textScale:2,...m});assert(m.documentWidth<=m.viewport+1,'enlarged text stays in viewport');assert(m.panel.width>=Math.min(288,m.grid.width)-1,'enlarged response panel stays readable');
      await page.screenshot({path:path.join(out,`${width}-${theme}-text200.png`),fullPage:true});
    }
    await prepare(page,'admin',1363,'dark');await responseState(page,'empty');
    await page.locator('[data-admin-home-action="fixtures"]').click();await page.waitForFunction(()=>__clubTab==='fixtures');
    await prepare(page,'coach',1363,'dark');assert(!await page.locator('#kickoff-admin-panel').isVisible(),'coach cannot see admin response panel');
    for(const theme of ['dark','light']){
      await prepare(page,'parent',1363,theme);assert(!await page.locator('#kickoff-admin-panel').isVisible(),'parent cannot see admin response panel');
      const label=await page.locator('#home-next-title').evaluate(el=>({color:getComputedStyle(el).color,canvas:getComputedStyle(el).getPropertyValue('--sh-canvas').trim()}));
      readableOnCanvas(label.color,label.canvas,`Parent Home ${theme} activity label`);
    }
    assert.deepEqual(errors,[],'no native runtime errors');assert.deepEqual(externalWrites,[],'no external writes');
    console.log(`PASS Admin Home responsive grid: ${cases.length} native state/theme/width cases, hidden state, role gates and Review fixtures navigation`);
  } finally {fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({date:new Date().toISOString(),cases,errors,externalWrites},null,2));await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
