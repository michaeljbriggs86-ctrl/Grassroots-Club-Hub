// Focused Club details QA against the actual built client, with fictional data only.
// Usage from the repo: node <this-file> <playwright-module> <output-dir> [built-assets-dir]
// No authenticated accounts, external requests, repository edits, or real data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.argv[2] || 'playwright');
const root = path.resolve(process.argv[4] || 'cloudflare/web-app/dist');
const out = path.resolve(process.argv[3] || 'club-details-review');
fs.mkdirSync(out, {recursive:true});
assert(fs.existsSync(path.join(root,'index.html')), 'Build the web app before running browser QA');
const appSource = fs.readFileSync(path.join(root,'app.js'),'utf8');
const controlledApp = appSource.replace("bootTracker().catch(err=>console.error('Tracker boot failed',err));", '// Isolated harness controls startup.');
assert.notEqual(controlledApp, appSource, 'The startup interception must still match the built source');
const server = http.createServer((req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  if(pathname === '/cloud-config.js') {
    res.setHeader('Content-Type','text/javascript');
    res.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://clubdetailreview.supabase.co",anonKey:"synthetic-fixture-only-no-service-credentials-0000000000"};');
    return;
  }
  if(pathname.startsWith('/data/')) {
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({last_updated:'2026-10-14T00:00:00Z',clubs:[],divisions:[],results:[],fixtures:[]}));
    return;
  }
  const file = path.resolve(root, '.'+(pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
  if(!file.startsWith(root+path.sep) || !fs.existsSync(file)) {res.writeHead(404);res.end();return;}
  const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'};
  res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
  if(pathname === '/app.js') {res.end(controlledApp);return;}
  fs.createReadStream(file).pipe(res);
});

const names = {
  known:'Example Athletic FC Greens',
  unknown:'Example Athletic FC Unrecorded',
  long:'Example Athletic FC Very Long Fictional Team Name For Narrow Phone Review',
  refresh:'Example Athletic FC Refresh',
  other:'Example Rovers FC Blues',
};
let base;

async function prepareTeam(page,theme,width=393,height=900) {
  await page.setViewportSize({width,height});
  await page.goto(base+'/');
  await page.waitForFunction(() => typeof renderAll === 'function');
  await page.evaluate(({theme,names}) => {
    applyTheme(theme);
    document.getElementById('app-splash')?.remove();
    document.body.classList.remove('splash-active','auth-open');
    document.getElementById('activation-gate').classList.add('hidden');
    document.querySelector('.app-shell').classList.remove('account-locked');
    account={role:'coach',user:'Synthetic coach'};
    currentRole='coach';
    window.__clubDetailFixture={saves:[],audits:[],pending:{},modes:{}};
    Object.assign(window.ClubHubCloud, {
      role:() => currentRole,realRole:() => currentRole,
      actingAsParent:() => currentRole === 'parent',
      isStaffAccount:() => ['admin','coach','assistant_coach'].includes(currentRole),
      currentTeam:() => ({id:'synthetic-team',name:'Greens',age_group:9}),
      canEdit:() => currentRole === 'coach',
      queueStateSave:s => __clubDetailFixture.saves.push(JSON.parse(JSON.stringify(s))),
      recordAuditEvent:async e => {__clubDetailFixture.audits.push(e);return {ok:true};},
      listMatchAttendance:async() => [],getCoachMatchNote:async() => ({note:''}),
      listPlayerAppearanceStats:async() => [],listParentPlayerLinks:async() => [],
      listPlayerAccountLinks:async() => [],listMatchAvailability:async() => [],
    });
    state=normalizeState({meta:{clubName:'Shooters Hill AFC',teamName:'Example Greens',ageGroup:'U9',season:'2026/27'},division:{name:'Fictional division',teamName:names.known,meetingsPerOpponent:2,teams:[]},squad:[],matches:[],goals:[],awards:[],attendance:[],assists:[],bookings:[]});
    state.selkent.directoryDetails={};state.selkent.kitProfiles={};
    const ground={name:'Example Recreation Ground',address:'Example Street, London, ZZ1 1ZZ'};
    const put=(team,extra={}) => state.selkent.directoryDetails[selkentNorm(team)]={clubName:'Example Athletic FC',colours:'Green and White',groundName:ground.name,address:ground.address,groundOptions:[ground],...extra};
    put(names.known);put(names.other,{clubName:'Example Rovers FC',colours:'Blue and White'});
    put(names.unknown,{colours:'TBC',groundName:'Ground TBC',address:'Address TBC',groundOptions:[]});
    put(names.long,{groundName:'Example Community Recreation Ground With A Very Long Fictional Venue Name',address:'A very long fictional venue street address for responsive review, London, ZZ1 1ZZ'});
    state.selkent.kitProfiles[selkentNorm(names.known)]={home:'Green and White',away:'Blue and White'};
    state.selkent.kitProfiles[selkentNorm(names.long)]={home:'Green and White with a very long fictional shirt colour label',away:'Blue and White with a very long fictional shirt colour label'};
    __clubDetailFixture.modes[names.unknown]='error';
    const originalFetch=window.fetch.bind(window);
    window.fetch=(input,options) => {
      const url=new URL(typeof input === 'string' ? input : input.url,location.href),team=url.searchParams.get('team');
      if(team) {
        const mode=__clubDetailFixture.modes[team];
        if(mode === 'deferred')return new Promise(resolve => __clubDetailFixture.pending[team]=resolve);
        if(mode === 'error')return Promise.reject(Error('Synthetic directory offline'));
        return Promise.resolve({ok:true,json:async() => ({club_name:'Example Athletic FC',club_colours:'Green and White'})});
      }
      return originalFetch(input,options);
    };
    renderAll();navigate('home',false);
  },{theme,names});
  await page.evaluate(() => document.fonts.ready);
}

async function open(page,name) {
  await page.evaluate(async name => {
    const dialog=document.getElementById('club-detail-dialog');
    if(dialog.open)dialog.close();
    await openClubDetails(name);
  },name);
  await page.locator('#club-detail-dialog').waitFor({state:'visible'});
}

async function layout(page,label) {
  const result=await page.locator('#club-detail-dialog').evaluate(dialog => {
    const rect=el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const shell=dialog.querySelector('.club-detail-shell'),body=dialog.querySelector('.club-detail-body'),header=dialog.querySelector('.modal-heading'),footer=dialog.querySelector('.modal-actions');
    const done=footer?.querySelector('[data-close-dialog]'),close=header?.querySelector('[data-close-dialog]');
    const footerStyle=getComputedStyle(footer);
    return {viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,dialog:rect(dialog),shell:rect(shell),header:rect(header),body:body&&rect(body),footer:rect(footer),done:done&&rect(done),close:close&&rect(close),shellDisplay:getComputedStyle(shell).display,bodyOverflow:body&&getComputedStyle(body).overflowY,bodyHorizontalOverflow:body&&body.scrollWidth>body.clientWidth+1,footerColumns:footerStyle.gridTemplateColumns.split(' ').length,doneParentWidth:done?.parentElement.clientWidth-parseFloat(footerStyle.paddingLeft)-parseFloat(footerStyle.paddingRight),bodyScrollHeight:body?.scrollHeight,bodyClientHeight:body?.clientHeight};
  });
  assert(result.body,`${label}: scrollable body exists`);
  assert.equal(result.shellDisplay,'grid',`${label}: outer shell uses reviewed grid`);
  assert(['auto','scroll'].includes(result.bodyOverflow),`${label}: body owns scrolling`);
  assert(result.documentWidth<=result.viewport.width+1,`${label}: page cannot overflow horizontally`);
  assert(!result.bodyHorizontalOverflow,`${label}: modal body cannot overflow horizontally`);
  assert(result.dialog.left>=-1&&result.dialog.right<=result.viewport.width+1&&result.dialog.top>=-1&&result.dialog.bottom<=result.viewport.height+1,`${label}: dialog fits usable viewport`);
  assert(result.header.top>=result.dialog.top-1&&result.footer.bottom<=result.dialog.bottom+1,`${label}: header/footer remain inside dialog`);
  assert(result.bodyClientHeight>0,`${label}: body has usable positive height`);
  assert(result.header.bottom<=result.body.top+1,`${label}: body starts below header`);
  assert(result.body.bottom<=result.footer.top+1,`${label}: body never scrolls under the footer`);
  assert(result.close.width>=44&&result.close.height>=44,`${label}: Close target is reachable and at least 44px`);
  assert(result.close.left>=result.header.left-1&&result.close.right<=result.header.right+1&&result.close.top>=result.header.top-1&&result.close.bottom<=result.header.bottom+1,`${label}: Close remains inside header`);
  assert(result.close.left>=-1&&result.close.right<=result.viewport.width+1&&result.close.top>=-1&&result.close.bottom<=result.viewport.height+1,`${label}: Close remains inside viewport`);
  assert(result.done.height>=44,`${label}: Done target is at least 44px`);
  assert.equal(result.footerColumns,1,`${label}: single-column footer`);
  assert(result.done.width>=result.doneParentWidth-2,`${label}: Done fills the footer content width`);
  return result;
}

async function visualChecks(page,width,theme) {
  await prepareTeam(page,theme,width);
  await open(page,names.known);
  assert.equal((await page.locator('#club-detail-title').innerText()).trim(),names.known,'Full original team name is retained');
  assert.equal(await page.locator('#club-detail-club-name').isVisible(),false,'Redundant club-name prefix is hidden');
  assert.equal(await page.locator('#club-detail-kits article').count(),2);
  const kits=await page.locator('#club-detail-kits article').evaluateAll(cards => cards.map(card => {
    const icon=card.querySelector('.match-team-kit'),copy=card.querySelector('strong');
    return {iconRight:icon?.getBoundingClientRect().right,copyLeft:copy?.getBoundingClientRect().left};
  }));
  assert(kits.every(k=>k.iconRight&&k.copyLeft>=k.iconRight-1),'Known kits use a horizontal shirt slot and copy');
  assert.equal(await page.locator('#club-detail-map').isVisible(),true);
  assert.match(await page.locator('#club-detail-map').getAttribute('href'),/^https:\/\/.*maps/);
  assert.match(await page.locator('#club-detail-map-frame').getAttribute('src'),/[?&]output=embed/);
  const mapWidth=await page.locator('#club-detail-map-preview').evaluate(el=>({map:el.getBoundingClientRect().width,venue:el.parentElement.clientWidth,padding:parseFloat(getComputedStyle(el.parentElement).paddingLeft)+parseFloat(getComputedStyle(el.parentElement).paddingRight)}));
  assert(mapWidth.map>=mapWidth.venue-mapWidth.padding-2,'Map fills the venue content width on every layout');
  assert.equal(await page.locator('#club-kit-admin').getAttribute('open'),null,'Editor starts collapsed');
  assert.equal((await page.locator('#club-kit-admin>summary').innerText()).trim(),'Edit shirt colours');
  const disclosure=await page.locator('#club-kit-admin>summary').evaluate(el => getComputedStyle(el,'::after').content);
  assert(disclosure&&disclosure!=='none'&&disclosure!=='normal','Collapsed editor provides a CSS disclosure cue');
  const known=await layout(page,`${width} ${theme} known`);
  await page.screenshot({path:path.join(out,`club-known-${width}-${theme}.png`)});
  await page.locator('#club-detail-dialog .modal-heading [data-close-dialog]').click();
  assert.equal(await page.locator('#club-detail-dialog').isVisible(),false,'Close button retains real handler');

  await open(page,names.unknown);
  assert.equal(await page.locator('#club-detail-kits .match-team-kit').count(),0,'Unknown colours do not depict a coloured garment');
  const unknown=await page.locator('#club-detail-kits article').allTextContents();
  assert(unknown.every(s=>s.includes('Not recorded')),'Both unknown kits explicitly say Not recorded');
  assert.equal(await page.locator('#club-detail-map').isVisible(),false,'No Maps action for an unknown ground');
  assert.equal(await page.locator('#club-detail-map').getAttribute('href'),null,'Unknown ground has no map href');
  assert.equal(await page.locator('#club-detail-map-preview').isVisible(),false);
  assert.equal(await page.locator('#club-detail-map-frame').getAttribute('src'),null);
  await layout(page,`${width} ${theme} unknown`);
  await page.screenshot({path:path.join(out,`club-unknown-${width}-${theme}.png`)});

  await open(page,names.long);
  assert.equal((await page.locator('#club-detail-title').innerText()).trim(),names.long);
  await layout(page,`${width} ${theme} long`);
  await page.screenshot({path:path.join(out,`club-long-${width}-${theme}.png`)});
  await page.locator('#club-kit-admin>summary').click();
  assert.equal(await page.locator('#club-kit-admin').getAttribute('open'),'');
  const fontSelectors=['#club-kit-admin>summary','#club-kit-admin label'];
  const beforeFonts=await page.evaluate(selectors=>selectors.map(selector=>parseFloat(getComputedStyle(document.querySelector(selector)).fontSize)),fontSelectors);
  await page.setViewportSize({width,height:560});
  await page.evaluate(() => document.documentElement.style.fontSize='200%');
  const afterFonts=await page.evaluate(selectors=>selectors.map(selector=>parseFloat(getComputedStyle(document.querySelector(selector)).fontSize)),fontSelectors);
  assert(afterFonts.every((font,i)=>font>beforeFonts[i]*1.9),`${width} ${theme}: disclosure/label copy actually enlarges to 200%`);
  const zoom=await layout(page,`${width} ${theme} short-height 200% editor`);
  await page.locator('#club-detail-title').focus();
  await page.locator('#club-detail-title').press('End');
  await page.waitForFunction(()=>{const title=document.getElementById('club-detail-title');return title.scrollTop+title.clientHeight>=title.scrollHeight-2;});
  assert.equal((await page.locator('#club-detail-title').innerText()).trim(),names.long,'The complete long title remains accessible at enlarged text');
  const body=page.locator('#club-detail-dialog .club-detail-body');
  await body.evaluate(el => el.scrollTop=el.scrollHeight);
  await page.locator('#club-kit-away').focus();
  assert.equal(await page.locator('#club-kit-away').isVisible(),true);
  const focusedBounds=await page.locator('#club-kit-away').evaluate(input=>{
    const i=input.getBoundingClientRect(),b=input.closest('.club-detail-body').getBoundingClientRect();
    return {inside:i.left>=b.left-1&&i.right<=b.right+1&&i.top>=b.top-1&&i.bottom<=b.bottom+1,active:document.activeElement===input};
  });
  assert(focusedBounds.inside&&focusedBounds.active,`${width} ${theme}: focused away field is actually visible inside the scrolling body`);
  await layout(page,`${width} ${theme} focused editor`);
  await page.screenshot({path:path.join(out,`club-editor-text200-${width}-${theme}.png`)});
  await page.locator('#club-detail-dialog .modal-actions [data-close-dialog]').click();
  assert.equal(await page.locator('#club-detail-dialog').isVisible(),false,'Done retains real handler at enlarged text');
  await page.evaluate(() => document.documentElement.style.fontSize='');
  return {width,theme,known,zoom};
}

async function behaviorChecks(page,theme) {
  await prepareTeam(page,theme);
  await open(page,names.known);
  await page.locator('#club-kit-admin>summary').click();
  await page.locator('#club-kit-home-override').fill('Purple shirts; black shorts');
  await page.locator('#club-kit-away').fill('Orange jerseys; black shorts');
  await page.locator('#save-club-kit-profile').click();
  let profile=await page.evaluate(name => state.selkent.kitProfiles[selkentNorm(name)],names.known);
  assert.deepEqual(profile,{home:'Purple',away:'Orange'},'Real save normalises shirt-only text');
  assert.deepEqual(await page.locator('#club-detail-kits article strong').allTextContents(),['Purple','Orange'],'Saved colours repaint both kit cards');
  assert(await page.evaluate(()=>__clubDetailFixture.saves.length)>0,'Save reaches existing state-save queue');
  await page.locator('#club-kit-home-override').fill('');await page.locator('#club-kit-away').fill('');
  await page.locator('#save-club-kit-profile').click();
  assert.equal(await page.evaluate(name=>state.selkent.kitProfiles[selkentNorm(name)],names.known),undefined,'Blank fields erase saved overrides');
  await page.evaluate(()=>{document.getElementById('club-detail-dialog').close();currentRole='parent';account={role:'parent',user:'Synthetic parent'};});
  await open(page,names.known);
  assert.equal(await page.locator('#club-kit-admin').isVisible(),false,'Parent cannot see staff editor');
  const before=await page.evaluate(()=>({profiles:JSON.stringify(state.selkent.kitProfiles),saves:__clubDetailFixture.saves.length,audits:__clubDetailFixture.audits.length}));
  await page.evaluate(()=>{document.getElementById('club-kit-home-override').value='Red';document.getElementById('club-kit-away').value='Yellow';saveClubKitProfile();});
  assert.equal(await page.evaluate(()=>JSON.stringify(state.selkent.kitProfiles)),before.profiles,'Parent cannot invoke staff save handler');
  assert.equal(await page.evaluate(()=>__clubDetailFixture.saves.length),before.saves,'Blocked parent save cannot queue a write');
  assert.equal(await page.evaluate(()=>__clubDetailFixture.audits.length),before.audits,'Blocked parent save cannot emit an audit');

  await page.evaluate(({names})=>{
    currentRole='coach';account={role:'coach',user:'Synthetic coach'};document.getElementById('club-detail-dialog').close();
    state.selkent.directoryDetails[selkentNorm(names.refresh)]={clubName:'Example Athletic FC',colours:'Green and White',groundName:'Ground TBC',address:'Address TBC',groundOptions:[]};
    __clubDetailFixture.modes[names.refresh]='deferred';
    void openClubDetails(names.refresh);
  },{names});
  await page.waitForFunction(name=>!!__clubDetailFixture.pending[name],names.refresh);
  await page.locator('#club-kit-admin').evaluate(el=>el.open=true);
  await page.locator('#club-kit-home-override').fill('Unsaved Purple');
  await page.locator('#club-kit-away').fill('Unsaved Orange');
  await page.locator('#club-kit-away').focus();
  await page.evaluate(name=>__clubDetailFixture.pending[name]({ok:true,json:async()=>({club_name:'Example Athletic FC',club_colours:'Blue and White',home_ground:{name:'Example New Ground',address:'Example New Street, ZZ1 1ZZ'}})}),names.refresh);
  await page.waitForFunction(()=>document.getElementById('club-detail-ground').textContent==='Example New Ground');
  assert.equal(await page.locator('#club-kit-home-override').inputValue(),'Unsaved Purple','Directory refresh preserves typed home draft');
  assert.equal(await page.locator('#club-kit-away').inputValue(),'Unsaved Orange','Directory refresh preserves typed away draft');
  assert.equal(await page.locator('#club-kit-admin').getAttribute('open'),'','Directory refresh preserves editor expansion');
  assert.equal(await page.locator('#club-kit-away').evaluate(el=>document.activeElement===el),true,'Directory refresh preserves draft focus');
  await open(page,names.other);
  assert.equal(await page.locator('#club-kit-admin').getAttribute('open'),null,'Opening another team collapses its editor');
  assert.equal(await page.locator('#club-kit-home-override').inputValue(),'Blue and White','Different team starts from its own values');
  assert.equal(await page.locator('#club-kit-away').inputValue(),'','Different team does not inherit away draft');

  // A directory response may arrive after switching teams. The new identity wins.
  await page.evaluate(({names})=>{
    document.getElementById('club-detail-dialog').close();
    state.selkent.directoryDetails[selkentNorm(names.refresh)]={clubName:'Example Athletic FC',colours:'Green and White',groundOptions:[]};
    delete __clubDetailFixture.pending[names.refresh];void openClubDetails(names.refresh);
  },{names});
  await page.waitForFunction(name=>!!__clubDetailFixture.pending[name],names.refresh);
  await open(page,names.other);
  await page.evaluate(name=>__clubDetailFixture.pending[name]({ok:true,json:async()=>({club_name:'Example Athletic FC',club_colours:'Green and White',home_ground:{name:'Late Example Ground',address:'Late Example Street, ZZ1 1ZZ'}})}),names.refresh);
  await page.waitForFunction(name=>state.selkent.directoryDetails[selkentNorm(name)].groundName==='Late Example Ground',names.refresh);
  assert.equal((await page.locator('#club-detail-title').innerText()).trim(),names.other,'Late response cannot overwrite another team identity');
  assert.equal(await page.locator('#club-detail-ground').innerText(),'Example Recreation Ground','Late response cannot overwrite another team ground');
  await page.locator('#club-detail-dialog .modal-actions [data-close-dialog]').click();
  return {theme,staffSaveAndErase:true,parentGuard:true,draftRefresh:true,teamSwitch:true,lateResponse:true};
}

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,...(process.env.PITCHKIND_CHROMIUM?{executablePath:process.env.PITCHKIND_CHROMIUM}:{}),args:['--no-sandbox']});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin===base)return route.continue();
    // Keep geographic requests isolated; real map URLs are asserted above.
    if(['www.google.com','maps.google.com'].includes(url.hostname)&&url.pathname.startsWith('/maps'))return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#e8efe9;color:#66756d;font:14px sans-serif">Map preview (isolated test)</body></html>'});
    return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
  const results=[];
  try {
    for(const theme of ['dark','light']) {
      for(const width of [320,393,720])results.push(await visualChecks(page,width,theme));
      results.push(await behaviorChecks(page,theme));
    }
    assert.equal(errors.length,0,errors.join('\n'));
    fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({results,errors},null,2));
    console.log('PASS built Club details: 320/393/720px, both themes, known/unknown/long labels, enlarged editor, close actions, staff override save/erase, parent guard, draft refresh and team switch');
  } catch(error) {
    await page.screenshot({path:path.join(out,'failed-check.png'),fullPage:true});throw error;
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
