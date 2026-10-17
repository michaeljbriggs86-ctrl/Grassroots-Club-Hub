// Exercise the real overlay in isolated VMs. All feeds, people and matches are
// fictional; promises control races without network requests or elapsed sleeps.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/static-feed-overlay.js'),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
async function until(check){for(let n=0;n<100;n++){if(check())return;await Promise.resolve();}throw Error('Expected asynchronous checkpoint was not reached');}

async function setup(){
 const own='Example Juniors Greens',opponent='Fictional United',division='Under 12 Navy';
 const state={meta:{ageGroup:'U12',teamName:'Greens'},division:{name:division,teamName:own},
  matches:[{id:'fictional-match',date:'2026-10-18',opponent,status:'played',gf:3,ga:2}],
  tactics:{matchdaySelections:{untouched:['fictional-player']}},selkent:{clubUrl:'https://www.selkent.org.uk/public/clubs/499',fixturesUrl:'https://example.invalid/fixtures',fixtures:[{date:'2026-10-18',opponent,time:'09:00'}],results:[{raw:'retained result'}],table:[{team:'retained standings'}],status:'Retained status'}};
 const directory={last_updated:'2026-10-16T20:00:00Z',clubs:[{club_id:499,club_name:'Example Juniors',logo_status:'pilot_verified',logo_source:'club_supplied_private',logo_url:'https://example.invalid/badge.svg',logo_sha256:'a'.repeat(64)}],leagues:[{age_group:'U12',division_name:division,teams:[own,opponent]}],team_club_links:[{team_name:own,club_id:499,club_name:'Example Juniors'}]};
 const results={schema_version:2,provider:'selkent',last_updated:'2026-10-16T20:00:00Z',age_groups:[{age_group:'U12',standings:[{provider_division_id:12,division_name:division,rows:[{team_name:own,played:1,won:1,row_order:1}]}],published_results_status:'verified_scored_rows_v1',published_results:[{provider_division_id:12,date:'2026-10-18',home:own,away:opponent,homeGoals:9,awayGoals:1}],fixtures:[{date:'2026-10-18',time:'10:30',division_name:division,home:own,away:opponent}]}]};
 const calls={network:[],persist:0,save:0,render:0,played:0,tracking:0,badge:0,fallback:0,originalTeams:0,originalAges:0,toasts:[]};
 const control={pending:false,epoch:0,provider:'manual',team:'fictional-team',user:'fictional-coach',club:'fictional-club',role:'coach',parent:false,hold:null,kit:null,kitStarted:false};
 const cloud=()=>({session:{user:{get id(){return control.user;}}},context:{profile:{get club_id(){return control.club;},get role(){return control.role;}}},currentTeam:()=>({id:control.team}),role:()=>control.role,actingAsParent:()=>control.parent});
 const nodes=new Map();
 const window={ClubHubCloud:cloud(),matchActionIsPending:()=>control.pending,matchActionMutationEpoch:()=>control.epoch,
  providerType:()=>control.provider,currentAgeCode:()=> 'U12',leagueTableEnabled:()=>true,isPublishedLeagueTeam:()=>true,
  syncProviderClubTeams:async()=>{calls.originalTeams++;return ['manual teams'];},refreshPublishedLeagueAges:async()=>{calls.originalAges++;return ['manual ages'];},
  nativeHttp:async url=>{const kind=url.includes('directory.json')?'directory':'results';calls.network.push(kind);const hold=control.hold;if(hold?.kind===kind&&!hold.used){hold.used=true;await hold.gate.promise;}return {body:JSON.stringify(kind==='directory'?directory:results)};},
  persistLocalState:()=>calls.persist++,saveState:()=>calls.save++,renderAll:()=>calls.render++,applyPilotOwnClubBadge:()=>calls.badge++,
  nextPublishedFixture:()=>context.state.selkent.fixtures[0],ensureFixtureKitColours:async()=>{if(control.kit){control.kitStarted=true;await control.kit.promise;}},updateFixtureTracking:()=>calls.tracking++,
  syncOwnLeagueMatchesFromSelkent:rows=>{calls.played++;Object.assign(context.state.matches[0],{status:'played',gf:rows[0].homeGoals,ga:rows[0].awayGoals});},
  parseSelkentHtml:()=>({fixtures:[{date:'2026-10-18',opponent:'Fallback Opponent',time:'12:00'}],teams:[]}),
  fetchSelkentSelected:async()=>{calls.fallback++;await control.fallback.promise;return {html:'fictional fallback',url:'https://example.invalid/fixtures'};},
  toast:message=>calls.toasts.push(message)};
 const context={window,state,currentRole:'coach',adminUiMode:'coach',STARTER_DATA:{selkent:{clubUrl:'https://www.selkent.org.uk/public/clubs/499',fixturesUrl:'https://example.invalid/fixtures'}},localStorage:{getItem:()=>null,setItem:()=>{}},document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{disabled:false,className:'',textContent:''});return nodes.get(id);},querySelectorAll:()=>[]},Promise,Date,console};
 vm.runInNewContext(source,context);
 // Let the normal automatic prime observe the manual provider and exit, then
 // explicitly invoke the same exported production functions in each scenario.
 await Promise.resolve();control.provider='selkent';
 const begin=()=>{control.pending=true;control.epoch++;};
 const hold=kind=>{control.hold={kind,used:false,gate:deferred()};return control.hold;};
 return {context,window,api:window.ClubHubStaticSelkent,state,results,directory,calls,control,begin,hold,cloud};
}

