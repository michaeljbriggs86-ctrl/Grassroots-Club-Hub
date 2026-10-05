#!/usr/bin/env node
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const take=(from,to)=>{const a=app.indexOf(from),b=app.indexOf(to,a);assert(a>=0&&b>a,from);return app.slice(a,b);};
const norm=s=>String(s||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim();
const plain=x=>JSON.parse(JSON.stringify(x));
let now='2026-10-04T12:00:00Z';
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return new Date(now).getTime();}}
const cup='U10 Selkent Cup Two - Round 1';
// Exact score-free Group E identities: Punjab v Vikings, Royals v Punjab, Vikings v Royals.
const vikings=[{date:'2026-10-04',competition:cup,opponent:'Punjab United Red',venue:'A',providerTeamIds:['576','974']},{date:'2026-10-04',competition:cup,opponent:'Shooters Hill AFC Royals',venue:'H',providerTeamIds:['974','973']}];
const royals=[{...vikings[0],venue:'H',providerTeamIds:['973','576']},{...vikings[1],opponent:'Shooters Hill AFC Vikings',venue:'A'}];
const fields=['lineupByFixture','positionsByFixture','formationByFixture','matchdaySelections','matchdayAutoPrepared','matchPlanByFixture'];
function node(){const set=new Set();return {innerHTML:'',textContent:'',disabled:false,dataset:{},classList:{add:n=>set.add(n),remove:n=>set.delete(n),contains:n=>set.has(n),toggle(n,f){f?set.add(n):set.delete(n);}},querySelectorAll:()=>[],replaceChildren(){this.innerHTML='';},setAttribute(){},removeAttribute(){},closest:()=>null,showModal(){this.open=true;},close(){this.open=false;}};}
function context(team,fixtures){
 const nodes=new Map();const get=id=>nodes.get(id)||null;
 for(const id of ['selkent-fixtures-list','selkent-fixtures-count','selkent-fixtures-meta','selkent-fixtures-heading','matches-next-played','cup-group-result-dialog','match-availability-panel','coach-availability-summary','match-availability-count','match-availability-warning'])nodes.set(id,node());
 const ctx={CLOUD_MODE:true,currentRole:'coach',Date:Clock,state:{meta:{ageGroup:'U10',teamName:team},division:{teamName:team,name:'Under 10D Navy'},matches:[],selkent:{fixtures:[...fixtures],results:[],fixtureOverrides:{},legacyResponseFixtureKey:''},tactics:Object.fromEntries(fields.map(f=>[f,{}]))},
 ageGroupNumber:()=>10,selkentNorm:norm,normalizeTeamKey:norm,matchTeamLabel:s=>s,ownTeamDisplayName:()=>team,
 matchStatus:m=>m.status||'played',isPublishedLeagueTeam:()=>false,isCoach:()=>['coach','assistant_coach'].includes(ctx.currentRole)||(ctx.currentRole==='admin'&&ctx.dual),
 isAdminTeamPreviewMode:()=>false,requireCoach:()=>ctx.isCoach(),fixtureKitSelectionKey:f=>`${f.date}|${f.opponent}|${f.venue}`,
 window:{ClubHubCloud:{currentTeam:()=>({id:'team-one'}),session:{user:{id:'user-one'}},canEdit:()=>ctx.edit!==false}},
 document:{getElementById:get,createElement:()=>node(),body:{appendChild(){}},querySelectorAll:()=>[]},
 esc:s=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),formatDate:s=>s,
 clubIdentityBadgeHtml:n=>`<img alt="${n}"/>`,setStableHtml:(el,text)=>{if(el)el.innerHTML=text;},
 clubListingHtml:s=>s,kitWarningHtml:()=>'',kitToggleHtml:()=>'',matchTeamSideHtml:(_side,name)=>name,
 toast:()=>{},uid:()=> 'test-match',saveState:()=>{},auditEvent:()=>{},openMatchReport:id=>ctx.opened=id,
 activePlayers:()=>[{name:'Aavi'}],renderParentHomeMatchInfo:()=>{},renderTacticsBoard:()=>{},renderMatchdayDashboard:()=>{},
 fixtureOverviewContext:f=>({homeTeam:team,awayTeam:f.opponent,ground:'Ground',address:'Address'}),
 nodes};
 vm.createContext(ctx);
 vm.runInContext(take('function fixtureLinkedMatch(', 'function fixtureFingerprint(')+take('function homeFixtureTeamNames(', 'function groundOptionsForFixture(')+take('function fixtureOverride(', 'function pilotKitDefaults(')+take('function cupGroupFixtureLines(', 'async function syncSelkent(')+take('function canonicalCardFixtureRows(', 'function canonicalMatchCardData(')+take('function adoptLegacyTacticsFixture(', 'function tacticsMatchPlan(){')+take('function syncMatchPlayedActionV141(', 'function renderMatchPageNextFixture('),ctx);
 return ctx;
}
function games(ctx){return ctx.miniCupGroup(ctx.state.selkent.fixtures[0]).fixtures;}
async function run(){
 for(const [team,fixtures] of [['Shooters Hill AFC Vikings',vikings],['Shooters Hill AFC Royals',royals]]){
  const c=context(team,fixtures),f=fixtures[0],key=c.fixtureResponseKey(f),later={date:'2026-10-11',opponent:'Later League',venue:'H',competition:'League'};
  assert.equal(c.miniCupGroup(f).fixtures.length,2);assert.equal(c.upcomingFixtures().length,1);assert.equal(c.fixtureResponseKey(fixtures[1]),key);
  assert.equal(c.fixtureResponseKey({...f,competition:'Private Cup text'}),key,'match-derived row resolves provider competition');
  assert.equal(c.fixtureResponseKey({...fixtures[1],competition:'Private Cup text'}),key);
  const before=plain(fixtures);c.state.selkent.fixtures.push(later);assert.deepEqual(plain(c.upcomingFixtures().map(x=>x.date)),['2026-10-04','2026-10-11']);
  const canonical=c.canonicalCardRowData(f);assert.equal(canonical.rows.length,2);assert(canonical.rows.every(r=>r.label==='Group game'));
  assert.deepEqual(plain(canonical.rows.map(r=>[r.home,r.away])),team.endsWith('Vikings')?[["Punjab United Red",team],[team,"Shooters Hill AFC Royals"]]:[[team,"Punjab United Red"],["Shooters Hill AFC Vikings",team]]);
  assert.doesNotMatch(c.groupFixtureCardHtmlV15(f,0),/Fixture [12]|14:00|score|\b(?:gf|ga)\b/);assert.match(c.groupFixtureCardHtmlV15(f,0),/Group start TBC/);
  c.state.selkent.fixtureOverrides[c.fixtureKitSelectionKey(fixtures[1])]={time:'13:45',groundName:'Confirmed Field',address:'Confirmed Address',confirmedAt:'2026-10-03'};
  assert.equal(c.parentCupGroupDetails(f).time,'13:45');assert.equal(c.parentCupGroupDetails(f).groundName,'Confirmed Field');
  const rep=c.nextPublishedFixture();c.state.matches=[{...fixtures[0],id:'one',status:'played',gf:3,ga:2}];
  assert.equal(c.nextPublishedFixture(),rep);assert.equal(c.fixtureResponseKey(c.nextPublishedFixture()),key);assert.equal(c.upcomingFixtures().length,2);
  let html=c.cupGroupResultChooserHtml(f);assert.equal((html.match(/data-cup-result-row=/g)||[]).length,2);assert.equal((html.match(/>Recorded</g)||[]).length,1);assert.doesNotMatch(html,/3[–-]2|score|<input/);
  c.selectCupGroupResult(f,games(c).findIndex(row=>row.opponent===fixtures[0].opponent));assert.equal(c.opened,undefined,'recorded game cannot be opened as new result');
  c.openCupGroupResultChooser(f);const dlg=c.nodes.get('cup-group-result-dialog');assert(dlg.open);assert.equal(dlg.innerHTML,html);
  const remaining=games(c).findIndex(row=>row.opponent===fixtures[1].opponent);dlg.onclick({target:{closest:selector=>selector==='[data-cup-result-row]'?{dataset:{cupResultRow:String(remaining)}}:null}});
  assert(c.opened);assert.equal(c.state.matches.length,2);assert.equal(c.state.matches[1].opponent,fixtures[1].opponent);assert.equal(c.state.matches[1].venue,fixtures[1].venue);assert.deepEqual(plain(c.state.matches[1].providerTeamIds),fixtures[1].providerTeamIds);
  c.state.matches[1].status='played';assert.equal(c.nextPublishedFixture(),later);c.state.matches[1].status='scheduled';assert.equal(c.nextPublishedFixture(),rep);assert.equal(c.state.matches.length,2,'undo retains both private records');
  assert.deepEqual(plain(fixtures),before,'grouping did not mutate raw feed rows');
  // Complete GROUP parent path, with the private getter active throughout.
  c.currentRole='parent';c.state.selkent.fixtures=[...fixtures];Object.defineProperty(c.state,'matches',{configurable:true,get(){throw Error('Parent group accessed private matches');}});
  assert.equal(c.upcomingFixtures().length,1);assert.equal(c.nextPublishedFixture(),rep);assert.equal(c.fixtureCompetitionLabel(f),cup);
  c.renderSelkentFixtures();assert.equal(c.nodes.get('selkent-fixtures-count').textContent,'1');assert.equal((c.nodes.get('selkent-fixtures-list').innerHTML.match(/Group game/g)||[]).length,2);
  assert.doesNotMatch(c.nodes.get('selkent-fixtures-list').innerHTML,/Recorded|data-further-match-played|score|Add to calendar|Share/);
  assert.match(c.parentFutureFixtureHtml(f),/Confirmed Field/);assert.equal(c.cupGroupResultChooserHtml(f),'');c.selectCupGroupResult(f,0);
  c.syncMatchPlayedActionV141(f);assert(c.nodes.get('matches-next-played').classList.contains('hidden'));
  for(const id of ['next-match-card','next-match-home-teams','next-match-home-date','next-match-versus','next-match-when','matches-next-fixture','matches-next-versus','matches-next-when','parent-home-match-info','parent-home-training','home-next-title'])c.nodes.set(id,node());
  Object.assign(c,{console:{warn:(...args)=>{throw Error('Renderer warning: '+args.join(' '));}},renderCompactNextMatchTeams:()=>{},renderFixtureConfirmationEditor:()=>{},refreshFixtureOverviewDirectory:()=>{},renderMatchOverview:()=>{},openNextFixtureDetails:()=>{},removeOpponentKitRowsV13:()=>{},mapsHref:()=>'',mapsEmbedHref:()=>'',setMapPreview:()=>{},parentTrainingScheduleHtml:()=>'',parentTrainingRowsHtml:()=>'',matchdayArrivalTime:()=>{throw Error('Group arrival must not be invented');},__parentFamilyStatus:'ready',__parentFamilyKey:'user-one:team-one',__parentFamilyLinks:[],__availabilityFixture:'',__availabilityTeamId:'',__availabilityRows:[],__availabilityLoadStatus:'ready',matchOverviewContext:m=>({homeTeam:m.venue==='A'?m.opponent:team,awayTeam:m.venue==='A'?team:m.opponent,ground:m.groundName,address:m.address})});
  vm.runInContext(take('function fixtureOverviewContext(', 'function setMapPreview(')+take('function renderFixtureOverview(', 'function clearFixtureOverview(')+take('function renderNextMatch(){','function syncMatchPlayedActionV141(')+take('function renderMatchPageNextFixture(){','function divisionOpponents(){')+take('function renderParentHomeMatchInfo(){','function renderParentFamilySummary(){')+app.slice(app.indexOf('/* Canonical match cards v10')),c);
  c.renderNextMatch();c.renderMatchPageNextFixture();c.renderParentHomeMatchInfo();
  for(const id of ['next-match-home-teams','next-match-versus','matches-next-versus','parent-home-match-info']){assert.equal((c.nodes.get(id).innerHTML.match(/Group game/g)||[]).length,2,id);assert.doesNotMatch(c.nodes.get(id).innerHTML,/Recorded|score|data-further-match-played|Add to calendar/);}
  assert.match(c.nodes.get('next-match-home-date').textContent,/Group starts 13:45/);assert.match(c.nodes.get('matches-next-when').textContent,/Group starts 13:45/);
  // The existing ordinary parent access remains an explicitly separate contract.
  const ordinary={date:'2026-10-04',competition:'League',opponent:'League opponent',venue:'H'};c.state.selkent.fixtures=[ordinary];assert.throws(()=>c.upcomingFixtures(),/Parent group accessed private matches/);c.state.selkent.fixtures=[...fixtures];

  now='2026-10-05T12:00:00Z';assert.equal(c.nextPublishedFixture(),null);now='2026-10-04T12:00:00Z';
 }
 const c=context('Shooters Hill AFC Vikings',vikings),f=vikings[0],key=c.fixtureResponseKey(f),dated=vikings.map(c.fixtureDatedGameKey),legacy=c.fixtureStableKey(f),stored=new Map(),reads=[];
 c.state.selkent.legacyResponseFixtureKey=dated[0];
 c.window.ClubHubCloud.listMatchAvailability=async k=>{reads.push(k);return stored.get(k)||[];};
 stored.set(key,[{player_name:'Aavi',status:'available',updated_at:'2026-10-04T10:00:00Z'},{player_name:'Same response duplicates',status:'unsure',updated_at:'2026-10-04T08:00:00Z'},{player_name:'Same response duplicates',status:'available',updated_at:'2026-10-04T09:00:00Z'}]);
 stored.set(dated[0],[{player_name:' aavi ',status:'unavailable',updated_at:'2026-10-04T11:00:00Z'},{player_name:'First only',status:'available'},{player_name:'Tie',status:'available',updated_at:'2026-10-04T10:00:00Z'}]);
 stored.set(dated[1],[{player_name:'Second only',status:'unsure'},{player_name:'Tie',status:'unavailable',updated_at:'2026-10-04T10:00:00Z'}]);stored.set(legacy,[{player_name:'Undated only',status:'available'},{player_name:'Tie',status:'unsure',updated_at:'2026-10-04T10:00:00Z'}]);
 let merged=await c.listFixtureAvailability(f);assert.deepEqual(reads,[key,...dated,legacy]);assert.equal(merged.length,6);assert.equal(merged.find(r=>norm(r.player_name)==='aavi').status,'unavailable');assert.equal(merged.find(r=>r.player_name==='Tie').status,'available');assert.equal(merged.find(r=>r.player_name==='Same response duplicates').status,'available');
 stored.set(key,[{player_name:'Tie',status:'unsure',updated_at:'2026-10-04T10:00:00Z'},{player_name:'Aavi',status:'available',updated_at:'2026-10-04T12:00:00Z'}]);merged=await c.listFixtureAvailability(f);assert.equal(merged.find(r=>r.player_name==='Tie').status,'unsure');assert.equal(merged.find(r=>r.player_name==='Aavi').status,'available');assert.equal(stored.get(dated[0]).length,3);
 assert.equal(c.legacyResponseKeyForFixture({...f,date:'2026-10-11'}).length,0,'return date never inherits replies');
 c.window.ClubHubCloud.listMatchAvailability=async k=>{if(k===dated[1])throw Error('legacy read failed');return stored.get(k)||[];};await assert.rejects(()=>c.listFixtureAvailability(f),/legacy read failed/);
 c.window.ClubHubCloud.getCoachMatchNote=async k=>({note:k,updated_at:k==='fixture:'+dated[1]?'2026-10-04T12:00:00Z':'2026-10-04T10:00:00Z'});
 assert.equal((await c.loadFixtureCoachNoteV15(f)).note,'fixture:'+dated[1]);
 const reset=()=>{c.state.tactics=Object.fromEntries(fields.map(f=>[f,{}]));};
 reset();c.state.tactics.lineupByFixture[dated[0]]=['p1'];c.state.tactics.positionsByFixture[dated[0]]={p1:{x:20,y:30}};c.state.tactics.matchPlanByFixture[dated[0]]={focus:'First'};c.state.tactics.activeFixtureKey=dated[0];c.adoptLegacyTacticsFixture(f,key);assert.deepEqual(plain(c.state.tactics.lineupByFixture[key]),['p1']);assert.equal(c.state.tactics.activeFixtureKey,key);c.state.tactics.positionsByFixture[key].p1.x=50;assert.equal(c.state.tactics.positionsByFixture[dated[0]].p1.x,20);
 c.state.tactics.lineupByFixture[dated[0]]=['changed'];c.adoptLegacyTacticsFixture(f,key);assert.deepEqual(plain(c.state.tactics.lineupByFixture[key]),['p1'],'established group plan wins');
 reset();c.state.tactics.matchPlanByFixture[dated[0]]={focus:'One'};c.state.tactics.matchPlanByFixture[dated[1]]={focus:'Two'};c.adoptLegacyTacticsFixture(f,key);assert.equal(c.state.tactics.matchPlanByFixture[key],undefined,'ambiguous conflict adopts nothing');
 c.state.matches=[{...vikings[0],status:'played'}];c.adoptLegacyTacticsFixture(f,key);assert.equal(c.state.tactics.matchPlanByFixture[key].focus,'Two','sole unreported game wins coherently');assert.equal(c.state.tactics.matchPlanByFixture[dated[0]].focus,'One');
 reset();c.state.tactics.matchPlanByFixture[dated[0]]={focus:'Same'};c.state.tactics.matchPlanByFixture[dated[1]]={focus:'Same'};c.adoptLegacyTacticsFixture(f,key);assert.equal(c.state.tactics.matchPlanByFixture[key].focus,'Same');
 for(const role of ['coach','assistant_coach','admin','parent','player'])for(const edit of [true,false]){
  c.currentRole=role;c.edit=edit;c.dual=role==='admin';c.syncMatchPlayedActionV141(f);assert.equal(c.nodes.get('matches-next-played').classList.contains('hidden'),!(['coach','assistant_coach','admin'].includes(role)&&edit));
 }
 c.currentRole='admin';c.dual=false;c.edit=true;assert.equal(c.cupGroupResultChooserHtml(f),'');c.currentRole='parent';c.dual=false;c.selectCupGroupResult(f,1);
 // One/three opponents and older ages remain ordinary; no private/cache reconstruction.
 c.currentRole='coach';c.state.matches=[];c.state.selkent.fixtures=[vikings[0]];assert.equal(c.miniCupGroup(f),null);
 c.state.selkent.fixtures=[...vikings,{...f,opponent:'Third opponent'}];assert.equal(c.miniCupGroup(f),null);assert.equal(c.upcomingFixtures().length,3);
 c.ageGroupNumber=()=>14;c.state.selkent.fixtures=[...vikings];assert.equal(c.miniCupGroup(f),null);assert.equal(c.upcomingFixtures().length,2);
 // Dispatch the existing real Further-fixture document-click branch between ordinary events.
 c.ageGroupNumber=()=>10;const ordinary={date:'2026-10-03',competition:'League',opponent:'Earlier',venue:'H'},later={...ordinary,date:'2026-10-11',opponent:'Later'};now='2026-10-03T12:00:00Z';c.state.selkent.fixtures=[ordinary,...vikings,later];
 let openedEvent=null;c.openCupGroupResultChooser=f=>openedEvent=f;c.openFixtureMatchReport=f=>openedEvent=f;
 const branch=take("  const furtherPlayed=e.target.closest('[data-further-match-played]');","  const editTournament=e.target.closest('[data-edit-tournament]');");
 const line=branch.split('\n')[0];c.e={target:{closest:()=>({dataset:{furtherMatchPlayed:'0'}})}};vm.runInContext('(function(){'+line+'})()',c);assert.equal(c.fixtureResponseKey(openedEvent),key);
 c.state.matches=[{...vikings[0],status:'played'}];vm.runInContext('(function(){'+line+'})()',c);assert.equal(c.fixtureResponseKey(openedEvent),key);c.e.target.closest=()=>({dataset:{furtherMatchPlayed:'1'}});vm.runInContext('(function(){'+line+'})()',c);assert.equal(openedEvent,later);now='2026-10-04T12:00:00Z';
 // Notification / acknowledgement / result identity stay per-game.
 assert.notEqual(c.fixtureStableKey(vikings[0]),c.fixtureStableKey(vikings[1]));assert.doesNotMatch(take('function fixtureFingerprint(', 'function fixtureOverride('),/fixtureResponseKey/);
 assert.doesNotMatch(take('function fixtureDatedGameKey(', 'function fixtureFingerprint('),/notifyFixtureChange|saveMatchAvailability|delete/);
 assert.doesNotMatch(app,/_cupPair|cup\.length\?cup:all/);
 assert.match(app,/matchday-add-calendar.*classList\.toggle\('hidden',!!group\)/);

 // N2: reconstruct the previous single-line marker expression and compare the FULL normalized saved state.
 const n=context('Shooters Hill AFC Vikings',vikings),saved={meta:{ageGroup:'U10',teamName:'Vikings'},squad:[],matches:[],selkent:{responseKeyVersion:1,fixtureTracking:{key:n.fixtureStableKey(f),snapshot:f}},tactics:{}};
 const starter={meta:{clubName:'Shooters Hill AFC',teamName:'Vikings',ageGroup:'U10',season:'2026/27'},division:{name:'Under 10D Navy',teamName:'Shooters Hill AFC Vikings',meetingsPerOpponent:2,teams:[]},squad:[],matches:[],goals:[],awards:[],selkent:{clubTeams:[],publishedLeagueAges:[]}};
 Object.assign(n,{cloneStarter:()=>plain(starter),clubSettings:()=>({}),resolveMiniPerformanceDisplay:rows=>rows,normalizeAwardTypes:()=>[],uid:()=> 'unused'});
 Object.defineProperty(n.state.selkent,'fixtures',{configurable:true,get(){throw Error('normalizeState must not access global fixtures');}});
 const normalize=take('function normalizeState(', 'function normalizeAwardTypes(');
 const oldNormalize=normalize.replace('function normalizeState(','function oldNormalizeState(').replace('fixtureDatedGameKey(data.selkent.fixtureTracking.snapshot)',"`${String(data.selkent.fixtureTracking.snapshot.date||'')}|${fixtureStableKey(data.selkent.fixtureTracking.snapshot)}`");
 vm.runInContext(normalize+oldNormalize,n);assert.deepEqual(plain(n.normalizeState(saved)),plain(n.oldNormalizeState(saved)));assert.equal(n.normalizeState(saved).selkent.legacyResponseFixtureKey,dated[0]);
 saved.selkent.responseKeyVersion=2;saved.selkent.legacyResponseFixtureKey=dated[1];assert.deepEqual(plain(n.normalizeState(saved)),plain(n.oldNormalizeState(saved)));assert.equal(n.normalizeState(saved).selkent.legacyResponseFixtureKey,dated[1]);
 // N4: actual refresh UI retains SAME-context replies, initial failure is unknown, retry recovers, switches clear, and stale requests cannot win.
 const a=context('Shooters Hill AFC Vikings',vikings);let fail=false,scope='team-one',user='user-one';a.window.ClubHubCloud.currentTeam=()=>({id:scope});a.window.ClubHubCloud.session.user={get id(){return user;}};
 a.window.ClubHubCloud.listParentPlayerLinks=async()=>[];a.window.ClubHubCloud.listMatchAvailability=async k=>{if(fail&&k===dated[1])throw Error('second legacy unavailable');return k===key?[{player_name:'Aavi',status:'available'}]:[];};a.miniJerseyHTML=()=>'';
 vm.runInContext(take('let __availabilityRows=[];', 'let __parentPlayerLinks=[];')+'let __parentPlayerLinks=[];'+take('function availabilityStatusForPlayer(', 'async function saveParentAvailability('),a);
 await a.refreshMatchAvailability();assert.equal(a.availabilityStatusForPlayer('Aavi'),'available');const summary=a.nodes.get('coach-availability-summary').innerHTML;
 fail=true;await a.refreshMatchAvailability();assert.equal(a.availabilityStatusForPlayer('Aavi'),'available');assert.equal(a.nodes.get('coach-availability-summary').innerHTML,summary);assert.match(a.nodes.get('match-availability-warning').innerHTML,/Some replies could not load.*data-availability-retry/);assert.equal(vm.runInContext('__availabilityLoadStatus',a),'partial');
 scope='team-two';await a.refreshMatchAvailability();assert.equal(vm.runInContext('__availabilityRows.length',a),0);assert.equal(a.nodes.get('match-availability-count').textContent,'Availability unavailable');assert.equal(a.nodes.get('coach-availability-summary').innerHTML,'');
 fail=false;await a.refreshMatchAvailability();assert.equal(a.availabilityStatusForPlayer('Aavi'),'available');assert(a.nodes.get('match-availability-warning').classList.contains('hidden'));
 user='user-two';fail=true;await a.refreshMatchAvailability();assert.equal(vm.runInContext('__availabilityRows.length',a),0,'different family cannot retain rows');
 fail=false;const pending=[];a.window.ClubHubCloud.listMatchAvailability=()=>new Promise(resolve=>pending.push(resolve));
 const firstLoad=a.refreshMatchAvailability();const oldPending=pending.splice(0);scope='team-three';const latestLoad=a.refreshMatchAvailability();const latestPending=pending.splice(0);latestPending.forEach(resolve=>resolve([{player_name:'Aavi',status:'unsure'}]));await latestLoad;oldPending.forEach(resolve=>resolve([{player_name:'Aavi',status:'unavailable'}]));await firstLoad;assert.equal(a.availabilityStatusForPlayer('Aavi'),'unsure');

 // Coach note requests use both the group key and the team/account context; stale same-key notes cannot cross teams.
 const nc=context('Shooters Hill AFC Vikings',vikings);let noteTeam='one';const notePending=[];nc.window.ClubHubCloud.currentTeam=()=>({id:noteTeam});nc.window.ClubHubCloud.getCoachMatchNote=()=>new Promise(resolve=>notePending.push(resolve));
 for(const id of ['matchday-dashboard','matchday-dashboard-opponent','matchday-dashboard-note-input','matchday-dashboard-note-readonly'])nc.nodes.set(id,node());
 Object.assign(nc,{ensureTacticsState:()=>{},currentTacticsFixtureKey:()=>nc.fixtureResponseKey(vikings[0]),availabilityCounts:()=>({}),fixtureAckState:()=>({status:'confirmed'}),requiresMatchdaySelection:()=>false,footballFormat:()=>({matchday:9})});
 vm.runInContext(take('function matchdayFixtureNoteKey(){', 'function addFixtureToCalendar(')+take('async function renderMatchdayDashboard(){', 'async function saveMatchdayDashboardNote(){'),nc);
 const oldNote=nc.renderMatchdayDashboard(),oldNotePending=notePending.splice(0);noteTeam='two';const newNote=nc.renderMatchdayDashboard(),newNotePending=notePending.splice(0);newNotePending.forEach(resolve=>resolve({note:'Team two note',updated_at:'2026-10-04T12:00:00Z'}));await newNote;oldNotePending.forEach(resolve=>resolve({note:'Team one note',updated_at:'2026-10-04T12:00:00Z'}));await oldNote;assert.equal(nc.nodes.get('matchday-dashboard-note-input').value,'Team two note');
 const retryBranch=take("  if(e.target.closest('[data-availability-retry]'))", "  const furtherPlayed=e.target.closest('[data-further-match-played]');");let retried=0;a.refreshMatchAvailability=quiet=>{assert.equal(quiet,false);retried++;};a.e={target:{closest:()=>true}};vm.runInContext('(function(){'+retryBranch+'})()',a);assert.equal(retried,1);
 console.log('PASS V15 real Group E lifecycle, home-first cards, parent non-access, exact result routing, migration and permission contracts');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
