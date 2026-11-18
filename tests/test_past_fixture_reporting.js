// Exercise the real feed refresh, historical recovery and existing match chooser.
// Fixed dates and invented teams keep this regression independent of production data.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const overlay=fs.readFileSync('app/src/main/assets/static-feed-overlay.js','utf8');
function productionFunction(name){
 const start=app.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));
 assert(start>=0,`Production function ${name} exists`);
 const after=app.slice(start+1).search(/^(?:async )?function /m);
 return after<0?app.slice(start):app.slice(start,start+1+after);
}
const NOW='2030-01-16T12:00:00Z';
class Clock extends Date{constructor(...args){super(...(args.length?args:[NOW]));}static now(){return Date.parse(NOW);}}
const own='Example Juniors Greens',division='Under 9 Navy';
const past={date:'2030-01-13',time:'',opponent:'Invented Rangers',venue:'A',competition:'Division',source:'selkent-static',providerTeamIds:['2','1']};
const future={date:'2030-01-20',time:'',opponent:'Fictional United',venue:'H',competition:'Division',source:'selkent-static'};
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const key=f=>[f.date,norm(f.opponent),f.venue,norm(f.competition)].join('|');
function confirmation(f,extra={}){return {confirmedAt:'2030-01-10T10:00:00Z',time:'10:30',groundName:'Example Fields',address:'Invented public sports ground',source:'selkent_confirmation_email_screenshot',sourceFixtureStatus:'Confirmed',sourceHome:f.venue==='H'?own:f.opponent,sourceAway:f.venue==='A'?own:f.opponent,sourceCompetition:f.competition==='Division'?division:f.competition,sourceEvidenceUrl:'https://drive.google.com/file/d/fictional-evidence/view',sourceEvidenceSha256:'a'.repeat(64),...extra};}
async function setup(){
 const nodes=new Map(),calls={save:0,reports:[],toasts:[],persist:0},control={provider:'manual',parent:false};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',classList:{toggle(){}},showModal(){this.open=true;}});return nodes.get(id);};
 const state={meta:{ageGroup:'U9',teamName:'Greens'},division:{name:division,teamName:own},matches:[],selkent:{fixtures:[structuredClone(past)],fixtureOverrides:{},results:[],scheduledFixtures:[]}};
 const feed={schema_version:2,provider:'selkent',last_updated:NOW,age_groups:[{age_group:'U9',standings:null,published_results:null,published_results_status:'not_publicly_published',fixtures:[{date:future.date,home:own,away:future.opponent,division_name:division,provider_team_ids:['1','3']}]}]};
 const window={ClubHubCloud:{session:{user:{id:'fictional-coach'}},context:{profile:{club_id:'fictional-club',role:'coach'}},currentTeam:()=>({id:'fictional-team',leagueName:own}),role:()=> 'coach',actingAsParent:()=>control.parent},providerType:()=>control.provider,currentAgeCode:()=> 'U9',nativeHttp:async()=>({body:JSON.stringify(feed)}),persistLocalState:()=>calls.persist++,ensureFixtureKitColours:async()=>{},updateFixtureTracking:()=>{}};
 const context={window,state,CLOUD_MODE:true,currentRole:'coach',adminUiMode:'coach',Date:Clock,console,Promise,localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:node,querySelectorAll:()=>[]},miniCupGroup:()=>null,parentMatchdayEnded:()=>false,isProviderOwnedMatch:m=>/selkent/.test(m.source||''),requireCoach:()=>context.currentRole==='coach',matchDetailContext:()=> 'same-team',homeFixtureTeamNames:f=>({home:f.venue==='H'?own:f.opponent,away:f.venue==='A'?own:f.opponent}),formatDate:x=>x,isPublishedLeagueTeam:()=>false,uid:()=> 'fictional-report',saveState:()=>calls.save++,auditEvent:()=>{},openMatchReport:id=>calls.reports.push(id),toast:message=>calls.toasts.push(message)};
 vm.createContext(context);
 vm.runInContext("let __matchEntryChoices=[],__matchEntryChoiceContext='';\n"+['selkentNorm','normalizeTeamKey','matchStatus','statusLabel','fixtureLinkedMatch','fixtureIsReported','mergeFixtureReportHistory','fixtureStableKey','fixtureKitSelectionKey','fixtureOverride','resolvedFixture','matchDayReached','upcomingFixtures','nextPublishedFixture','esc','openMatchEntryChooser','openFixtureMatchReport'].map(productionFunction).join('\n'),context);
 window.mergeFixtureReportHistory=(...args)=>context.mergeFixtureReportHistory(...args);
 window.nextPublishedFixture=()=>context.nextPublishedFixture();
 Object.assign(context,{sanitizeRemoteStandings:()=>[],calculateLeagueTable:()=>[],clubListingHtml:name=>name,mapsHref:()=>''});
 const quickViewStart=app.indexOf('function renderLeagueQuickView(){');
 vm.runInContext(app.slice(quickViewStart,app.indexOf('\n}\n',quickViewStart)+2),context);
 vm.runInContext(overlay,context);await Promise.resolve();control.provider='selkent';
 return {context,state,feed,window,control,calls,node,choices:()=>vm.runInContext('__matchEntryChoices',context)};
}
(async()=>{
 const rollover=await setup();
 await rollover.window.ClubHubStaticSelkent.applyStaticFixtures(true,true);
 assert(rollover.state.selkent.fixtures.some(f=>key(f)===key(past)),'retired cached fixture survives provider rollover');
 assert.equal(rollover.context.nextPublishedFixture().opponent,future.opponent,'retained history cannot displace next weekend');
 rollover.context.isPublishedLeagueTeam=()=>true;rollover.context.renderLeagueQuickView();
 assert.equal(rollover.node('league-quick-fixture-count').textContent,'1','league upcoming count excludes retained history');
 assert.match(rollover.node('league-quick-fixtures').innerHTML,/Fictional United/);
 assert.doesNotMatch(rollover.node('league-quick-fixtures').innerHTML,/Invented Rangers/);
 rollover.context.openMatchEntryChooser();
 assert.equal(rollover.choices().length,1,'future fixtures remain unavailable for reporting');
 assert.equal(rollover.choices()[0].fixture.opponent,past.opponent);
 assert.match(rollover.node('match-entry-choices').innerHTML,/Not recorded/);
 assert.doesNotMatch(rollover.node('match-entry-choices').innerHTML,/Played/,'a raw fixture is not labelled played');
 assert.equal(rollover.state.matches.length,0,'refresh/chooser does not invent a match outcome');
 await rollover.window.ClubHubStaticSelkent.applyStaticFixtures(true,true);
 assert.equal(rollover.state.selkent.fixtures.filter(f=>key(f)===key(past)).length,1,'repeated refresh never duplicates history');

 const recovered=await setup();
 recovered.state.selkent.fixtures=[];
 recovered.state.division.teamName='Greens'; // Canonical cloud identity takes precedence over a display alias.
 recovered.state.selkent.fixtureOverrides[key(past)]=confirmation(past);
 const cup={...past,opponent:'Fictional Cup Side',venue:'H',competition:'U9 Selkent Cup Two - Round 2'};
 recovered.state.selkent.fixtureOverrides[key(cup)]=confirmation(cup);
 recovered.state.selkent.fixtureOverrides[key(future)]=confirmation(future);
 const bad={...past,opponent:'Unverified Side'};
 recovered.state.selkent.fixtureOverrides[key(bad)]=confirmation(bad,{sourceEvidenceSha256:''});
 const other={...past,opponent:'Other Club Side'};
 recovered.state.selkent.fixtureOverrides[key(other)]=confirmation(other,{sourceAway:'A different team'});
 const wrongRound={...cup,opponent:'Wrong Round Side'};
 recovered.state.selkent.fixtureOverrides[key(wrongRound)]=confirmation(wrongRound,{sourceCompetition:'U9 Selkent Cup Two - Round 1'});
 const wrongVenue={...past,opponent:'Wrong Venue Side'};
 recovered.state.selkent.fixtureOverrides[key(wrongVenue)]=confirmation(wrongVenue,{sourceHome:own,sourceAway:wrongVenue.opponent});
 recovered.context.openMatchEntryChooser();
 assert.equal(recovered.choices().length,2,'only evidenced past own-team identities recover before a refresh');
 assert.equal(recovered.choices().find(c=>c.fixture.opponent===cup.opponent).fixture.competition,cup.competition,'canonical cup round retained');
 assert.equal(recovered.state.selkent.fixtures.length,0,'opening chooser alone does not save or mutate the feed');
 recovered.state.division.teamName=own;
 await recovered.window.ClubHubStaticSelkent.applyStaticFixtures(true,true);
 assert.equal(recovered.state.selkent.fixtures.length,3,'current provider row plus two recovered historical rows');
 assert.equal(recovered.context.nextPublishedFixture().date,future.date);
 recovered.context.openFixtureMatchReport(future);
 assert.equal(recovered.state.matches.length,0,'direct report entry cannot bypass the future date guard');
 assert.equal(recovered.calls.save,0);
 const old=recovered.state.selkent.fixtures.find(f=>key(f)===key(past));
 recovered.context.openFixtureMatchReport(old);recovered.context.openFixtureMatchReport(old);
 assert.equal(recovered.state.matches.length,1,'existing reporting path reuses one linked record');
 assert.equal(recovered.calls.save,1);
 recovered.state.matches[0].status='abandoned';
 recovered.context.openMatchEntryChooser();
 assert.equal(recovered.choices().filter(c=>c.match?.id==='fictional-report').length,1,'report and recovered fixture appear once');
 assert.match(recovered.node('match-entry-choices').innerHTML,/Abandoned/);
 assert.equal(recovered.context.nextPublishedFixture().opponent,future.opponent);

 const ambiguous=await setup();ambiguous.state.selkent.fixtures=[];
 const conflictingCup={...past,competition:'U9 Selkent Cup Two - Round 2'};
 ambiguous.state.selkent.fixtureOverrides[key(past)]=confirmation(past);
 ambiguous.state.selkent.fixtureOverrides[key(conflictingCup)]=confirmation(conflictingCup);
 ambiguous.context.openMatchEntryChooser();
 assert.equal(ambiguous.choices().length,0,'two recovered competitions sharing the legacy report identity are withheld');
 await ambiguous.window.ClubHubStaticSelkent.applyStaticFixtures(true,true);
 assert.equal(ambiguous.state.selkent.fixtures.length,1,'ambiguous recovery never enters the saved provider cache');
 assert.equal(ambiguous.context.nextPublishedFixture().opponent,future.opponent);

 const cachedConflict=await setup();
 cachedConflict.state.selkent.fixtureOverrides[key(conflictingCup)]=confirmation(conflictingCup);
 assert.equal(cachedConflict.context.mergeFixtureReportHistory([past]).length,1,'a conflicting recovery leaves the existing provider row intact');
 cachedConflict.context.openMatchEntryChooser();
 assert.equal(cachedConflict.choices().length,1,'a conflicting recovery leaves the cached fixture intact');
 assert.equal(cachedConflict.choices()[0].fixture.competition,'Division');

 const recordConflict=await setup();recordConflict.state.selkent.fixtures=[];
 recordConflict.state.matches=[{...past,id:'saved-outcome',status:'abandoned'}];
 recordConflict.state.selkent.fixtureOverrides[key(conflictingCup)]=confirmation(conflictingCup);
 recordConflict.context.openMatchEntryChooser();
 assert.equal(recordConflict.choices().length,1,'a conflicting recovery cannot produce a duplicate choice linked to a saved record');
 assert.equal(recordConflict.choices()[0].match.id,'saved-outcome');
 assert.equal(recordConflict.choices()[0].fixture,undefined,'the saved record remains unmodified and is not relabelled as a recovered cup fixture');

 const venueConflict=await setup();venueConflict.state.selkent.fixtures=[];
 venueConflict.state.matches=[{...past,venue:'H',id:'other-venue',status:'abandoned'}];
 venueConflict.state.selkent.fixtureOverrides[key(past)]=confirmation(past);
 venueConflict.context.openMatchEntryChooser();
 assert.equal(venueConflict.choices().length,1,'a lone opposite-venue record cannot capture a recovered fixture');
 assert.equal(venueConflict.choices()[0].match.id,'other-venue');
 assert.equal(venueConflict.choices()[0].fixture,undefined,'opposite-venue recovery is withheld before legacy fallback linking');
 venueConflict.state.matches=[];
 const oppositeVenue={...past,venue:'H'};
 venueConflict.state.selkent.fixtureOverrides[key(oppositeVenue)]=confirmation(oppositeVenue);
 assert.equal(venueConflict.context.mergeFixtureReportHistory([]).length,0,'same-day opposite-venue recoveries are withheld even within one competition');

 const correction=await setup();
 correction.state.matches=[{...future,id:'existing-record',status:'played'}];
 correction.context.openFixtureMatchReport(future);
 assert.deepEqual(correction.calls.reports,['existing-record'],'future guard does not block correcting an already recorded outcome');
 assert.equal(correction.calls.save,0);

 for(const mode of ['parent','player','acting-parent']){
  const h=await setup();h.context.currentRole=mode==='acting-parent'?'admin':mode;h.control.parent=mode==='acting-parent';
  Object.defineProperty(h.state.selkent,'fixtureOverrides',{get(){throw Error('Restricted view read private confirmation history');}});
  Object.defineProperty(h.state,'matches',{get(){throw Error('Restricted view read private match records');}});
  assert.equal(h.context.mergeFixtureReportHistory([future]).length,1,`${mode}: no historical fixtures added`);
 }
 console.log('PASS past fixture reporting: real feed rollover, evidence-backed recovery, canonical cup identity, ambiguous competition withholding, exact deduplication, future report guard, next-fixture order, truthful chooser labels and parent/player isolation');
})().catch(error=>{console.error(error);process.exitCode=1;});
