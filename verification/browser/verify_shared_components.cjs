// Shared presentation checks against built assets and real native routes.
// Fictional in-memory API data only; no authenticated or external services.
// Run after cloudflare/web-app/build.py. External services are blocked.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'shared-components-review');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/cloud-config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://fictional.supabase.co",anonKey:"fictional-only-no-credentials-00000000000000000000000000"};');}
 if(url.pathname.startsWith('/data/')){res.setHeader('Content-Type','application/json');return res.end('{"clubs":[],"age_groups":[],"fixtures":[]}');}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
let base;
async function prepare(page,role,width,theme,confirmed=false){
 await page.setViewportSize({width,height:900});await page.goto(base+'/');await page.waitForFunction(()=>typeof renderAll==='function');
 await page.evaluate(({role,theme,confirmed})=>{
  applyTheme(theme);document.querySelector('#app-splash')?.remove();document.body.classList.remove('splash-active','auth-open');document.querySelector('#activation-gate').classList.add('hidden');document.querySelector('.app-shell').classList.remove('account-locked');
  account={role,user:'Fictional reviewer'};currentRole=role;adminUiMode=role==='admin'?'club':'team';
  window.__sunday={uid:'fictional-'+role,team:'fictional-team',saves:[],links:[{parent_user_id:'fictional-parent',team_id:'fictional-team',player_name:'Alex Example',shirt_number:1},{parent_user_id:'other-parent',team_id:'fictional-team',player_name:'Other Family Child'},{parent_user_id:'fictional-parent',team_id:'other-team',player_name:'Other Team Child'}]};
  const api=window.ClubHubCloud;
  Object.defineProperty(api,'session',{configurable:true,get:()=>({user:{id:__sunday.uid,email:'fictional@example.invalid'}})});
  const context={profile:{user_id:__sunday.uid,club_id:'fictional-club',role:currentRole,full_name:currentRole==='coach'?'Taylor Example':'Fictional '+currentRole},real_role:currentRole};
  Object.defineProperty(api,'context',{configurable:true,get:()=>context});
  Object.assign(api,{role:()=>currentRole,realRole:()=>currentRole,actingAsParent:()=>false,isStaffAccount:()=>role!=='parent',canAdmin:()=>role==='admin',canEdit:()=>role!=='parent',currentTeam:()=>({id:__sunday.team,name:'Example Greens',teamName:'Example Greens',ageGroup:'U9',age_group:9}),visibleTeamList:()=>[{id:'fictional-team',teamName:'Example Greens',ageGroup:'U9'}],listMyCoachTeams:async()=>[],listTeamMembers:async()=>[],listPendingParentRequests:async()=>[],listParentPlayerLinks:async()=>JSON.parse(JSON.stringify(__sunday.links)),listPlayerAccountLinks:async()=>[],listAnnouncements:async()=>[],listNotifications:async()=>[],listPlayerAppearanceStats:async()=>[],listMessageContacts:async()=>[],listClubMessages:async()=>[],listClubCoaches:async()=>[],listPendingCoachRequests:async()=>[],getClubOverview:async()=>[],getCoachQualifications:async()=>({records:[],revision:0}),listMatchAttendance:async()=>[],listMatchAvailability:async()=>[{player_name:'Jamie Example',status:'available'},{player_name:'Morgan Example',status:'unsure'}],saveMatchAvailability:async payload=>__sunday.saves.push(payload),getKickoffPushSettings:async()=>({available:false}),listContactDirectory:async()=>({self:{user_id:__sunday.uid},contacts:[]})});
  fetchClubDirectoryDetails=async()=>({});refreshFixtureOverviewDirectory=()=>{};
  CLUB_CONFIGURATION={settings:{...UNIVERSAL_FALLBACK_SETTINGS,display_name:'Shooters Hill AFC',default_provider_key:'selkent'},providers:[],rules:[],teams:[]};
  const fixture={date:'2099-10-25',opponent:'Example Gunners',competition:'Division',venue:'H',time:''};
  state=normalizeState({meta:{clubName:'Shooters Hill AFC',teamName:'Example Greens',ageGroup:'U9',season:'2026/27'},division:{name:'Under 9 Example',teamName:'Example Greens'},selkent:{enabled:false,fixtures:[fixture],fixtureOverrides:{}},squad:[{name:'Alex Example',number:1,role:'goalkeeper',status:'active'},{name:'Jamie Example',number:4,role:'outfield',status:'active'},{name:'Morgan Example',number:7,role:'outfield',status:'active'},{name:'Riley Example',number:9,role:'outfield',status:'inactive'}],matches:[],goals:[],assists:[],awards:[],features:{tactics:true}});
  if(confirmed)state.selkent.fixtureOverrides[fixtureKitSelectionKey(fixture)]={time:'10:30',groundName:'Example Playing Fields',address:'Fictional public ground address',confirmedAt:'2026-10-22T11:00:00Z'};
  __parentFamilyKey='';__parentFamilyLinks=[];__parentFamilyStatus='loading';renderAll();navigate(role==='admin'?'club':'home',false);
 },{role,theme,confirmed});
 await page.evaluate(()=>document.fonts.ready);
 if(role==='parent')await page.waitForFunction(()=>__parentFamilyStatus==='ready'&&__availabilityLoadStatus==='ready');
 if(role==='admin')await page.waitForFunction(()=>!document.getElementById('admin-club-overview').classList.contains('hidden'));
}
async function seedResults(page){
 await page.evaluate(()=>{
  state.meta.ageGroup='U13';state.meta.teamName='Example Greens';
  state.division={...state.division,name:'Under 13 Example',teamName:'Example Greens',teams:['Willow Rangers'],meetingsPerOpponent:2};
  state.matches=[
   {id:'shared-league',date:'2026-10-18',opponent:'Willow Rangers',competition:'League',venue:'H',status:'played',gf:3,ga:1},
   {id:'shared-away',date:'2026-10-11',opponent:'Willow Rangers',competition:'League',venue:'A',status:'played',gf:0,ga:2},
   {id:'shared-friendly',date:'2026-10-04',opponent:'Meadow United',competition:'Friendly',venue:'H',status:'played',gf:2,ga:2},
   {id:'shared-cup',date:'2026-10-18',opponent:'Willow Rangers',competition:'Selkent Cup One',cupName:'Selkent Cup One',stage:'Round 2',venue:'H',status:'played',gf:4,ga:2},
   {id:'shared-tournament-game',tournamentId:'shared-tournament',date:'2026-10-18',opponent:'Meadow United',competition:'Tournament',stage:'Group',venue:'N',status:'played',gf:1,ga:0}
  ];
  state.tournaments=[{id:'shared-tournament',name:'Sunday fields festival',date:'2026-10-18',format:'group',location:'Example Playing Fields',playerNames:['Alex Example','Jamie Example']}];
  state.selkent.publishedLeagueAges=['U13'];
  CLUB_CONFIGURATION.rules=[{age_group:13,format:'11v11',players_on_pitch:11,max_registered:18,results_published:true}];
  window.ClubHubCloud.currentTeam=()=>({id:__sunday.team,name:'Example Greens',teamName:'Example Greens',ageGroup:'U13',age_group:13});
  window.ClubHubCloud.listSeasonArchives=async()=>[{id:'shared-archive',season:'2025/26',age_group:13,team_name:'Example Greens'}];
  window.ClubHubCloud.getSeasonArchive=async()=>({season:'2025/26',age_group:13,team_name:'Example Greens',snapshot:{team_state:{matches:state.matches,goals:[]}}});
  window.ClubHubCloud.listTeamMembers=async()=>[{user_id:'fictional-assistant',full_name:'Morgan Example',role:'assistant_coach',team_id:__sunday.team}];
  window.ClubHubCloud.listContactDirectory=async()=>({self:{user_id:__sunday.uid,full_name:'Fictional reviewer'},contacts:[{user_id:'fictional-assistant',full_name:'Morgan Example',role:'assistant_coach',kind:'staff',team_id:__sunday.team,team_name:'Example Greens',age_group:13}]});
  renderAll();navigate('matches',false);document.querySelector('#league-programme-panel').open=true;
 });
 await page.evaluate(()=>document.fonts.ready);
}
async function styles(page,selector){
 return page.locator(selector).first().evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {selector:el.id||el.className,background:s.backgroundImage,color:s.color,radius:s.borderRadius,border:s.borderColor,shadow:s.boxShadow,font:s.fontFamily,fontSize:s.fontSize,appearance:s.appearance,customizableNativeSelect:CSS.supports('appearance','base-select'),width:r.width,height:r.height};});
}
async function capture(page,label,width,theme,measurements){
 const g=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth}));
 assert(g.documentWidth<=g.viewport+1,label+' must reflow: '+JSON.stringify(g));
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:path.join(out,`${label}-${width}-${theme}.png`),fullPage:true});
 measurements.push({label,width,theme,...g});
}
async function navigation(page,role,width,theme,expected){
 await prepare(page,role,width,theme);
 if(expected.includes('Table'))await seedResults(page);
 const nav=page.locator('#mobile-primary-nav');
 if(width>=901){assert(!await nav.isVisible(),'desktop keeps desktop navigation');return;}
 const buttons=nav.locator('button:visible');
 assert.deepEqual(await buttons.allTextContents(),expected);
 const m=await buttons.evaluateAll(els=>els.map(el=>{const label=el.querySelector('span'),r=label.getBoundingClientRect();return {text:el.textContent.trim(),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,labelWidth:r.width,labelHeight:r.height,labelLineHeight:parseFloat(getComputedStyle(label).lineHeight),labelScrollWidth:label.scrollWidth,labelClientWidth:label.clientWidth,icons:[...el.querySelectorAll('svg')].some(n=>getComputedStyle(n).display!=='none'),current:el.getAttribute('aria-current')};}));
 assert(m.every(x=>x.height>=58),'navigation retains full touch targets');
 assert(m.every(x=>!x.icons),'phone navigation follows text-only Figma component');
 assert(Math.max(...m.map(x=>x.width))-Math.min(...m.map(x=>x.width))<1,'four/five destinations share equal cells');
 assert(m.every(x=>x.labelHeight<=x.labelLineHeight+1),'normal-size navigation labels remain single-line at '+width+'px: '+JSON.stringify(m));
 assert(m.every(x=>x.labelWidth<=x.width+1&&x.labelScrollWidth<=x.labelClientWidth+1),'navigation labels fit their cells without horizontal clipping: '+JSON.stringify(m));
 assert.equal(m.filter(x=>x.current==='page').length,1,'one destination active');
 await buttons.last().click();await page.waitForFunction(()=>currentView==='more');
 assert.equal(await nav.locator('[aria-current="page"]').innerText(),'More');
 await buttons.first().click();await page.waitForFunction(()=>currentView==='home'||currentView==='club');
 assert.equal(await nav.locator('[aria-current="page"]').innerText(),'Home');
 assert.equal(await nav.locator('button[hidden]:visible').count(),0,'role-hidden destinations stay hidden');
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PITCHKIND_CHROMIUM?{executablePath:process.env.PITCHKIND_CHROMIUM}:{}),args:['--no-sandbox']});
 const page=await browser.newPage(),errors=[],externalWrites=[],measurements=[],materials=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base)return route.continue();if(route.request().method()!=='GET')externalWrites.push(u.origin+u.pathname);return route.fulfill({status:200,contentType:'application/json',body:'[]'});});
 try{
  for(const theme of ['dark','light'])for(const width of [320,393,1440]){
   await navigation(page,'coach',width,theme,['Home','Matches','Squad','More']);
   await capture(page,'coach-nav',width,theme,measurements);
   await navigation(page,'coach',width,theme,['Home','Matches','Table','Squad','More']);
   await page.evaluate(()=>navigate('matches',false));
   const leadActions=await page.locator(':is(#matches-next-fixture,#matchday-dashboard) :is(.primary-button,.secondary-button):visible').evaluateAll(els=>els.map(el=>({label:el.textContent.trim(),primary:el.classList.contains('primary-button'),color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundImage})));
   assert(leadActions.some(x=>x.primary)&&leadActions.some(x=>!x.primary),'render real primary and secondary actions in Matches lead cards');
   for(const action of leadActions){if(action.primary){assert.equal(action.color,'rgb(255, 255, 255)','primary lead action uses readable white copy: '+action.label);const colours=[...action.background.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].map(m=>m.slice(1).map(Number));assert(action.background.includes('gradient')&&colours.length>=2&&colours.every(([r,g,b])=>g>r&&g>b),'primary lead action retains a green gradient: '+JSON.stringify(action));}else{assert.equal(action.color,theme==='light'?'rgb(17, 23, 21)':'rgb(255, 255, 255)','secondary lead action copy contrasts with its theme: '+action.label);assert(action.background.includes('gradient'),'secondary lead actions share raised material');}}
   assert.equal((await styles(page,'#matches-screen-title')).color,'rgb(255, 255, 255)','Matches title stays readable over field imagery in both themes');
   assert.equal(await page.locator('#league-match-list [data-details-match="shared-league"]').count(),1);
   assert.equal(await page.locator('#cup-games-body [data-details-match="shared-cup"]').count(),1);
   const scoreSelectors=['#league-match-list .competition-result-pill','#cup-games-body .competition-result-pill','#division-opponents .division-result-cell','#tournament-event-list .competition-result-pill'];
   const scores=[];for(const selector of scoreSelectors){assert(await page.locator(selector).first().isVisible(),selector+' rendered by existing route');scores.push(await styles(page,selector));}
   assert(scores.every(s=>s.font.includes('Barlow Condensed')),'team/Cup/matrix scores share display type: '+JSON.stringify(scores));
   await page.locator('#cup-games-panel > summary').click();assert(!await page.locator('#cup-games-body').isVisible(),'native disclosure closes');
   await page.locator('#cup-games-panel > summary').click();assert(await page.locator('#cup-games-body').isVisible(),'native disclosure reopens');
   await page.locator('#league-match-list').scrollIntoViewIfNeeded();await capture(page,'team-results',width,theme,measurements);
   await page.locator('#cup-games-panel').scrollIntoViewIfNeeded();await capture(page,'cup-results',width,theme,measurements);
   await page.evaluate(()=>navigate('appearance',false));
   const control=await styles(page,'#appearance-theme');assert(control.height>=52,'native select has consistent touch height');assert.equal(control.radius,'12px','native select corners follow component');
   await page.locator('#appearance-theme').focus();await page.locator('#appearance-theme').press('Space');
   if(control.customizableNativeSelect){const picker=await page.locator('#appearance-theme').evaluate(el=>({open:el.matches(':open'),radius:getComputedStyle(el,'::picker(select)').borderRadius,optionHeight:el.options[0].getBoundingClientRect().height}));assert(picker.open,'supported native picker opens');assert.equal(picker.radius,'12px','supported picker uses shared corners');assert(picker.optionHeight>=48,'supported picker options meet touch height');}
   await page.screenshot({path:path.join(out,`native-select-open-${width}-${theme}.png`),fullPage:true});await page.keyboard.press('Escape');
   const other=theme==='dark'?'light':'dark';await page.locator('#appearance-theme').selectOption(other);assert.equal(await page.locator('html').getAttribute('data-theme'),other,'native change handler retained');await page.locator('#appearance-theme').selectOption(theme);
   await capture(page,'appearance',width,theme,measurements);
   await page.evaluate(()=>navigate('contacts',false));await page.locator('#member-contacts-list .member-contact-card').waitFor({state:'visible'});
   const contact=await styles(page,'#member-contacts-list .member-contact-card'),contactPanel=await styles(page,'#member-contacts-panel');assert.equal(contact.radius,'16px','contact cards share raised geometry');assert.equal(contactPanel.radius,'16px','contact panel shares raised geometry');assert.equal(contact.background,contactPanel.background,'contact card/panel share material');
   await capture(page,'contacts',width,theme,measurements);
   await page.evaluate(()=>navigate('team-access',false));await page.locator('#team-members-list .admin-directory-row').waitFor({state:'visible'});
   const directory=await styles(page,'#team-members-list .admin-directory-row');assert.equal(directory.radius,'10px','directory rows share inset geometry');assert(directory.background.includes('gradient'),'directory retains material depth');await capture(page,'team-access',width,theme,measurements);
   await page.evaluate(()=>navigate('season-history',false));await page.waitForFunction(()=>document.querySelector('#open-season-archive').disabled===false);
   await page.locator('#open-season-archive').click();await page.locator('#season-archive-dialog').waitFor({state:'visible'});
   const archive=await styles(page,'.archive-match-row b');assert(archive.font.includes('Barlow Condensed'),'archive scores use shared score typography');
   await capture(page,'archive',width,theme,measurements);await page.locator('#season-archive-dialog [data-close-dialog]').first().click();
   await page.evaluate(async()=>{navigate('club-results',false);await refreshClubResults(false);__clubResultsWeekend=adminFixtureWeekendKey('2026-10-18');__clubResultsAge='all';__clubResultsCompetition='all';renderClubResultsBrowser();});
   await page.locator('.club-result-card').first().waitFor({state:'visible'});
   const club=await styles(page,'.club-result-card'),clubScore=await styles(page,'.club-result-card .club-card-score');assert(club.background.includes('gradient'),'club results use raised shared material');assert.equal(club.radius,'16px');assert(clubScore.font.includes('Barlow Condensed'));
   await capture(page,'club-results',width,theme,measurements);
   await page.locator('.club-result-card button[data-club-result-detail]').first().click();await page.locator('#club-match-summary-dialog').waitFor({state:'visible'});await capture(page,'result-summary',width,theme,measurements);await page.locator('#club-match-summary-dialog [data-close-dialog]').first().click();
   materials.push({width,theme,leadActions,scores,control,contact,contactPanel,directory,archive,club,clubScore});
   await navigation(page,'admin',width,theme,['Home','Matches','Staff','Onboarding','More']);await capture(page,'admin-nav',width,theme,measurements);
   await navigation(page,'parent',width,theme,['Home','Schedule','Inbox','More']);
   await page.evaluate(()=>navigate('matches',false));assert.equal(await page.locator('#league-match-list [data-details-match]').count(),0,'parent result data remains absent');assert.equal(await page.locator('#cup-games-body [data-details-match]').count(),0,'parent Cup results remain absent');
   await page.evaluate(()=>navigate('club-results',false));assert.equal(await page.evaluate(()=>currentView),'home','parent cannot enter club results');
   await capture(page,'parent-nav',width,theme,measurements);
  }
  await prepare(page,'coach',320,'dark');await seedResults(page);await page.evaluate(()=>{document.documentElement.style.fontSize='200%';navigate('appearance',false);});await capture(page,'appearance-text200',320,'dark',measurements);
  assert.deepEqual(errors,[],'runtime errors');assert.deepEqual(externalWrites,[],'no external writes');
  console.log('PASS shared components: actual built role navigation, native select/disclosure interaction, team/Cup/Club/archive/matrix score type, both themes and phone/desktop/zoom, parent restrictions.');
 }finally{fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({date:new Date().toISOString(),measurements,materials,errors,externalWrites},null,2));await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