const appSource=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app.js'),'utf8');
function appFunction(name){
 const start=appSource.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));
 assert(start>=0,`Production function ${name} exists`);
 const after=appSource.slice(start+1).search(/^(?:async )?function /m);
 return after<0?appSource.slice(start):appSource.slice(start,start+1+after);
}
function appGuardSetup(mode){
 const state={meta:{ageGroup:'U12',teamName:'Example Juniors Greens'},division:{name:'Under 12 Navy',teamName:'Example Juniors Greens'},matches:[],
  tactics:{unrelatedDraft:'retained'},selkent:{enabled:true,clubUrl:'https://example.invalid/own',fixturesUrl:'https://example.invalid/fixtures',kitColours:{'example juniors':'Green'},directoryDetails:{},fixtures:[{date:'2026-10-18',opponent:'Retained opponent'}]}};
 const fixture={date:'2026-10-18',opponent:'Fictional United',opponentClubUrl:'https://example.invalid/opponent'};
 const detail={club_name:'Fictional United',club_colours:'Red',home_ground:{name:'Example Ground',address:'Fictional address'},source_url:'https://www.selkent.org.uk/public/clubs/799',club_id:799};
 const control={pending:false,epoch:0,user:'fictional-coach',club:'fictional-club',team:'fictional-team',role:'coach',parent:false,gate:deferred(),reached:false};
 const calls={fetch:0,json:0,page:0,own:0,opponent:0,detail:0,static:0,selected:0,kit:0,persist:0,queue:0,render:0,tracking:0,toasts:[]};
 const norm=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const cloud=()=>({session:{user:{get id(){return control.user;}}},context:{profile:{get user_id(){return control.user;},get club_id(){return control.club;},get role(){return control.role;}}},currentTeam:()=>({id:control.team}),role:()=>control.role,actingAsParent:()=>control.parent,queueStateSave:()=>calls.queue++});
 const window={ClubHubCloud:cloud(),matchActionIsPending:()=>control.pending,matchActionMutationEpoch:()=>control.epoch};
 const pause=async(key,value)=>{calls[key]++;if(mode===key){control.reached=true;await control.gate.promise;}return value;};
 const render=()=>calls.render++;
 const context={window,state,currentRole:'coach',adminUiMode:'coach',CLOUD_MODE:true,STARTER_DATA:{selkent:{clubUrl:'https://example.invalid/own',fixturesUrl:'https://example.invalid/fixtures'}},SELKENT_DIRECTORY_API:'https://example.invalid/directory',Promise,Date,console,
  selkentNorm:norm,normalizeTeamKey:norm,isLeagueMatch:()=>true,shirtColoursOnly:value=>value,knownKit:value=>!!value&&value!=='TBC',clubSettings:()=>({display_name:'Example Juniors'}),parseClubColours:()=> 'Red',parseSelkentClubGroundOptions:()=>[{name:'Fallback Ground',address:'Fictional fallback address'}],
  fetch:async()=>{await pause('fetch');return {ok:true,json:()=>pause('json',clone(detail))};},
  nativeHttp:async url=>pause(url==='https://example.invalid/own'?'own':url==='https://example.invalid/opponent'?'opponent':'page',{status:200,body:'Fictional provider body'}),
  fetchSelkentSelected:async()=>pause('selected',{html:'Fictional provider page',url:'https://example.invalid/fixtures'}),
  parseSelkentHtml:()=>({fixtures:[clone(fixture)],teams:[]}),nextPublishedFixture:()=>context.state.selkent.fixtures[0],
  persistLocalState:()=>calls.persist++,updateFixtureTracking:()=>calls.tracking++,isCoach:()=>true,
  renderNextMatch:render,renderMatchPageNextFixture:render,refreshMatchAvailability:render,renderSelkentFixtures:render,renderLeagueQuickView:render,renderMatchdayDashboard:render,toast:value=>calls.toasts.push(value)};
 // Include any narrowly shared production background guard, rather than a test
 // reimplementation. The function list is intentionally restricted to the real
 // data/enrichment/scan/import paths exercised below.
 for(const match of appSource.matchAll(/^function (\w*(?:FeedMutation|BackgroundMutation|ProviderMutation)\w*)\(/gm))vm.runInNewContext(appFunction(match[1]),context);
 vm.runInNewContext(['fetchClubDirectoryDetails','ensureFixtureKitColours','scanUpcomingFixtures','stableSyncedMatchId','syncOwnLeagueMatchesFromSelkent'].map(appFunction).join('\n'),context);
 let run;
 if(['fetch','json','page'].includes(mode)){
  if(mode==='page')delete detail.home_ground;
  context.state.selkent.directoryDetails['fictional united']={clubName:'Cached fictional name'};
  run=()=>context.fetchClubDirectoryDetails(fixture.opponent);
 }else if(['own','detail','opponent'].includes(mode)){
  if(mode==='own')delete state.selkent.kitColours['example juniors'];
  // The actual directory method catches provider rejection and returns null.
  context.fetchClubDirectoryDetails=async()=>pause('detail',mode==='detail'?{clubName:'Fictional United',colours:'Red',groundOptions:[{name:'Example Ground',address:'Fictional address'}]}:null).catch(()=>null);
  run=()=>context.ensureFixtureKitColours(fixture);
 }else{
  if(mode==='static')window.ClubHubStaticSelkent={applyStaticFixtures:()=>pause('static',[])};
  context.ensureFixtureKitColours=async()=>pause('kit',true);
  run=()=>context.scanUpcomingFixtures(false);
 }
 return {context,state,fixture,control,calls,window,run,cloud};
}
async function testRealAppGuards(){
 let checks=0;
 for(const mode of ['fetch','json','page','own','detail','opponent','static','selected','kit']){
  const pending=appGuardSetup(mode);pending.control.pending=true;const beforePending=JSON.stringify(pending.context.state);await pending.run();
  assert.equal(JSON.stringify(pending.context.state),beforePending,`${mode}: pending entry preserves team state`);
  assert.equal(Object.values(pending.calls).filter(value=>typeof value==='number').reduce((sum,value)=>sum+value,0),0,`${mode}: pending entry starts no reads or effects`);checks++;
  for(const changed of ['pending','epoch','user','club','team','currentRole','capacity','cloudRole','parent','cloud','state'])for(const outcome of ['resolve','reject']){
   const h=appGuardSetup(mode),task=h.run();await until(()=>h.control.reached);
   if(changed==='pending')h.control.pending=true;
   else if(changed==='epoch')h.control.epoch++;
   else if(changed==='cloud')h.window.ClubHubCloud=h.cloud();
   else if(changed==='state')h.context.state=clone(h.state);
   else if(changed==='currentRole')h.context.currentRole='parent';
   else if(changed==='capacity')h.context.adminUiMode='view';
   else if(changed==='cloudRole')h.control.role='parent';
   else h.control[changed]=changed==='parent'?true:'new-'+changed;
   const before=JSON.stringify({state:h.context.state,fixture:h.fixture}),effects=clone(h.calls);
   h.control.gate[outcome](outcome==='reject'?Error('Fictional delayed provider failure'):undefined);await task;
   assert.equal(JSON.stringify({state:h.context.state,fixture:h.fixture}),before,`${mode}/${changed}/${outcome}: stale production completion cannot mutate state or fixture`);
   assert.deepEqual(h.calls,effects,`${mode}/${changed}/${outcome}: stale production completion cannot read again, persist, queue, render, track or toast`);checks++;
  }
  const ordinary=appGuardSetup(mode),normalTask=ordinary.run();await until(()=>ordinary.control.reached);ordinary.control.gate.resolve();const result=await normalTask;
  assert(result,`${mode}: ordinary response still completes`);
  if(['fetch','json','page'].includes(mode))assert.equal(ordinary.state.selkent.directoryDetails['fictional united'].colours,'Red');
  else if(['own','detail','opponent'].includes(mode))assert.equal(ordinary.calls.persist,1,`${mode}: ordinary enrichment persists once`);
  else assert(ordinary.calls.render>0,`${mode}: ordinary scan still renders`);
  checks++;
 }
 const importer=appGuardSetup('import');const rows=[{date:'2026-10-18',home:'Example Juniors Greens',away:'Fictional United',homeGoals:3,awayGoals:1}];
 importer.control.pending=true;importer.context.syncOwnLeagueMatchesFromSelkent(rows);assert.equal(importer.state.matches.length,0);checks++;
 importer.control.pending=false;importer.context.syncOwnLeagueMatchesFromSelkent(rows);assert.equal(importer.state.matches.length,1);assert.equal(importer.state.matches[0].gf,3);checks++;
 console.log(`PASS actual app match-action background guards: ${checks} deferred read/JSON/enrichment/static/fallback/import races`);
}

(async()=>{
 let checks=0;
 const operations=[
  ['division',h=>h.api.applyStaticDivision(true,true),'directory'],
  ['fixtures',h=>h.api.applyStaticFixtures(true,true),'results'],
  ['standings',h=>h.api.applyStaticStandings(true,true),'results'],
  ['published results',h=>h.api.applyStaticPublishedResults(true),'results'],
  ['club teams',h=>h.window.syncProviderClubTeams(false),'directory'],
  ['published ages',h=>h.window.refreshPublishedLeagueAges(true),'results'],
  ['full sync',h=>h.window.syncSelkent(true),'results'],
  ['table sync',h=>h.window.syncSelkentLeagueTable(true),'results'],
  ['prime',h=>h.api.prime(),'directory']
 ];
 for(const [name,run] of operations){
  const h=await setup(),before=JSON.stringify(h.context.state);h.begin();await run(h);
  assert.equal(JSON.stringify(h.context.state),before,`${name}: pending entry preserves all team state`);
  assert.equal(h.calls.network.length,0,`${name}: pending entry does not begin another mutating refresh`);
  assert.equal(h.calls.save+h.calls.persist+h.calls.played,0);checks++;
 }
 for(const [name,run,kind] of operations)for(const outcome of ['pending','finished','rejected']){
  const h=await setup(),gate=h.hold(kind),task=run(h);
  await until(()=>gate.used);const before=JSON.stringify(h.context.state),writes=h.calls.save+h.calls.persist+h.calls.played;
  h.begin();if(outcome==='finished')h.control.pending=false;
  if(outcome==='rejected')gate.gate.reject(Error('Fictional offline response'));else gate.gate.resolve();
  await task;
  assert.equal(JSON.stringify(h.context.state),before,`${name}/${outcome}: obsolete response never applies to team state`);
  assert.equal(h.calls.save+h.calls.persist+h.calls.played,writes,`${name}/${outcome}: obsolete response never persists or queues state`);
  assert.equal(h.calls.fallback,0,`${name}/${outcome}: cancellation never invokes the live migration fallback`);checks++;
 }
 for(const [name,run,kind] of operations)for(const scope of ['user','club','team','role','viewRole','capacity','parent','cloud','state'])for(const outcome of ['resolve','reject']){
  const h=await setup(),gate=h.hold(kind),task=run(h);
  await until(()=>gate.used);
  if(scope==='cloud')h.window.ClubHubCloud=h.cloud();
  else if(scope==='state')h.context.state=clone(h.state);
  else if(scope==='viewRole')h.context.currentRole='parent';
  else if(scope==='capacity')h.context.adminUiMode='view';
  else h.control[scope]=scope==='parent'?true:'different-'+scope;
  const before=JSON.stringify(h.context.state);
  gate.gate[outcome](outcome==='reject'?Error('Fictional old-scope outage'):undefined);await task;
  assert.equal(JSON.stringify(h.context.state),before,`${name}/${scope}/${outcome}: scope change discards the old response and its error fallback`);
  assert.equal(h.calls.played+h.calls.persist+h.calls.save,0);checks++;
  assert.equal(h.calls.fallback,0,`${name}/${scope}/${outcome}: old-scope error never starts a fallback`);
 }
 // loadDirectory is also used by read-only consumers. Its feed/cache can finish,
 // while the implicit .then(attachDirectoryBadges) team mutation is fenced.
 for(const startedPending of [false,true]){
  const h=await setup(),gate=h.hold('directory');if(startedPending)h.begin();
  const task=h.api.loadDirectory(true);await until(()=>gate.used);
  const before=JSON.stringify(h.context.state);if(!startedPending)h.begin();h.control.pending=false;
  gate.gate.resolve();const result=await task;
  assert.equal(result.clubs.length,1);assert.equal(JSON.stringify(h.context.state),before);
  assert.equal(h.calls.badge,0,'a read-only directory response cannot apply a stale badge');checks++;
 }
 // Fixtures are assigned before optional colour enrichment. Cancellation at the
 // second await must preserve that already-existing draft, but stop everything
 // after it, including result import and the outer saveAndRender.
 for(const outcome of ['resolve','reject']){
  const h=await setup();h.control.kit=deferred();const task=h.window.syncSelkent(true);
  await until(()=>h.control.kitStarted);const before=JSON.stringify(h.context.state),persisted=h.calls.persist;
  h.begin();h.control.pending=false;
  h.control.kit[outcome](outcome==='reject'?Error('Fictional colour outage'):undefined);await task;
  assert.equal(JSON.stringify(h.context.state),before,`colour ${outcome}: earlier draft is retained without later mutations`);
  assert.equal(h.calls.persist,persisted);assert.equal(h.calls.save+h.calls.played+h.calls.tracking,0);checks++;
 }
 // A malformed static fixtures array can legitimately select the live fallback.
 // Its deferred success or rejection must not write/status/save after cancellation.
 for(const outcome of ['resolve','reject']){
  const h=await setup();delete h.results.age_groups[0].fixtures;h.control.fallback=deferred();
  const task=h.window.syncSelkent(true);await until(()=>h.calls.fallback===1);
  const before=JSON.stringify(h.context.state),persisted=h.calls.persist;
  h.begin();h.control.pending=false;
  h.control.fallback[outcome](outcome==='reject'?Error('Fictional fallback outage'):undefined);await task;
  assert.equal(JSON.stringify(h.context.state),before);assert.equal(h.calls.persist,persisted);assert.equal(h.calls.save+h.calls.played,0);checks++;
 }
 const normal=await setup();assert.equal(await normal.window.syncSelkent(true),true);
 assert.equal(normal.calls.save,1);assert.equal(normal.calls.played,1);assert.equal(normal.state.matches[0].gf,9);
 assert.equal(normal.state.selkent.fixtures[0].time,'10:30');assert(normal.calls.badge>0);checks++;
 const manual=await setup();manual.control.provider='manual';
 assert.deepEqual(await manual.window.syncProviderClubTeams(true),['manual teams']);
 assert.deepEqual(await manual.window.refreshPublishedLeagueAges(true),['manual ages']);
 assert.equal(manual.calls.originalTeams,1);assert.equal(manual.calls.originalAges,1);checks++;
 console.log(`PASS static feed match-action guard: ${checks} pending/epoch/scope, directory, enrichment, fallback, preserved-draft and ordinary-provider cases`);
 await testRealAppGuards();
})().catch(error=>{console.error(error);process.exitCode=1;});
