// Render the shipped source with synthetic state only; no authenticated or external services.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'visual-review');
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
 if(pathname==='/__registration_review_pdf'){res.setHeader('Content-Type','application/pdf');res.end(Buffer.from('%PDF-1.4\n% Synthetic document reader fixture only\n%%EOF')); return;}
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
 const modal=await page.locator('#match-detail-dialog').evaluate(el=>({background:getComputedStyle(el).backgroundImage,saveBackground:getComputedStyle(el.querySelector('#save-match-details')).backgroundImage,saveColour:getComputedStyle(el.querySelector('#save-match-details')).backgroundColor,fixtureBackground:getComputedStyle(el.querySelector('#match-detail-versus')).backgroundImage}));
 assert(modal.background.includes('gradient')&&modal.saveBackground==='none'&&modal.saveColour==='rgb(11, 93, 53)'&&modal.fixtureBackground.includes('gradient'),'match dialog uses shared panels and the approved solid primary action: '+JSON.stringify(modal));
 const attendance=page.locator('#match-attendance-list .attendance-switch').first();
 await attendance.waitFor({state:'visible'});const before=await attendance.getAttribute('aria-pressed');await attendance.click();assert.notEqual(await attendance.getAttribute('aria-pressed'),before,'attendance retains its real event handler');
 assert.equal(await page.locator('#coach-match-note').isVisible(),true,'coach notes must be reviewed in the connected coach view');
 const actionBackground=await page.locator('#match-detail-dialog .modal-actions').evaluate(el=>getComputedStyle(el).backgroundColor);assert(!actionBackground.startsWith('rgba('),'sticky actions need an opaque surface over attendance rows');
 await page.screenshot({path:path.join(out,`match-details-${theme}.png`),fullPage:true});
 await page.locator('#coach-match-note').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`match-coach-notes-${theme}.png`),fullPage:true});
 const discardHandler=async dialog=>{assert.match(dialog.message(),/Discard your unsaved match changes/);await dialog.accept();};page.once('dialog',discardHandler);
 await page.locator('#match-detail-cancel').click();page.removeListener('dialog',discardHandler);assert.equal(await page.locator('#match-detail-dialog').isVisible(),false);
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
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,`coach-onboarding-queue-${width}-${theme}.png`),fullPage:true});
 await page.getByRole('button',{name:'Review request',exact:true}).click();await page.getByRole('button',{name:'Approve account & continue'}).click();assert.match(await page.locator('#coach-onboarding-status').innerText(),/identity/);
 await page.locator('#coach-onboard-verified').check();await page.getByRole('button',{name:'Approve account & continue'}).click();await page.getByRole('button',{name:'Continue to qualifications'}).waitFor({state:'visible'});
 await page.locator('#coach-onboard-team').selectOption('extra-team');await page.getByRole('button',{name:'Add team',exact:true}).click();await page.locator('#app-confirm-accept').click();await page.waitForFunction(()=>document.querySelector('.coach-onboarding-form').innerText.includes('Example Blues'));
 await page.getByRole('button',{name:'Continue to qualifications'}).click();await page.waitForFunction(()=>!document.querySelector('[data-coach-onboard-action="next"]').disabled);assert.equal(await page.getByRole('button',{name:'Review qualification records'}).isDisabled(),true);
 assert.match(await page.locator('#coach-onboarding-content').innerText(),/awaiting activation/);
 await page.getByRole('button',{name:'Review setup',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-coach-onboard-action="finish"]').disabled);
 assert.match(await page.locator('#coach-onboarding-content').innerText(),/Onboarding in progress/);assert.match(await page.locator('#coach-onboarding-content').innerText(),/Example Blues/);
 g=await geometry(page);assert(g.documentWidth<=g.viewport+1,'coach setup review must reflow');await page.evaluate(()=>window.scrollTo(0,0));assert(await page.locator('.skip-link').evaluate(el=>el.getBoundingClientRect().bottom<=0),'unfocused skip link stays outside the viewport');await page.screenshot({path:path.join(out,`coach-onboarding-summary-${width}-${theme}.png`),fullPage:true});
 if(width===320){await page.evaluate(()=>document.documentElement.style.fontSize='200%');g=await geometry(page);assert(g.documentWidth<=g.viewport+1,'coach onboarding supports 200% text');assert(await page.locator('.onboarding-progress li').first().evaluate(el=>el.getBoundingClientRect().width>=100),'enlarged progress labels reflow into wider columns');assert.equal(await page.locator('.onboarding-review').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1,'narrow summary labels and values stack');await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,`coach-onboarding-text200-${theme}.png`),fullPage:true});}
 await page.evaluate(()=>{currentRole='parent';ClubHubCoachOnboarding.syncAccess();});assert.equal(await page.locator('#coach-onboarding-content').innerText(),'','parent capacity clears private onboarding');
 return {screen:'coach-onboarding',width,theme,geometry:g};
}
async function adminDirectoryChecks(page,width,theme){
 await page.setViewportSize({width,height:900});await page.goto(base+'/');await page.waitForFunction(()=>typeof renderAll==='function');
 await page.evaluate(theme=>{
  applyTheme(theme);document.querySelector('#app-splash')?.remove();document.body.classList.remove('splash-active','auth-open');document.querySelector('#activation-gate').classList.add('hidden');document.querySelector('.app-shell').classList.remove('account-locked');
  account={role:'admin',user:'Example Admin'};currentRole='admin';adminUiMode='club';state.meta.clubName='Shooters Hill AFC';
  const teams=[{id:'review-greens',ageGroup:'U9',teamName:'Example Greens'},{id:'review-blues',ageGroup:'U10',teamName:'Example Blues'}];
  const coaches=[{user_id:'review-coach',full_name:'Alex Example',role:'coach',team_id:'review-greens',team_name:'Example Greens',age_group:9}];
  const accounts=[...coaches,{user_id:'review-parent',full_name:'Jordan Example',role:'parent',team_id:'review-greens',team_name:'Example Greens',age_group:9}];
  const requests=[{request_id:'review-request',user_id:'review-applicant',person_name:'Morgan Example',person_email:'morgan@example.invalid',requested_role:'assistant_coach',team_id:'review-blues',team_name:'Example Blues',age_group:10}];
  const api={role:()=>currentRole,actingAsParent:()=>false,session:{user:{id:'review-admin'}},context:{profile:{user_id:'review-admin',club_id:'review-club',full_name:'Admin Example',role:'club_admin',is_owner:true}},currentTeam:()=>null,visibleTeamList:()=>teams,
   getClubOverview:async()=>teams.map(team=>({team,state:{squad:[{name:'Invented player',status:'active'}],matches:[],selkent:{fixtures:[]}}})),listClubCoaches:async()=>coaches,listClubAccessAccounts:async()=>accounts,listPendingCoachRequests:async()=>requests,listClubMessages:async()=>[],listAnnouncements:async()=>[],
   reviewCoachRequest:async(id,approve)=>{window.__staffDecision={id,approve};requests.splice(0);return {ok:true};}};
  window.ClubHubCloud=api;window.ClubHubStaticSelkent={loadResults:async()=>({age_groups:[]}),loadDirectory:async()=>({clubs:[]})};
  window.__staffDecision=null;navigate('club-teams',false);
 },theme);
 await page.waitForFunction(()=>document.querySelectorAll('#admin-team-grid [data-admin-open-team]').length===2);await page.evaluate(()=>document.fonts.ready);
 await page.locator('#admin-home-team-search').fill('Alex');assert.equal(await page.locator('#admin-team-grid [data-admin-open-team]').count(),1);
 await page.locator('#admin-home-team-search').fill('');await page.locator('#admin-home-age-select').selectOption('U10');assert.equal(await page.locator('#admin-team-grid [data-admin-open-team]').count(),1);
 await page.locator('#admin-home-age-select').selectOption('');
 const results=[];
 for(const view of ['club-teams','club-coaches','app-access','staff-requests']){
  await page.evaluate(view=>navigate(view,false),view);
  if(view==='club-coaches')await page.locator('#club-coaches-list [data-person-profile]').waitFor({state:'visible'});
  if(view==='app-access'){await page.waitForFunction(()=>document.querySelectorAll('#admin-access-list [data-person-profile]').length===2);await page.locator('#admin-access-filter').selectOption('parent');assert.equal(await page.locator('#admin-access-list [data-person-profile]').count(),1);await page.locator('#admin-access-filter').selectOption('all');}
  if(view==='staff-requests')await page.locator('[data-coach-request-open]').waitFor({state:'visible'});
  const g=await geometry(page);assert(g.documentWidth<=g.viewport+1,view+' cannot overflow');
  const target=view==='club-coaches'?'#club-coaches-panel .admin-people-page':'#view-'+view;
  const measures=await page.locator(target).evaluate(el=>({heading:getComputedStyle(el.querySelector('h2')).fontSize,controls:[...el.querySelectorAll('input,select,button')].filter(x=>x.getBoundingClientRect().width>0).map(x=>({tag:x.tagName,height:x.getBoundingClientRect().height})),font:getComputedStyle(el).fontFamily}));
  console.log('Admin geometry',view,width,theme,JSON.stringify(measures));await page.screenshot({path:path.join(out,view+'-'+width+'-'+theme+'.png'),fullPage:true});assert.equal(measures.heading,'30px');assert(measures.font.includes('Inter'));
  if(width===393){const card=await page.locator(target+' .panel, '+target+' .admin-request-row').first().boundingBox();assert(Math.abs(card.x-20)<1&&Math.abs(card.width-353)<1,'Figma phone card keeps 20px gutters: '+JSON.stringify(card));}
  if(view==='app-access'){const widths=await page.locator('#admin-access-filter').evaluate(el=>({field:el.getBoundingClientRect().width,label:el.parentElement.getBoundingClientRect().width}));assert(Math.abs(widths.field-widths.label)<1,'access filter fills its reviewed slot');}
  assert(measures.controls.every(x=>x.height>=44),view+' controls meet touch size');
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,view+'-'+width+'-'+theme+'.png'),fullPage:true});results.push({view,width,theme,geometry:g,...measures});
 }
 await page.locator('[data-coach-request-open]').click();await page.locator('#staff-request-review-title').waitFor({state:'visible'});assert.match(await page.locator('#staff-request-review-panel').innerText(),/Assistant Coach/);assert.match(await page.locator('#staff-request-review-panel').innerText(),/U10 Example Blues/);
 await page.screenshot({path:path.join(out,'staff-request-review-'+width+'-'+theme+'.png'),fullPage:true});
 if(width===320){await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert((await geometry(page)).documentWidth<=width+1,'request review reflows at 200%');await page.screenshot({path:path.join(out,'staff-request-review-text200-'+theme+'.png'),fullPage:true});await page.evaluate(()=>document.documentElement.style.fontSize='');}
 await page.locator('[data-coach-request-approve]').click();await page.locator('#app-confirm-cancel').click();assert.equal(await page.evaluate(()=>window.__staffDecision),null);
 await page.locator('[data-coach-request-approve]').click();await page.locator('#app-confirm-accept').click();await page.waitForFunction(()=>window.__staffDecision!==null);assert.deepEqual(await page.evaluate(()=>window.__staffDecision),{id:'review-request',approve:true});
 await page.waitForFunction(()=>currentView==='staff-requests');await page.waitForFunction(()=>document.querySelector('#staff-requests-empty').textContent.includes('No staff requests'));
 await page.evaluate(()=>{currentRole='parent';syncStaffRequestContext();});assert.equal(await page.locator('#coach-requests-list').innerText(),'');assert.equal(await page.locator('#staff-request-review-panel').innerText(),'');
 return {screen:'admin-directories',width,theme,results};
}


