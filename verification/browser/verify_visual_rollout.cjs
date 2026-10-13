// Render the shipped source with synthetic state only; no authenticated or external services.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('app/src/main/assets'),out=path.resolve(process.argv[3]||'visual-review');
fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const cloud=fs.readFileSync(path.join(root,'cloud.js'),'utf8');
const helpers=cloud.slice(cloud.indexOf('  function authIcon('),cloud.indexOf('  function escapeHtml(',cloud.indexOf('  function authIcon(')));
const authFixture=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')+`<script>
const AUTH_DESIGN_REVISION='visual-review';
function escapeHtml(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
${helpers}
document.getElementById('app-splash').remove();document.body.classList.remove('splash-active');setGateHtml('signin');
</script>`;
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/__login_review.html'){res.setHeader('Content-Type','text/html');res.end(authFixture);return;}
 if(pathname==='/cloud-config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://visualreview.supabase.co",anonKey:"synthetic-fixture-only-no-service-credentials-0000000000"};');return;}
 if(pathname.startsWith('/data/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({last_updated:'2026-10-13T00:00:00Z',clubs:[],divisions:[],results:[],fixtures:[]}));return;}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'};
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
async function geometry(page){return page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,viewport:innerWidth}));}
async function loginChecks(page,width,theme){
 await page.setViewportSize({width,height:900});await page.goto(base+'/__login_review.html');
 await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.evaluate(()=>document.fonts.ready);
 await page.locator('#cloud-email').waitFor({state:'visible'});
 const measurements=await page.evaluate(()=>{
  const gate=document.querySelector('#activation-gate'),card=document.querySelector('.auth-main'),badge=document.querySelector('.auth-brand-lockup');
  const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  return {cardBackground:getComputedStyle(card).backgroundImage,gateBackground:getComputedStyle(gate).backgroundImage,
   brandBackground:getComputedStyle(document.querySelector('.auth-brand')).backgroundColor,inputWeight:getComputedStyle(document.querySelector('#cloud-email')).fontWeight,input:rect('.auth-field'),button:rect('#cloud-auth-submit'),badge:rect('.auth-brand-lockup'),badgeLoaded:badge.complete&&badge.naturalWidth===512,
   card:rect('.auth-main'),font:getComputedStyle(card).fontFamily,iconVisible:getComputedStyle(document.querySelector('.auth-field-icon')).display!=='none'};
 });
 assert(measurements.cardBackground.includes('gradient'),'login card must use the approved gradient');
 assert(measurements.gateBackground.includes('gradient'),'login canvas must use the approved gradient');
 assert(measurements.input.height>=52&&measurements.button.height>=52,'login has 52px fields and buttons');
 assert.equal(measurements.badge.width,width>=1000?136:88,'badge slot matches Figma');
 assert(measurements.badgeLoaded,'original club badge is loaded');assert.equal(measurements.brandBackground,'rgba(0, 0, 0, 0)','old white identity banner must not remain');assert.equal(measurements.inputWeight,'400','input text follows Figma regular weight');assert(!measurements.iconVisible,'Figma fields retain persistent labels without extra icons');
 assert(measurements.font.includes('Inter'));const g=await geometry(page);assert(g.documentWidth<=g.viewport+1,'login cannot overflow horizontally');
 if(width===393)assert(Math.abs(measurements.card.width-353)<2,'phone card width matches Figma');
 await page.locator('#cloud-password-toggle').click();assert.equal(await page.locator('#cloud-password').getAttribute('type'),'text');assert.equal(await page.locator('#cloud-password-toggle').getAttribute('aria-pressed'),'true');
 await page.locator('#cloud-password-toggle').click();assert.equal(await page.locator('#cloud-password').getAttribute('type'),'password');
 await page.screenshot({path:path.join(out,`login-${width}-${theme}.png`),fullPage:true});
 await page.locator('#cloud-parent-login').click();assert.equal(await page.locator('#activation-gate').getAttribute('data-auth-mode'),'parentsignin');
 await page.locator('#auth-screen-back').click();assert.equal(await page.locator('#activation-gate').getAttribute('data-auth-mode'),'signin');
 if(width===360){await page.evaluate(()=>document.documentElement.style.fontSize='200%');const zoom=await geometry(page);assert(zoom.documentWidth<=zoom.viewport+1,'200% login text cannot overflow');await page.screenshot({path:path.join(out,`login-text200-${theme}.png`),fullPage:true});}
 return {screen:'login',width,theme,...measurements};
}
async function prepareTeam(page,theme){
 await page.setViewportSize({width:393,height:900});await page.goto(base+'/');await page.waitForFunction(()=>typeof renderAll==='function');
 await page.evaluate(theme=>{
  applyTheme(theme);document.querySelector('#app-splash')?.remove();document.body.classList.remove('splash-active','auth-open');document.querySelector('#activation-gate').classList.add('hidden');document.querySelector('.app-shell').classList.remove('account-locked');
  account={role:'coach',user:'Synthetic coach'};currentRole='coach';
  // Enable the real connected-coach UI using in-memory fixtures only.
  Object.assign(window.ClubHubCloud,{currentTeam:()=>({id:'synthetic-team',name:'Example Greens',age_group:9}),canEdit:()=>true,listMatchAttendance:async()=>[],getCoachMatchNote:async()=>({note:''}),listPlayerAppearanceStats:async()=>[]});
  state=normalizeState({meta:{clubName:'Shooters Hill AFC',teamName:'Example Greens',ageGroup:'U9',season:'2026/27'},division:{name:'Example division',teamName:'Shooters Hill AFC Example Greens',meetingsPerOpponent:2,teams:['Example Blues']},squad:[{name:'Alex',number:4,role:'outfield',status:'active'},{name:'Jamie',number:8,role:'outfield',status:'active'}],matches:[{id:'review-fixture',date:'2026-10-18',time:'10:00',opponent:'Example Blues',venue:'H',competition:'Division',status:'scheduled',homeKitColours:'Green',awayKitColours:'Green'},{id:'review-result',date:'2026-10-11',opponent:'Example Blues',venue:'H',competition:'Division',status:'played',gf:2,ga:1}],goals:[{matchId:'review-result',player:'Alex',goals:2}],awards:[{matchId:'review-result',player:'Jamie',type:'Player of the Match'}],features:{goals:true,assists:true,awards:true,bookings:false},attendance:[],assists:[],bookings:[]});renderAll();navigate('home',false);
 },theme);await page.evaluate(()=>document.fonts.ready);
}
async function teamChecks(page,theme){
 await prepareTeam(page,theme);await page.locator('#home-team-stats-link').click();await page.locator('#team-stats-title').waitFor({state:'visible'});
 assert.equal(await page.locator('#season-player-stats').isVisible(),true);assert.equal(await page.locator('#top-scorers').isVisible(),true);
 const ranking=await page.locator('#top-scorers .rank-value').evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
 assert.notEqual(ranking.color,'rgb(22, 136, 72)','statistics cannot retain unreadable legacy green');
 await page.screenshot({path:path.join(out,`team-stats-${theme}.png`),fullPage:true});
 await page.locator('#view-team-stats .page-back').click();await page.evaluate(()=>openMatchDetails('review-fixture'));
 await page.locator('#match-detail-dialog').waitFor({state:'visible'});
 const modal=await page.locator('#match-detail-dialog').evaluate(el=>({background:getComputedStyle(el).backgroundImage,saveBackground:getComputedStyle(el.querySelector('#save-match-details')).backgroundImage,fixtureBackground:getComputedStyle(el.querySelector('#match-detail-versus')).backgroundImage}));
 assert(modal.background.includes('gradient')&&modal.saveBackground.includes('gradient')&&modal.fixtureBackground.includes('gradient'),'match dialog and its actions use the shared gradients: '+JSON.stringify(modal));
 const attendance=page.locator('#match-attendance-list .attendance-switch').first();
 await attendance.waitFor({state:'visible'});const before=await attendance.getAttribute('aria-pressed');await attendance.click();assert.notEqual(await attendance.getAttribute('aria-pressed'),before,'attendance retains its real event handler');
 assert.equal(await page.locator('#coach-match-note').isVisible(),true,'coach notes must be reviewed in the connected coach view');
 const actionBackground=await page.locator('#match-detail-dialog .modal-actions').evaluate(el=>getComputedStyle(el).backgroundColor);assert(!actionBackground.startsWith('rgba('),'sticky actions need an opaque surface over attendance rows');
 await page.screenshot({path:path.join(out,`match-details-${theme}.png`),fullPage:true});
 await page.locator('#coach-match-note').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`match-coach-notes-${theme}.png`),fullPage:true});
 page.once('dialog',async dialog=>{assert.match(dialog.message(),/Discard your unsaved match changes/);await dialog.accept();});
 await page.locator('#match-detail-cancel').click();assert.equal(await page.locator('#match-detail-dialog').isVisible(),false);
 return {screen:'team',theme,ranking,modal};
}
async function coachOnboardingChecks(page,width,theme){
 await page.setViewportSize({width,height:900});await page.goto(base+'/');await page.waitForFunction(()=>typeof renderAll==='function');
 await page.evaluate(theme=>{
  applyTheme(theme);document.querySelector('#app-splash')?.remove();document.body.classList.remove('splash-active','auth-open');document.querySelector('#activation-gate').classList.add('hidden');document.querySelector('.app-shell').classList.remove('account-locked');
  account={role:'admin',user:'Synthetic Admin'};currentRole='admin';adminUiMode='club';state.meta.clubName='Shooters Hill AFC';
  const people=[{user_id:'example-coach',full_name:'Taylor Example',role:'assistant_coach',team_id:'example-team'}],requests=[{request_id:'example-request',user_id:'example-applicant',person_name:'Morgan Example',person_email:'morgan@example.invalid',requested_role:'coach',team_id:'example-team'}],assignments=[{user_id:'example-coach',role:'assistant_coach',team_id:'example-team'}];
  const api={role:()=>currentRole,actingAsParent:()=>false,session:{user:{id:'synthetic-admin'}},context:{profile:{user_id:'synthetic-admin',club_id:'synthetic-club',full_name:'Admin Example',role:'club_admin'}},visibleTeamList:()=>[{id:'example-team',ageGroup:'U9',teamName:'Example Greens'},{id:'extra-team',ageGroup:'U10',teamName:'Example Blues'}],listPendingCoachRequests:async()=>requests,listClubAccessAccounts:async()=>people,listClubCoaches:async()=>assignments,
   getCoachQualifications:async()=>{throw {data:{code:'PGRST202'}};},reviewCoachRequest:async(id,approve)=>{if(approve){people.push({user_id:'example-applicant',full_name:'Morgan Example',role:'coach',team_id:'example-team'});assignments.push({user_id:'example-applicant',role:'coach',team_id:'example-team'});}requests.splice(0);return {ok:true};},assignCoachTeam:async(user_id,team_id)=>{assignments.push({user_id,team_id,role:'coach'});return {ok:true};}};
  window.ClubHubCloud=api;window.__coachFixture=api;
  // Run the real route/module while keeping unrelated club overview requests outside this isolated fixture.
  ClubHubCoachOnboarding.configure({cloud:()=>api,currentView:()=>currentView,allowed:()=>currentRole==='admin'&&adminUiMode==='club',contextKey:()=>currentRole+'|'+adminUiMode,confirm:appConfirm,toast});
  navigate('coach-onboarding',false);
 },theme);
 await page.getByRole('button',{name:'Review request',exact:true}).waitFor({state:'visible'});await page.evaluate(()=>document.fonts.ready);
 let g=await geometry(page);assert(g.documentWidth<=g.viewport+1,'coach onboarding queue must reflow');
 await page.screenshot({path:path.join(out,`coach-onboarding-queue-${width}-${theme}.png`),fullPage:true});
 await page.getByRole('button',{name:'Review request',exact:true}).click();await page.getByRole('button',{name:'Approve account & continue'}).click();assert.match(await page.locator('#coach-onboarding-status').innerText(),/identity/);
 await page.locator('#coach-onboard-verified').check();await page.getByRole('button',{name:'Approve account & continue'}).click();await page.getByRole('button',{name:'Continue to qualifications'}).waitFor({state:'visible'});
 await page.locator('#coach-onboard-team').selectOption('extra-team');await page.getByRole('button',{name:'Add team',exact:true}).click();await page.locator('#app-confirm-accept').click();await page.waitForFunction(()=>document.querySelector('.coach-onboarding-form').innerText.includes('Example Blues'));
 await page.getByRole('button',{name:'Continue to qualifications'}).click();await page.waitForFunction(()=>!document.querySelector('[data-coach-onboard-action="next"]').disabled);assert.equal(await page.getByRole('button',{name:'Review qualification records'}).isDisabled(),true);
 assert.match(await page.locator('#coach-onboarding-content').innerText(),/awaiting activation/);
 await page.getByRole('button',{name:'Review setup',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-coach-onboard-action="finish"]').disabled);
 assert.match(await page.locator('#coach-onboarding-content').innerText(),/Onboarding in progress/);assert.match(await page.locator('#coach-onboarding-content').innerText(),/Example Blues/);
 g=await geometry(page);assert(g.documentWidth<=g.viewport+1,'coach setup review must reflow');await page.screenshot({path:path.join(out,`coach-onboarding-summary-${width}-${theme}.png`),fullPage:true});
 if(width===320){await page.evaluate(()=>document.documentElement.style.fontSize='200%');g=await geometry(page);assert(g.documentWidth<=g.viewport+1,'coach onboarding supports 200% text');assert(await page.locator('.onboarding-progress li').first().evaluate(el=>el.getBoundingClientRect().width>=100),'enlarged progress labels reflow into wider columns');assert.equal(await page.locator('.onboarding-review').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1,'narrow summary labels and values stack');await page.screenshot({path:path.join(out,`coach-onboarding-text200-${theme}.png`),fullPage:true});}
 await page.evaluate(()=>{currentRole='parent';ClubHubCoachOnboarding.syncAccess();});assert.equal(await page.locator('#coach-onboarding-content').innerText(),'','parent capacity clears private onboarding');
 return {screen:'coach-onboarding',width,theme,geometry:g};
}
let base;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.fulfill({status:200,contentType:'application/json',body:'[]'}));
 const results=[];
 try{for(const theme of ['dark','light']){for(const width of [360,393,1280])results.push(await loginChecks(page,width,theme));results.push(await teamChecks(page,theme));for(const width of [320,393,1280])results.push(await coachOnboardingChecks(page,width,theme));}assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({results,errors},null,2));console.log('PASS rendered login, password/parent routes, text zoom, stats navigation, match details, attendance and coach onboarding in both themes');}
 finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