async function workspaceChecks(page,width,theme){
 await prepareTeam(page,theme);await page.setViewportSize({width,height:900});
 await page.evaluate(()=>{
  CLUB_CONFIGURATION={settings:{...UNIVERSAL_FALLBACK_SETTINGS,display_name:'Shooters Hill AFC',short_name:'Shooters Hill AFC'},rules:[{age_group:15,format:'11v11',players_on_pitch:11,max_registered:18,matchday_max:16,rolling_substitutions:false,player_accounts_allowed:true}]};
  const names=['Alex','Jamie','Casey','Riley','Taylor','Robin','Drew','Jules','Charlie','Jordan'];
  state=normalizeState({meta:{clubName:'Shooters Hill AFC',teamName:'Example Greens',ageGroup:'U9',season:'2026/27'},division:{name:'Example division',teamName:'Shooters Hill AFC Example Greens'},squad:names.map((name,i)=>({name:name+' Example',number:i+1,role:i===0?'goalkeeper':'outfield',status:i===9?'inactive':'active'})),matches:[],features:{tactics:true},selkent:{fixtures:[]}});
  const requests=[{request_id:'parent-review',user_id:'review-parent',parent_name:'Morgan Example',parent_email:'morgan@example.invalid',child_name:'Jamie'}];
  const members=[{user_id:'review-coach',full_name:'Taylor Example',role:'coach'},{user_id:'review-assistant',full_name:'Sam Example',role:'assistant_coach'},{user_id:'review-existing-parent',full_name:'Chris Example',role:'parent'}];
  const links=[{parent_user_id:'review-parent',player_name:'Alex Example',team_id:'synthetic-team'}];
  window.__workspace={requests,members,links,saves:[],approvals:[],failRequests:false};
  window.ClubHubCloud={...window.ClubHubCloud,role:()=>currentRole,actingAsParent:()=>false,session:{user:{id:'synthetic-coach'}},context:{profile:{user_id:'synthetic-coach',full_name:'Taylor Example',club_id:'synthetic-club',role:'coach'}},currentTeam:()=>({id:'synthetic-team',name:'Example Greens',ageGroup:state.meta.ageGroup,age_group:ageGroupNumber()}),visibleTeamList:()=>[],
   listTeamMembers:async()=>members,listParentPlayerLinks:async()=>links,listPlayerAccountLinks:async()=>[],listPendingParentRequests:async()=>{if(window.__workspace.failRequests)throw Error('Fixture failure');return requests;},listContactDirectory:async()=>({self:{user_id:'synthetic-coach'},contacts:[]}),
   listNotifications:async()=>[],listAnnouncements:async()=>[],listMatchAvailability:async()=>window.__workspace.availability||[],listPlayerAppearanceStats:async()=>[],recordAuditEvent:async()=>{},
   queueStateSave:s=>window.__workspace.saves.push(JSON.parse(JSON.stringify(s))),approveParentRequest:async(id,player)=>{window.__workspace.approvals.push({id,player});links.push({parent_user_id:'review-parent',player_name:player,team_id:'synthetic-team'});members.push({user_id:'review-parent',full_name:'Morgan Example',role:'parent'});requests.splice(0);}};
  renderAll();navigate('squad',false);setSquadPage(0);
 });
 await page.evaluate(()=>document.fonts.ready);
 const row=page.locator('#squad-list [data-player-profile]').first();assert.equal(await page.locator('#squad-list [data-player-profile]').count(),10);
 assert.match(await page.locator('#squad-list').innerText(),/Inactive/);
 const bounds=await row.boundingBox();assert(bounds.height>=76,'profile action occupies the whole shirt card');
 if(width===393){
  const squad=await page.locator('#squad-list').evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,columns:getComputedStyle(el).gridTemplateColumns.split(' ').length}));
  const second=await page.locator('#squad-list [data-player-profile]').nth(1).boundingBox();
  assert(Math.abs(squad.left-20)<1&&Math.abs(squad.right-(width-20))<1,'squad retains reviewed 20px phone gutters');
  assert.equal(squad.columns,1,'current 255px minimum card width yields one phone column');
  assert(Math.abs(bounds.x-squad.left)<1&&Math.abs(bounds.x-second.x)<1&&second.y>=bounds.y+bounds.height,'shirt cards share the rail and remain on separate rows');
  assert(await row.locator('.graphic-shirt-art').evaluate(el=>el.complete&&el.naturalWidth>0),'first card loads its independent garment image');
  assert.equal(await row.locator('.graphic-shirt-number').innerText(),'1','shirt number remains native live text');
 }
 assert.equal(await page.locator('#squad-team-name').textContent(),'Squad');assert.equal(await row.evaluate(el=>getComputedStyle(el).textDecorationLine),'none');
 await page.screenshot({path:path.join(out,`squad-${width}-${theme}.png`),fullPage:true});
 await row.click();await page.waitForFunction(()=>document.querySelector('#person-profile-name').textContent==='Alex Example');await page.locator('#person-profile-back').click();
 await page.locator('#squad-tactics-tab').click();assert.equal(await page.locator('#squad-team-name').textContent(),'Match plan');assert.equal(await page.locator('#squad-list-page').isVisible(),false);assert.equal(await page.locator('#add-player-btn').isVisible(),false);
 assert.equal(await page.locator('#tactics-pitch .tactics-player').count(),5);assert.equal(await page.locator('#tactics-bench .tactics-bench-player').count(),4);
 assert.equal(await page.locator('#matchday-squad-picker').isVisible(),false,'rolling squad does not show a capped picker');
 const layout=await page.locator('.tactics-panel').evaluate(el=>({columns:getComputedStyle(el).gridTemplateColumns.split(' ').length,heading:getComputedStyle(document.querySelector('#squad-team-name')).fontSize,pitch:document.querySelector('#tactics-pitch').getBoundingClientRect().toJSON()}));
 const formationOrder=await page.locator('.tactics-formation-card').evaluate(el=>({heading:el.querySelector('h3').getBoundingClientRect().top,field:el.querySelector('select').getBoundingClientRect().top,reset:el.querySelector('button').getBoundingClientRect().top}));assert(formationOrder.heading<formationOrder.field&&formationOrder.field<formationOrder.reset,'formation heading, field and reset follow the review');assert.equal(layout.columns,width>=900?2:1);assert.equal(layout.heading,width>=901?'40px':'32px','squad workspace uses the current shared page heading');
 const controls=await page.locator('#squad-tactics-page :is(button,input,select)').evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().width>0).map(el=>({height:el.getBoundingClientRect().height,tag:el.tagName})));assert(controls.every(el=>el.height>=52),'plan controls are at least 52px: '+JSON.stringify(controls));
 assert((await geometry(page)).documentWidth<=width+1);
 await page.screenshot({path:path.join(out,`match-plan-5v5-${width}-${theme}.png`),fullPage:true});
 const first=page.locator('[data-tactics-id="p1"]');await first.focus();const before=await page.evaluate(()=>state.tactics.positions.p1.x);await first.press('ArrowRight');assert.equal(await page.evaluate(()=>state.tactics.positions.p1.x),before+1);await page.locator('[data-tactics-id="p1"]').press('Shift+ArrowRight');assert.equal(await page.evaluate(()=>state.tactics.positions.p1.x),before+6);
 await page.locator('[data-tactics-id="p1"]').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));const drag=await page.locator('[data-tactics-id="p1"]').boundingBox();await page.mouse.move(drag.x+drag.width/2,drag.y+drag.height/2);await page.mouse.down();await page.mouse.move(drag.x+drag.width/2+15,drag.y+drag.height/2-15,{steps:3});await page.mouse.up();assert(await page.evaluate(()=>state.tactics.positions.p1.y<91),'pointer drag changes the real position');
 await page.locator('[data-tactics-id="p2"]').click();await page.locator('[data-tactics-bench="p6"]').click();assert.equal(await page.locator('[data-tactics-id="p6"]').count(),1,'bench/pitch swap works');
 await page.locator('#tactics-formation').selectOption('2-1-1');assert.equal(await page.evaluate(()=>state.tactics.formation),'2-1-1');await page.locator('#reset-tactics').click();assert.equal(await page.evaluate(()=>state.tactics.lineup.length),9,'reset retains lineup');
 await page.locator('#tactics-focus').fill('Look up before passing');await page.locator('#tactics-focus').blur();assert.equal(await page.evaluate(()=>tacticsMatchPlan().focus),'Look up before passing');assert(await page.evaluate(()=>window.__workspace.saves.some(s=>s.tactics.matchPlanByFixture.general?.focus==='Look up before passing')),'notes reach existing automatic save queue');
 await page.evaluate(()=>{state.meta.ageGroup='U7';state.tactics=null;renderAll();setSquadPage(1);});assert.equal(await page.locator('#tactics-pitch .tactics-player').count(),3);assert.match(await page.locator('#tactics-bench-title').innerText(),/Other game/);assert.equal(await page.locator('#tactics-bench .tactics-bench-player').count(),6);assert.equal(await page.locator('#tactics-pitch .pitch-box').first().isVisible(),false);
 await page.waitForFunction(()=>!document.getElementById('toast').classList.contains('show'));await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,`match-plan-3v3-${width}-${theme}.png`),fullPage:true});
 await page.evaluate(()=>{state.meta.ageGroup='U15';state.squad=Array.from({length:18},(_,i)=>({name:['Alex','Jamie','Casey','Riley','Taylor','Robin','Drew','Jules','Charlie','Jordan','Avery','Morgan','Pat','Lee','Sam','Chris','Quinn','Sky'][i]+' Example',number:i+1,role:i===0?'goalkeeper':'outfield',status:'active'}));state.tactics=null;state.matches=[{id:'plan-fixture',date:'2099-10-20',time:'10:00',opponent:'Example Blues',venue:'H',competition:'Friendly',status:'scheduled'}];state.selkent.fixtures=state.matches.map(f=>({...f}));renderAll();setSquadPage(1);__availabilityFixture=fixtureResponseKey(nextPublishedFixture());__availabilityTeamId='synthetic-team';__availabilityUserId='synthetic-coach';__availabilityRows=[{player_name:'Jamie Example',status:'available'},{player_name:'Casey Example',status:'unsure'},{player_name:'Lee Example',status:'unavailable'}];window.__workspace.availability=__availabilityRows;renderTacticsBoard();return refreshMatchAvailability(false);});
 assert.equal(await page.locator('#matchday-squad-picker').isVisible(),true);assert.equal(await page.locator('#tactics-pitch .tactics-player').count(),0,'standard squad never silently selects a roster');
 page.once('dialog',async d=>{assert.match(d.message(),/marked unavailable/);await d.dismiss();});await page.locator('[data-matchday-player="p14"]').click();await page.waitForFunction(()=>!document.querySelector('[data-matchday-player="p14"]').checked);assert.equal(await page.locator('[data-matchday-player="p14"]').isChecked(),false,'unavailable cancel preserves selection');
 page.once('dialog',async d=>{assert.match(d.message(),/marked unavailable/);await d.accept();});await page.locator('[data-matchday-player="p14"]').click();await page.waitForFunction(()=>document.querySelector('[data-matchday-player="p14"]').checked);assert.equal(await page.locator('[data-matchday-player="p14"]').isChecked(),true);
 await page.locator('#select-all-available').click();assert.equal(await page.locator('[data-matchday-player="p2"]').isChecked(),true);assert.equal(await page.locator('[data-matchday-player="p14"]').isChecked(),false);
 await page.evaluate(()=>{const key=currentTacticsFixtureKey();state.tactics.matchdaySelections[key]=activePlayers().slice(0,13).map(tacticsPlayerId);state.tactics.matchdayAutoPrepared[key]=true;state.tactics.lineup=[];renderTacticsBoard();});assert.equal(await page.locator('#tactics-pitch .tactics-player').count(),11);assert.equal(await page.locator('#tactics-bench .tactics-bench-player').count(),2);
 await page.waitForFunction(()=>!document.getElementById('toast').classList.contains('show'));await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,`match-plan-11v11-${width}-${theme}.png`),fullPage:true});
 await page.evaluate(()=>{state.meta.ageGroup='U9';state.squad=state.squad.slice(0,3);state.matches=[];state.selkent.fixtures=[];state.tactics=null;renderAll();navigate('team-access',false);});await page.locator('[data-profile-source="request"]').waitFor({state:'visible'});assert.equal(await page.locator('#team-player-invite-section').isVisible(),false,'U9 player codes stay hidden');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,`team-access-${width}-${theme}.png`),fullPage:true});
 await page.locator('[data-profile-source="request"]').click();await page.locator('[data-person-action="review-request"]').click();await page.locator('#parent-request-review-dialog').waitFor({state:'visible'});
 const radioLayout=await page.locator('.parent-request-player').first().evaluate(el=>({direction:getComputedStyle(el).flexDirection,height:el.getBoundingClientRect().height}));assert.equal(radioLayout.direction,'row');assert(radioLayout.height>=76);assert.equal(await page.locator('#parent-request-player-list input:checked').count(),0,'submitted name never preselects a player');assert.match(await page.locator('#parent-request-review-child').innerText(),/^Jamie$/);
 await page.screenshot({path:path.join(out,`parent-verification-unselected-${width}-${theme}.png`),fullPage:false});
 page.once('dialog',async d=>{assert.match(d.message(),/Select the correct active squad player/);await d.accept();});await page.locator('#parent-request-approve').click();assert.equal(await page.evaluate(()=>window.__workspace.approvals.length),0);
 await page.locator('#parent-request-player-list input[value="Jamie Example"]').check();await page.locator('#parent-request-approve').click();await page.locator('#app-confirm-dialog').waitFor({state:'visible'});assert.match(await page.locator('#app-confirm-body').innerText(),/typed “Jamie”.*chose Jamie Example/);
 await page.screenshot({path:path.join(out,`parent-confirm-matching-${width}-${theme}.png`),fullPage:true});await page.locator('#app-confirm-cancel').click();assert.equal(await page.evaluate(()=>window.__workspace.approvals.length),0);assert.equal(await page.locator('#parent-request-review-dialog').isVisible(),true);
 await page.locator('#parent-request-player-list input[value="Casey Example"]').check();await page.locator('#parent-request-approve').click();assert.match(await page.locator('#app-confirm-body').innerText(),/typed “Jamie”.*chose Casey Example/);await page.screenshot({path:path.join(out,`parent-confirm-mismatch-${width}-${theme}.png`),fullPage:true});await page.locator('#app-confirm-accept').click();await page.waitForFunction(()=>currentView==='team-access'&&!document.querySelector('#parent-request-review-dialog').open);
 assert.deepEqual(await page.evaluate(()=>window.__workspace.approvals),[{id:'parent-review',player:'Casey Example'}]);assert.deepEqual(await page.evaluate(()=>window.__workspace.links.map(l=>l.player_name)),['Alex Example','Casey Example']);await page.waitForFunction(()=>document.querySelectorAll('#team-members-list [data-profile-source="request"]').length===0);assert.match(await page.locator('#team-members-list').innerText(),/Morgan Example/);
 await page.screenshot({path:path.join(out,`team-access-approved-${width}-${theme}.png`),fullPage:true});await page.waitForFunction(()=>!document.getElementById('toast').classList.contains('show'));await page.screenshot({path:path.join(out,`team-access-approved-settled-${width}-${theme}.png`),fullPage:true});
 await page.evaluate(async()=>{window.__workspace.failRequests=true;await refreshTeamMembers(false);});assert.match(await page.locator('#team-members-list').innerText(),/Could not load parent requests/);assert.match(await page.locator('#team-members-list').innerText(),/Morgan Example/);await page.screenshot({path:path.join(out,`team-access-partial-error-${width}-${theme}.png`),fullPage:true});
 if(width===320){await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert((await geometry(page)).documentWidth<=width+1,'Team Access reflows at 200%');const navLabels=await page.locator('.mobile-primary-item>span').evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().width>0).map(el=>({label:el.getBoundingClientRect().toJSON(),button:el.parentElement.getBoundingClientRect().toJSON()})));assert(navLabels.every(x=>x.label.left>=x.button.left-1&&x.label.right<=x.button.right+1),'enlarged navigation labels stay inside their own targets');await page.screenshot({path:path.join(out,`team-access-text200-${theme}.png`),fullPage:true});await page.evaluate(()=>{document.documentElement.style.fontSize='';window.__workspace.failRequests=false;window.__workspace.requests.push({request_id:'parent-zoom',user_id:'review-parent',parent_name:'Morgan Example',parent_email:'morgan@example.invalid',child_name:'Jamie'});__pendingParentRequests=window.__workspace.requests;openParentRequestReview('parent-zoom');document.documentElement.style.fontSize='200%';});assert((await geometry(page)).documentWidth<=width+1,'parent verification reflows at 200%');assert(await page.locator('#parent-request-review-form').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'parent review form does not overflow');await page.screenshot({path:path.join(out,`parent-verification-text200-${theme}.png`),fullPage:false});await page.evaluate(()=>{document.querySelector('#parent-request-review-dialog').close();document.documentElement.style.fontSize='';});}
 await page.evaluate(()=>{state.squad=[];renderSquad();navigate('squad',false);setSquadPage(1);});assert.match(await page.locator('#tactics-empty').innerText(),/add players/);assert.equal(await page.locator('#tactics-pitch .tactics-player').count(),0);await page.screenshot({path:path.join(out,`match-plan-empty-${width}-${theme}.png`),fullPage:true});
 return {screen:'team-workspace',width,theme,bounds,layout,controls};
}

async function latestMatchChecks(page,width,theme){
 await prepareTeam(page,theme);await page.setViewportSize({width,height:1000});
 await page.evaluate(()=>{
  const api=window.ClubHubCloud;window.__reportTest={failCore:false,failNote:true,failAttendance:false,writes:[],note:'',attendance:[]};
  Object.assign(api,{queueStateSave:()=>{},confirmStateSave:async()=>{if(__reportTest.failCore)throw Error('Synthetic offline');return {revision:2};},saveCoachMatchNote:async(id,note)=>{if(__reportTest.failNote)throw Error('Synthetic note failure');__reportTest.note=note;},getCoachMatchNote:async()=>({note:__reportTest.note}),saveMatchAttendance:async(id,rows)=>{if(__reportTest.failAttendance)throw Error('Synthetic attendance failure');__reportTest.attendance=rows;},recordAuditEvent:async()=>({ok:true})});
  const m=state.matches.find(m=>m.id==='review-fixture');Object.assign(m,{date:'2026-10-11',venue:'A',opponent:'Example Rangers',competition:'Friendly',source:'manual'});renderAll();openMatchEntryChooser();
 });
 assert.match(await page.locator('#match-entry-choices').innerText(),/Example Rangers/);await page.screenshot({path:path.join(out,`match-choose-${width}-${theme}.png`),fullPage:true});
 await page.locator('[data-match-entry-choice]').filter({hasText:'Example Rangers'}).click();await page.waitForFunction(()=>__matchNoteLoaded&&__matchAttendanceLoaded);
 await page.locator('#match-report-gf').fill('2');await page.locator('#match-report-ga').fill('3');
 assert.match(await page.locator('#match-report-home-label').innerText(),/Home · Example Rangers/);assert.match(await page.locator('#match-report-away-label').innerText(),/Away · Shooters/);assert.match(await page.locator('#match-report-club-score').innerText(),/GF 3 · GA 2/);
 assert.match(await page.locator('#match-report-step-label').innerText(),/Step 1 of 6/);
 const sizes=await page.locator('#match-report-gf,#match-report-ga').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().height));assert(sizes.length===2&&sizes.every(h=>h>=52),'both visible score inputs retain the shared 52px target: '+JSON.stringify(sizes));
 assert(await page.locator('#match-detail-form').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.screenshot({path:path.join(out,`match-score-${width}-${theme}.png`),fullPage:true});
 await page.locator('#match-report-next').click();await page.locator('#match-attendance-list [data-attendance-toggle]').first().click();await page.screenshot({path:path.join(out,`match-attendance-${width}-${theme}.png`),fullPage:true});
 await page.locator('#match-report-next').click();await page.locator('#detail-goals-inputs input').first().fill('3');await page.screenshot({path:path.join(out,`match-goals-${width}-${theme}.png`),fullPage:true});
 await page.locator('#match-report-next').click();await page.locator('#detail-assists-inputs input').last().fill('1');await page.screenshot({path:path.join(out,`match-assists-${width}-${theme}.png`),fullPage:true});
 await page.locator('#match-report-next').click();await page.screenshot({path:path.join(out,`match-awards-${width}-${theme}.png`),fullPage:true});
 await page.locator('#match-report-next').click();await page.locator('#coach-match-note').fill('Retained private observation');await page.screenshot({path:path.join(out,`match-notes-${width}-${theme}.png`),fullPage:true});
 await page.locator('#save-match-details').click();await page.waitForFunction(()=>!__matchReportSaveBusy&&document.querySelector('#match-report-outcome').innerText.includes('Partly saved'));
 const partial=await page.locator('#match-report-outcome').innerText();assert.match(partial,/Match data\nsaved/);assert.match(partial,/Attendance\nsaved/);assert.match(partial,/Private coaching notes\nnot saved/);
 assert.deepEqual(await page.evaluate(()=>{const m=state.matches.find(m=>m.id==='review-fixture');return [m.gf,m.ga,m.source]}),[3,2,'manual']);
 await page.screenshot({path:path.join(out,`match-partial-${width}-${theme}.png`),fullPage:true});await page.locator('[data-report-outcome="open"]').click();assert.equal(await page.locator('#coach-match-note').inputValue(),'Retained private observation');
 await page.evaluate(()=>__reportTest.failNote=false);await page.locator('#save-match-details').click();await page.waitForFunction(()=>!__matchReportSaveBusy&&document.querySelector('#match-report-outcome').innerText.includes('Match report saved'));await page.screenshot({path:path.join(out,`match-saved-${width}-${theme}.png`),fullPage:true});await page.locator('[data-report-outcome="back"]').click();
 await page.evaluate(()=>{openMatchReportReview('review-fixture');__reportTest.failCore=true;});await page.waitForFunction(()=>__matchNoteLoaded&&__matchAttendanceLoaded);await page.screenshot({path:path.join(out,`match-report-hub-${width}-${theme}.png`),fullPage:true});
 await page.locator('[data-report-section="detail-goals-section"]').click();await page.locator('#detail-goals-inputs input').first().fill('4');await page.locator('#match-report-return').click();
 await page.locator('[data-report-section="detail-goals-section"]').click();assert.equal(await page.locator('#detail-goals-inputs input').first().inputValue(),'4');await page.locator('#match-report-return').click();await page.locator('#save-match-details').click();await page.waitForFunction(()=>!__matchReportSaveBusy&&document.querySelector('#match-report-outcome').innerText.includes('Report not synced'));await page.screenshot({path:path.join(out,`match-not-synced-${width}-${theme}.png`),fullPage:true});
 await page.locator('[data-report-outcome="open"]').click();await page.locator('[data-report-section="detail-goals-section"]').click();assert.equal(await page.locator('#detail-goals-inputs input').first().inputValue(),'4');await page.locator('#match-report-return').click();await page.evaluate(()=>{__reportTest.failCore=false;__reportTest.failAttendance=true;});await page.locator('#save-match-details').click();await page.waitForFunction(()=>!__matchReportSaveBusy&&document.querySelector('#match-report-outcome').innerText.includes('Partly saved'));assert.match(await page.locator('#match-report-outcome').innerText(),/Attendance\nnot saved/);
 await page.locator('[data-report-outcome="open"]').click();await page.evaluate(()=>__reportTest.failAttendance=false);await page.locator('#save-match-details').click();await page.waitForFunction(()=>!__matchReportSaveBusy);await page.locator('[data-report-outcome="back"]').click();
 await page.evaluate(()=>{openNewMatchForCompetition('Friendly');ensureOpponentOption('Example Rangers');document.querySelector('#match-opponent').value='Example Rangers';updateMatchStatusUI();});
 assert.equal(await page.locator('#match-entry-score').isVisible(),false);await page.screenshot({path:path.join(out,`match-friendly-${width}-${theme}.png`),fullPage:true});
 await page.locator('#match-status').selectOption('played');await page.locator('#match-venue').selectOption('A');await page.locator('#match-gf').fill('2');await page.locator('#match-ga').fill('3');await page.screenshot({path:path.join(out,`match-manual-played-${width}-${theme}.png`),fullPage:true});
 await page.locator('#match-status').selectOption('postponed');assert.equal(await page.locator('#match-gf').inputValue(),'0');assert.equal(await page.locator('#match-entry-goals').isVisible(),false);
 await page.evaluate(()=>{__matchFormDirty=false;resetMatchForm();navigate('matches',false);});
 return {screen:'latest-match-batch',width,theme,inputHeights:sizes,partial};
}
async function registrationChecks(page,width,theme){
 await prepareTeam(page,theme);await page.setViewportSize({width,height:1000});
 await page.evaluate(()=>{
  currentRole='parent';const api={...window.ClubHubCloud};window.ClubHubCloud=api;window.__conductTest={failLoad:false,failSave:true,writes:0};
  Object.assign(api,{role:()=>currentRole,actingAsParent:()=>false,session:{user:{id:'invented-parent'}},context:{profile:{user_id:'invented-parent',club_id:'invented-club',role:'parent'}},listParentPlayerLinks:async()=>[{parent_user_id:'invented-parent',team_id:'synthetic-team',player_name:'Alex'}],listMatchAvailability:async()=>[],getRegistrationContactConduct:async t=>{if(__conductTest.failLoad)throw Error('Not activated');return {ok:true,can_submit:currentRole==='parent',team_id:t.teamId,player_name:t.playerName,season:t.season,team_name:'U9 Example Greens',mobile:'',document:{available:true,id:'approved-document',version:'approved-sha-version',sha256:'approved-sha'},evidence:[]};},readRegistrationConductDocument:async()=>{const r=await fetch('/__registration_review_pdf');return r.blob();},submitRegistrationContactConduct:async t=>{__conductTest.writes++;if(__conductTest.failSave)throw Error('Offline');return {ok:true,submitted:true,team_id:t.teamId,player_name:t.playerName,season:t.season,mobile:t.mobile,evidence:[{adult_user_id:'invented-parent',adult_name:'Jordan Example',mobile:t.mobile,accepted_at:'2026-10-13T12:00:00Z',document_id:'approved-document',document_version:t.documentVersion}],document:{available:true}};}});
  navigate('home',false);ClubHubPersonProfiles.open({kind:'player',name:'Alex'});
 });
 await page.locator('[data-person-action="registration"]').waitFor({state:'visible'});await page.locator('[data-person-action="registration"]').click();await page.locator('#registration-mobile').waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('#registration-conduct-form fieldset').disabled);assert.equal(await page.locator('[data-conduct-action="agree"]').isDisabled(),true);
 await page.locator('#registration-mobile').fill('123');await page.locator('#registration-conduct-form button[type="submit"]').click();assert.match(await page.locator('#registration-conduct-status').innerText(),/valid mobile/);assert.equal(await page.evaluate(()=>__conductTest.writes),0);
 await page.locator('#registration-mobile').fill('+44 7700 900123');await page.screenshot({path:path.join(out,`registration-pending-${width}-${theme}.png`),fullPage:true});
 const popupPromise=page.waitForEvent('popup');await page.locator('[data-conduct-action="read"]').click();const reader=await popupPromise;await page.waitForFunction(()=>document.querySelector('[data-conduct-action="agree"]')&&!document.querySelector('[data-conduct-action="agree"]').disabled);await reader.close();
 assert.match(await page.locator('#registration-acceptance-state').innerText(),/Not accepted/);assert.equal(await page.locator('#registration-mobile').inputValue(),'+44 7700 900123');
 await page.locator('[data-conduct-action="agree"]').click();assert.equal(await page.locator('[data-conduct-action="agree"]').getAttribute('aria-pressed'),'true');await page.locator('[data-conduct-action="agree"]').click();assert.equal(await page.locator('[data-conduct-action="agree"]').getAttribute('aria-pressed'),'false');await page.locator('[data-conduct-action="agree"]').click();await page.screenshot({path:path.join(out,`registration-accepted-${width}-${theme}.png`),fullPage:true});
 await page.locator('#registration-conduct-form button[type="submit"]').click();await page.waitForFunction(()=>document.querySelector('#registration-conduct-status').innerText.includes('not confirmed'));assert.equal(await page.locator('#registration-mobile').inputValue(),'+44 7700 900123');assert.equal(await page.locator('[data-conduct-action="agree"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#registration-conduct-body').getByText('Details submitted',{exact:true}).count(),0);await page.screenshot({path:path.join(out,`registration-not-confirmed-${width}-${theme}.png`),fullPage:true});
 await page.evaluate(()=>__conductTest.failSave=false);await page.locator('#registration-conduct-form button[type="submit"]').click();await page.locator('#registration-conduct-body').getByText('Details submitted',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('+447700900123'))),false);await page.screenshot({path:path.join(out,`registration-submitted-${width}-${theme}.png`),fullPage:true});await page.locator('#registration-conduct-close').click();
 await page.evaluate(()=>{__conductTest.failLoad=true;ClubHubRegistrationConduct.open({playerName:'Alex'});});await page.waitForFunction(()=>document.querySelector('#registration-conduct-status').innerText.includes('temporarily unavailable'));assert.equal(await page.locator('[data-conduct-action="agree"]').isDisabled(),true);await page.locator('#registration-mobile').fill('07700 900123');await page.screenshot({path:path.join(out,`registration-unavailable-${width}-${theme}.png`),fullPage:true});
 if(width===320){await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert(await page.locator('#registration-conduct-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.screenshot({path:path.join(out,`registration-text200-${theme}.png`),fullPage:true});await page.evaluate(()=>document.documentElement.style.fontSize='');}
 await page.evaluate(()=>{currentRole='admin';ClubHubRegistrationConduct.syncAccess();});assert.equal(await page.locator('#registration-conduct-body').innerText(),'');
 await page.evaluate(()=>{const api=window.ClubHubCloud;api.getRegistrationContactConduct=async t=>({ok:true,can_submit:false,team_id:t.teamId,player_name:t.playerName,season:t.season,team_name:'U9 Example Greens',document:{available:true},evidence:[{adult_name:'Jordan Example',mobile:'07700900123',accepted_at:'2026-10-13T12:00:00Z',document_id:'approved-document',document_version:'approved-sha-version'}]});ClubHubRegistrationConduct.open({playerName:'Alex'});});await page.locator('#registration-conduct-body').getByText('Separate registration checks',{exact:true}).waitFor();assert.match(await page.locator('#registration-conduct-body').innerText(),/07700900123/);assert.equal(await page.locator('[data-conduct-action="agree"]').count(),0);await page.screenshot({path:path.join(out,`registration-admin-${width}-${theme}.png`),fullPage:true});await page.locator('#registration-conduct-close').click();
 return {screen:'registration-contact-conduct',width,theme};
}

async function screenshotCorrectionsChecks(page,width,theme){
 await prepareTeam(page,theme);await page.setViewportSize({width,height:780});
 const dashboard=await page.evaluate(async()=>{
  const day=new Date();day.setUTCDate(day.getUTCDate()+7);
  state.selkent.fixtures=[{date:day.toISOString().slice(0,10),opponent:'Example Blues',venue:'H',competition:'League'}];
  renderNextMatch();await renderMatchdayDashboard();
  const card=document.getElementById('next-match-card'),prep=document.getElementById('matchday-dashboard'),other=document.querySelector('#home-team-stats-link');
  const c=card.getBoundingClientRect(),style=getComputedStyle(card),otherStyle=getComputedStyle(other);
  const probe=document.createElement('div');probe.style.cssText='background:var(--sh-panel);box-shadow:var(--sh-shadow);position:absolute;visibility:hidden';document.body.append(probe);
  const probeStyle=getComputedStyle(probe),matchSurface=style.backgroundImage===probeStyle.backgroundImage,sharedShadow=style.boxShadow===probeStyle.boxShadow&&otherStyle.boxShadow===probeStyle.boxShadow;
  probe.style.background='var(--sh-action)';const actionSurface=otherStyle.backgroundImage===getComputedStyle(probe).backgroundImage;probe.remove();
  return {homePrep:!!document.querySelector('#view-home #matchday-dashboard'),matchesPrep:!!document.querySelector('#view-matches #matchday-dashboard'),matchSurface,actionSurface,sharedShadow,matchRadius:style.borderRadius,actionRadius:otherStyle.borderRadius,cardLeft:c.left,cardRight:c.right,otherLeft:other.getBoundingClientRect().left,otherRight:other.getBoundingClientRect().right,viewport:innerWidth,document:document.documentElement.scrollWidth};
 });
 assert.equal(dashboard.homePrep,false,'Home contains one summary and no preparation panel');
 assert.equal(dashboard.matchesPrep,true,'preparation belongs to Matches');
 assert(dashboard.matchSurface&&dashboard.actionSurface&&dashboard.sharedShadow,'Home fixture and stats action use their approved material surfaces and shared depth shadow');
 assert.equal(dashboard.matchRadius,'16px','foreground fixture uses the approved card radius');
 assert.equal(dashboard.actionRadius,'10px','stats link uses the approved action radius');
 assert(Math.abs(dashboard.cardLeft-dashboard.otherLeft)<1,'Home fixture and season actions share their left edge');
 if(width<1400)assert(Math.abs(dashboard.cardRight-dashboard.otherRight)<1,'single-column Home cards share both edges below the desktop grid breakpoint');
 else assert(dashboard.cardRight>dashboard.otherRight,'approved desktop fixture is wider than the lower season column');
 assert(dashboard.document<=dashboard.viewport+1,'dashboard reflows');
 await page.screenshot({path:path.join(out,`dashboard-spacing-${width}-${theme}.png`),fullPage:true});
 await page.evaluate(()=>navigate('matches',false));
 assert(await page.locator('#matchday-dashboard').isVisible(),'coach can use preparation in Matches');
 assert.equal(await page.locator('#matchday-dashboard-title').innerText(),'Next match prep');
 assert(await page.locator('#matchday-open-tactics').isVisible());
 const identity=await page.locator('#matches-next-versus').evaluate(el=>({surface:getComputedStyle(el).backgroundImage,colour:getComputedStyle(el).backgroundColor,copy:getComputedStyle(el.querySelector('strong')).color}));
 assert.equal(identity.surface,'none','fixture identity stays transparent over the reviewed photographic scene');assert.equal(identity.colour,'rgba(0, 0, 0, 0)');
 assert.equal(identity.copy,'rgb(255, 255, 255)','fixture identity remains white over the field in both themes');
 await page.evaluate(()=>{const host=document.getElementById('matches-next-kit-warning');host.innerHTML=kitWarningHtml({kitWarning:'Kit clash likely. Confirm shirt colours with the opposition before kick-off.',awayTeam:'Example Blues'});host.classList.remove('hidden');});
 assert.equal(await page.locator('#matches-next-kit-warning .kit-clash-warning').count(),1,'one warning surface');
 assert.equal(await page.locator('#matches-next-kit-warning.kit-clash-warning').count(),0,'warning host is unstyled');
 const warning=await page.locator('#matches-next-kit-warning .kit-clash-warning').evaluate(el=>{const s=getComputedStyle(el),b=el.querySelector('button');return {background:s.backgroundColor,image:s.backgroundImage,buttonHeight:b.getBoundingClientRect().height,overflow:el.scrollWidth>el.clientWidth+1};});
 assert.equal(warning.background,'rgba(0, 0, 0, 0)');assert.equal(warning.image,'none');assert(warning.buttonHeight>=44);assert.equal(warning.overflow,false);
 await page.screenshot({path:path.join(out,`matches-prep-${width}-${theme}.png`),fullPage:true});
 if(width===320){await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert((await geometry(page)).documentWidth<=width+1);assert(await page.locator('#matches-next-kit-warning .kit-clash-warning').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.screenshot({path:path.join(out,`matches-prep-text200-${theme}.png`),fullPage:true});await page.evaluate(()=>document.documentElement.style.fontSize='');}
 await page.evaluate(async()=>{currentRole='parent';await renderMatchdayDashboard();});assert.equal(await page.locator('#matchday-dashboard').isVisible(),false,'parent cannot see staff prep');
 await page.evaluate(async()=>{currentRole='coach';state.selkent.fixtures=[];state.matches=state.matches.filter(m=>m.status==='played');await renderMatchdayDashboard();});assert.equal(await page.locator('#matchday-dashboard').isVisible(),false,'no fixture hides prep');

 await page.evaluate(()=>{
  currentRole='admin';account={role:'admin',user:'Example Admin'};adminUiMode='club';currentView='club';__clubTab='results';
  document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id==='view-club'));
  document.getElementById('admin-club-overview').classList.add('hidden');document.getElementById('club-results-panel').classList.remove('hidden');
  const squad=[{number:9,name:'Alex Example'},{number:4,name:'Jamie Example'}];
  const resultState={squad,matches:[{id:'report',status:'played',venue:'A',date:'2026-10-11',opponent:'Example Blues',gf:3,ga:0,notes:Array(40).fill('Fictional match notes for scrolling review.').join('\n')}],goals:[{matchId:'report',shirtNumber:9,goals:2},{matchId:'report',shirtNumber:4,goals:1}],awards:[{matchId:'report',shirtNumber:4,type:'Player of the Match'}]};
  __clubResultsRows=internalAdminClubResults([{team:{id:'fictional-team',ageGroup:'U9',teamName:'Example Greens'},state:resultState}]);
  __clubResultsRows.push({ageGroup:15,home:'Example Whites',away:'Example Blues',hg:4,ag:2,date:'2026-10-11',competition:'League'});
  __clubResultsIdentity=clubMatchPageIdentity();openClubMatchSummary('result',0);
 });
 const dialog=page.locator('#club-match-summary-dialog');await dialog.waitFor({state:'visible'});
 assert.match(await page.locator('#club-match-summary-body').innerText(),/Alex Example\s+2/);
 assert.match(await page.locator('#club-match-summary-body').innerText(),/Player of the Match · Jamie Example/);
 const bounds=await dialog.evaluate(el=>{
  const r=el.getBoundingClientRect(),heading=el.querySelector('#club-match-summary-body').getBoundingClientRect();
  return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,padding:heading.left-r.left,scrollable:el.scrollHeight>el.clientHeight,overflow:getComputedStyle(el).overflowY};
 });
 assert(bounds.left>=0&&bounds.right<=width+1&&bounds.top>=0&&bounds.bottom<=780,'summary fits the viewport');
 assert(bounds.padding>=20&&bounds.scrollable&&bounds.overflow==='auto','long report is padded and scrollable');
 await page.screenshot({path:path.join(out,`report-dialog-${width}-${theme}.png`)});
 await dialog.evaluate(el=>el.scrollTop=el.scrollHeight);assert(await dialog.locator('[data-close-dialog]').isVisible(),'close stays reachable in long reports');await page.screenshot({path:path.join(out,`report-dialog-end-${width}-${theme}.png`)});
 await page.evaluate(()=>document.getElementById('club-match-summary-dialog').close());
 await page.evaluate(()=>openClubMatchSummary('result',1));
 assert.match(await page.locator('#club-match-summary-body').innerText(),/A club match report has not been recorded/);
 await page.screenshot({path:path.join(out,`published-dialog-${width}-${theme}.png`)});
 await page.evaluate(()=>document.getElementById('club-match-summary-dialog').close());
 // Real native select, placed inside the same translucent staff directory surface.
 await page.evaluate(()=>{
  const panel=document.getElementById('club-coaches-panel');panel.classList.remove('hidden');document.getElementById('club-results-panel').classList.add('hidden');
  const select=document.getElementById('assign-coach-person');select.innerHTML='<option value="">Choose a person</option>'+Array.from({length:15},(_,i)=>`<option value="person-${i}">Example coach ${i+1} · Coach</option>`).join('');
 });
 const picker=page.locator('#assign-coach-person');await picker.scrollIntoViewIfNeeded();await picker.click();
 const surfaces=await picker.evaluate(el=>({open:el.matches(':open'),background:getComputedStyle(el,'::picker(select)').backgroundColor,option:getComputedStyle(el.options[2]).backgroundColor,maxHeight:getComputedStyle(el,'::picker(select)').maxHeight}));
 assert(surfaces.open,'native picker opens');assert.equal(surfaces.background,theme==='dark'?'rgb(25, 34, 28)':'rgb(255, 255, 255)','floating picker uses the reviewed opaque shared surface');
 assert.equal(surfaces.option,surfaces.background,'unselected options are opaque');
 const onboarding=await page.evaluate(()=>{const shell=document.createElement('div');shell.className='universal-onboarding';const select=document.createElement('select');select.innerHTML='<option>Example club</option>';shell.append(select);document.body.append(shell);const result={background:getComputedStyle(select,'::picker(select)').backgroundColor,copy:getComputedStyle(select,'::picker(select)').color};shell.remove();return result;});assert.equal(onboarding.background,'rgb(255, 255, 255)','white onboarding form keeps a white picker in either theme');assert.equal(onboarding.copy,'rgb(17, 23, 21)','onboarding picker retains dark readable text');
 await page.screenshot({path:path.join(out,`staff-dropdown-${width}-${theme}.png`)});
 await page.keyboard.press('End');await page.keyboard.press('Enter');assert.equal(await picker.inputValue(),'person-14','last option remains reachable by keyboard');
 await page.evaluate(()=>{document.getElementById('club-coaches-panel').classList.add('hidden');document.getElementById('club-results-panel').classList.remove('hidden');__clubResultsRows.push(...Array.from({length:11},(_,i)=>({...__clubResultsRows[1],ageGroup:i+8})));renderClubResultsBrowser();});
 const age=page.locator('#club-results-age');await age.scrollIntoViewIfNeeded();await age.click();
 assert.equal(await age.evaluate(el=>getComputedStyle(el,'::picker(select)').backgroundColor),surfaces.background,'results picker shares the opaque theme');await page.screenshot({path:path.join(out,`age-dropdown-${width}-${theme}.png`)});await page.keyboard.press('End');await page.keyboard.press('Enter');assert.equal(await age.inputValue(),'18','all age options remain reachable');
 await page.evaluate(()=>currentRole='parent');await page.evaluate(()=>openClubMatchSummary('result',0));assert.equal(await dialog.isVisible(),false,'restricted roles cannot open staff report');
 return {screen:'screenshot-corrections',width,theme,dashboard,bounds,surfaces};
}

let base;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,...(process.env.PITCHKIND_CHROMIUM?{executablePath:process.env.PITCHKIND_CHROMIUM}:{}),args:['--no-sandbox']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.fulfill({status:200,contentType:'application/json',body:'[]'}));
 const results=[];
 try{if(process.argv[4]==='screenshot-corrections'){for(const theme of ['dark','light'])for(const width of [320,393,680,1024])results.push(await screenshotCorrectionsChecks(page,width,theme));}else for(const theme of ['dark','light']){for(const width of [360,393,1280])results.push(await loginChecks(page,width,theme));results.push(await teamChecks(page,theme));for(const width of [320,393,680,1024])results.push(await screenshotCorrectionsChecks(page,width,theme));for(const width of [320,393,1280])results.push(await coachOnboardingChecks(page,width,theme));for(const width of [320,393,1280])results.push(await adminDirectoryChecks(page,width,theme));for(const width of [320,393,1024])results.push(await workspaceChecks(page,width,theme));for(const width of [320,393,1024])results.push(await latestMatchChecks(page,width,theme));for(const width of [320,393,720])results.push(await registrationChecks(page,width,theme));}assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({results,errors},null,2));console.log(process.argv[4]==='screenshot-corrections'?'PASS built dropdowns, reports, rapid reopen, staff boundaries and dashboard spacing at 320, 393, 680 and 1024px in both themes':'PASS rendered login, password/parent routes, text zoom, stats navigation, match details, attendance and coach onboarding, directories, Squad, Match Plan and deliberate parent verification in both themes');}
 catch(e){await page.screenshot({path:path.join(out,"failed-check.png"),fullPage:true});throw e;}
 finally{await browser.close();server.close();}
})().then(()=>{
 if(process.argv[4]==='screenshot-corrections')return;
 const result=require('node:child_process').spawnSync(process.execPath,[path.join(__dirname,'verify_more.cjs'),process.argv[2]||'playwright',path.join(out,'more')],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('More browser verification failed');
 const shareResult=require('node:child_process').spawnSync(process.execPath,[path.join(__dirname,'verify_matchday_share.cjs'),process.argv[2]||'playwright',path.join(out,'matchday-share')],{stdio:'inherit'});
 if(shareResult.error)throw shareResult.error;
 if(shareResult.status!==0)throw Error('Matchday share browser verification failed');
}).catch(error=>{console.error(error);server.close();process.exitCode=1;});
