const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app/src/main/assets/app.js'), 'utf8');
const stableBody=src.slice(src.indexOf('function setStableHtml(element,markup){'),src.indexOf('// Club lists share the exact same admission',src.indexOf('function setStableHtml(element,markup){')));
const setStableHtml=new Function(`${stableBody}\nreturn setStableHtml;`)();
const html = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
const designCss = fs.readFileSync(path.join(root, 'app/src/main/assets/app-design-system.css'), 'utf8');
const normalizeTeamKey = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const internalBody = src.slice(src.indexOf('function fullClubResultTeamName(team={}){'), src.indexOf('function renderClubResultsBrowser(){'));
const identityBody=src.slice(src.indexOf('function resolveMiniPerformanceDisplay('),src.indexOf('function loadState(){'));
const internalAdminClubResults = new Function('clubSettings','normalizeTeamKey',`${identityBody}\n${internalBody}\nreturn internalAdminClubResults;`)(()=>({display_name:'Shooters Hill AFC'}),normalizeTeamKey);
const elements = new Map(['admin-recent-results','admin-results-count','admin-results-breakdown','admin-results-source-status'].map(id => [id,{innerHTML:'',textContent:''}]));
const document = {getElementById:id => elements.get(id)};
const helpers = src.slice(src.indexOf('function verifiedClubResultsFeed(feed){'), src.indexOf('function nextWeekendDates(){'));
const lineOf=(name)=>{const a=src.indexOf(`function ${name}(`);return src.slice(a,src.indexOf('\n',a));};
const resultHelpers=lineOf('resultForNamedTeam')+'\n'+lineOf('resultClass');
const {verifiedClubResultsFeed,publishedClubTeamData,clubResultRows,coachClubResultRows,renderAdminRecentResults} = new Function(
  'normalizeTeamKey','internalAdminClubResults','document','esc','formatDate','matchTeamLabel','clubListingHtml','setStableHtml','verifiedTeamBadgeUrl','clubSettings','configuredClubTeams','FAILED_BADGE_URLS','clubPlaceholderBadgeHtml',
  `const __clubResultsRows=[];${resultHelpers}\n${helpers}\nreturn {verifiedClubResultsFeed,publishedClubTeamData,clubResultRows,coachClubResultRows,renderAdminRecentResults};`
)(normalizeTeamKey,internalAdminClubResults,document,s=>String(s),(s=>s),(s=>s),(s=>`<span class=\"club-listing\">${s}</span>`),setStableHtml,()=>'',()=>({}),()=>[],new Set(),name=>`<img class="club-identity-badge" alt="${name}">`);

const teams = [
  {id:'12',ageGroup:'U12',teamName:'Cannons',leagueName:'Shooters Hill AFC Cannons',division:'Under 12C Orange'},
  {id:'14',ageGroup:'U14',teamName:'Cannons',leagueName:'Shooters Hill AFC Cannons',division:'Under 14D Navy'},
  {id:'9',ageGroup:'U9',teamName:'Valiants',leagueName:'Shooters Hill AFC Valiants',division:'Under 9D Navy'}
];
const feed = {coverage:{published_results:{parser_status:'verified_scored_rows_v1'}},age_groups:[
  {age_group:'U12',standings:[{division_name:'Under 12C Orange',rows:[{team_name:'Shooters Hill AFC Cannons',played:1}]}],published_results:[
    {date:'2026-09-27',division_name:'Under 12C Orange',home:'Shooters Hill AFC Cannons',away:'Red Devils',homeGoals:5,awayGoals:0},
    {date:'2026-09-27',division_name:'Under 12D Navy',home:'Shooters Hill AFC Cannons',away:'Other Team',homeGoals:2,awayGoals:1}]},
  {age_group:'U14',standings:[{division_name:'Under 14D Navy',rows:[{team_name:'Shooters Hill AFC Cannons',played:1}]}],published_results:[
    {date:'2026-09-27',division_name:'Under 14D Navy',home:'Dartford Royals Blue',away:'Shooters Hill AFC Cannons',homeGoals:2,awayGoals:3}]},
  {age_group:'U9',standings:null,published_results:[{date:'2026-09-27',division_name:'Under 9D Navy',home:'Shooters Hill AFC Valiants',away:'Junior Reds Sabres',homeGoals:4,awayGoals:1}]}
]};
const overview = teams.map(team=>({team,state:{matches:[]}}));
overview[0].state.matches=[{id:'duplicate',date:'2026-09-27',opponent:'Red Devils',venue:'H',gf:5,ga:0,status:'played',competition:'League'}];
overview[2].state.matches=[{id:'private',date:'2026-09-27',opponent:'Junior Reds Sabres',venue:'H',gf:4,ga:1,status:'played',competition:'Division'}];

assert.equal(publishedClubTeamData(teams[0],feed).standing.rows[0].played,1);
assert.equal(publishedClubTeamData(teams[0],feed).results.length,1,'same name in another division must not match');
assert.equal(publishedClubTeamData(teams[2],feed).results.length,0,'under-12 public scores are excluded even if malformed feed data appears');
assert.equal(clubResultRows([], [teams[1]], feed).length,1,'a coach sees only its assigned team');
assert.equal(clubResultRows([{team:teams[2],state:overview[2].state}],[teams[2]],feed,true).length,1,'an assigned U9 coach sees its own recorded result');
const coachRows=coachClubResultRows(teams[2],overview[2].state,feed,teams);
assert.equal(coachRows.length,3,'a U9 coach sees club published U12+ results and its own recorded U9 result');
assert.equal(coachRows.filter(r=>r.source==='selkent-static').length,2);
assert.equal(coachRows.filter(r=>r.source==='internal').length,1,'other teams private U9 results are not exposed');
const rows=clubResultRows(overview,teams,feed,true);
assert.equal(rows.length,3,'published results, one private U9 result, and no duplicate U12 team record');
assert.equal(rows.filter(r=>r.source==='selkent-static').length,2);
assert.equal(rows.filter(r=>r.source==='internal').length,1);
assert.equal(rows.find(r=>r.source==='selkent-static'&&r.ageGroup===12).divisionName,'Under 12C Orange','published results retain the provider division');
const recorded=rows.find(r=>r.source==='internal');
assert.equal(recorded.home,'Shooters Hill AFC Valiants','the own side of a saved result uses the full club and team name');
assert.equal(recorded.divisionName,'Under 9D Navy','team-recorded league results use the assigned division');
const noLeagueName=internalAdminClubResults([{team:{id:'9',ageGroup:'U9',teamName:'Valiants'},state:{matches:[{id:'away',status:'played',venue:'A',opponent:'Junior Reds Sabres',gf:5,ga:4}]}}]);
assert.equal(noLeagueName[0].away,'Shooters Hill AFC Valiants','a team without a league label uses the configured club name');
assert.doesNotMatch(designCss, /\.club-result-score\s*\{\s*grid-template-columns:\s*1fr\s*!important/, 'mobile design rules must keep the three side-by-side score columns');
assert.equal(clubResultRows(overview,teams,null,true).length,2,'club records remain available when public feed is unavailable');
assert.equal(verifiedClubResultsFeed({...feed,coverage:{published_results:{parser_status:'awaiting_verified_nonempty_result_sample'}}}),null);
renderAdminRecentResults(rows,true);
assert.equal(elements.get('admin-results-count').textContent,'3');
assert.doesNotMatch(html,/admin-results-breakdown|Selkent published|team recorded/);
assert.match(html,/data-admin-summary="results">Club results<\/button>/);
assert.doesNotMatch(html,/id="admin-results-count"/);
const recentHtml=elements.get('admin-recent-results').innerHTML;
assert.doesNotMatch(recentHtml,/Selkent published|Team recorded/);
assert.match(recentHtml,/club-result-card/,'latest results use the approved result card');
assert.match(recentHtml,/Shooters Hill AFC Valiants/);
assert.match(recentHtml,/Junior Reds Sabres/);
assert.match(recentHtml,/Home score 4/,'home score is attached to its team');
assert.match(recentHtml,/Home score 2.*Away score 3/s,'away score stays beside the away team');
assert.ok(html.includes('id="club-results-list"'));
let resultWrites=0,resultHtml='';
const list={get innerHTML(){return resultHtml},set innerHTML(value){resultHtml=value;resultWrites++}},ageSelect={value:'',innerHTML:''},competitionSelect={value:'league'},page={textContent:''},previous={},next={};
const browserElements={'club-results-list':list,'club-results-age':ageSelect,'club-results-competition':competitionSelect,'club-results-page':page,'club-results-prev':previous,'club-results-next':next};
const browserDocument={getElementById:id=>browserElements[id]||null};
const browserBody=src.slice(src.indexOf('function clubResultsTableHTML('),src.indexOf('function renderAdminRecentResults('))+src.slice(src.indexOf('function renderClubResultsBrowser(){'),src.indexOf('async function refreshClubResults(quiet=false){'));
const badgeBody=src.slice(src.indexOf('function clubResultTeamBadgeHtml(teamName='),src.indexOf('function renderAdminRecentResults(',src.indexOf('function clubResultTeamBadgeHtml(teamName=')));
const placeholderBody=src.slice(src.indexOf('function clubPlaceholderBadgeHtml('),src.indexOf('function clubIdentityBadgeHtml('));
const placeholderBadge=new Function('clubPlaceholderBadgeData','esc',`${placeholderBody}\nreturn clubPlaceholderBadgeHtml;`)(
  name=>({src:'club-badge-unavailable.svg',alt:`Unavailable badge for ${name}`,status:'missing'}),s=>String(s)
);
const resultBadge=new Function('normalizeTeamKey','verifiedTeamBadgeUrl','clubSettings','configuredClubTeams','esc','FAILED_BADGE_URLS','clubPlaceholderBadgeHtml',`${badgeBody}\nreturn clubResultTeamBadgeHtml;`)(
  normalizeTeamKey,name=>name==='Cray Wanderers Ambers'?'/__pilot_badges/250/reviewed':'',
  ()=>({display_name:'Shooters Hill AFC',logo_url:'shooters-hill-logo.png'}),()=>[...teams,{leagueName:'Shooters Hill AFC Archers'}],s=>String(s),new Set(),placeholderBadge
);
assert.match(resultBadge('Cray Wanderers Ambers'),/\/__pilot_badges\/250\/reviewed/,'approved opponent badges use the reviewed URL');
assert.match(resultBadge('Shooters Hill AFC Archers'),/shooters-hill-logo\.png/,'other teams at this club use its configured crest');
assert.match(resultBadge('Junior Reds Sabres'),/club-badge-unavailable\.svg/,'an unapproved opponent uses the Unavailable badge');
const browser=new Function('document','window','resultForNamedTeam','resultClass','esc','matchTeamLabel','formatDate','isAdmin','isClubOverviewMode','clubResultCompetitionKind','clubResultTeamBadgeHtml','setStableHtml',
  `let __clubResultsRows=[],__clubResultsAge='all',__clubResultsCompetition='league',__clubResultsPage=0,__clubResultsWeekend='2026-09-26';const adminFixtureWeekendKey=()=>__clubResultsWeekend;const CLUB_RESULTS_PAGE_SIZE=6;const currentView='home',__clubTab='overview';${browserBody}\nreturn {show:renderClubResultsBrowser,setRows:rows=>{__clubResultsRows=rows},setCompetition:value=>{__clubResultsCompetition=value},setAge:value=>{__clubResultsAge=value}};`
)(browserDocument,{ClubHubCloud:{visibleTeamList:()=>teams}},()=> 'W',()=> 'result-W',s=>String(s),s=>s,s=>s,()=>true,()=>true,new Function(`${helpers}\nreturn clubResultCompetitionKind;`)(),resultBadge,setStableHtml);
browser.setRows(rows);browser.show();
browser.show();
assert.equal(resultWrites,1,'an unchanged results refresh keeps the badge image elements in place');
assert.equal(ageSelect.value,'all','Club Results opens on the complete club view');
assert.match(ageSelect.innerHTML,/Under 14s/,'coach results can filter ages present in club published rows');
assert.equal(competitionSelect.value,'league','Club Results defaults to league');
assert.match(list.innerHTML,/<b>U12<\/b><small class="cup-round">Under 12C Orange<\/small>/,'the row shows age and actual league division');
assert.match(list.innerHTML,/<b>U9<\/b><small class="cup-round">Under 9D Navy<\/small>/,'team-recorded result shows its division');
assert.doesNotMatch(list.innerHTML,/Selkent published|Team recorded|U9 · Valiants/,'source and nickname do not clutter card metadata');
assert.match(list.innerHTML,/Shooters Hill AFC Cannons/);
assert.match(list.innerHTML,/Shooters Hill AFC Valiants|Junior Reds Sabres/);
assert.equal((list.innerHTML.match(/class="club-identity-badge/g)||[]).length,rows.length*2,'each result shows a badge beside both teams');
ageSelect.value='12';browser.setAge('12');browser.show();
assert.doesNotMatch(list.innerHTML,/Junior Reds Sabres/,'the age selector still filters after the club-wide default');
browser.setRows([...rows,{home:'Valiants',away:'Friendly Rivals',hg:2,ag:1,date:'2026-09-20',competition:'Friendly',teamName:'Valiants',ageGroup:9},{home:'Cup Rivals',away:'Valiants',hg:0,ag:1,date:'2026-09-21',competition:'Challenge Cup',teamName:'Valiants',ageGroup:9}]);
ageSelect.value='all';browser.setAge('all');browser.show();
assert.doesNotMatch(list.innerHTML,/Friendly Rivals|Cup Rivals/,'league is the default result category');
browser.setCompetition('friendly');browser.show();assert.match(list.innerHTML,/Friendly Rivals/);assert.match(list.innerHTML,/<b>U9<\/b><small class="cup-round">Friendly<\/small>/);assert.doesNotMatch(list.innerHTML,/Cup Rivals/);
browser.setCompetition('cup');browser.show();assert.match(list.innerHTML,/Cup Rivals/);assert.doesNotMatch(list.innerHTML,/Friendly Rivals/);
assert.ok(html.includes('id="club-results-competition"'));
const leagueFixture={date:'2099-09-27',opponent:'Junior Reds Sabres',venue:'A'};
const fixtureFns=src.slice(src.indexOf('function fixtureLinkedMatch(f={}){'),src.indexOf('function nextPublishedFixture(){'));
const fixtureState={matches:[{date:'2099-09-27',opponent:'Junior Reds Sabres',venue:'A',status:'played',gf:5,ga:4}],selkent:{fixtures:[leagueFixture,{date:'2099-10-04',opponent:'Phoenix Sports Panthers',venue:'H'}],results:[]},division:{teamName:'Shooters Hill AFC Valiants'}};
const {fixtureIsReported,nextFixture}=new Function('state','normalizeTeamKey','matchStatus',`const CLOUD_MODE=false,currentRole='coach',miniCupGroup=()=>null;${fixtureFns}\nreturn {fixtureIsReported,nextFixture:()=>upcomingFixtures()[0]};`)(fixtureState,normalizeTeamKey,m=>m.status||'played');
assert.equal(fixtureIsReported(leagueFixture),true,'a saved result closes its linked public fixture');
assert.equal(nextFixture().opponent,'Phoenix Sports Panthers','the next match advances after the completed fixture');
const directory={leagues:[{age_group:'U9',division_name:'Under 9D Navy',teams:['Shooters Hill AFC Valiants']},{age_group:'U12',division_name:'Under 12C Orange',teams:['Shooters Hill AFC Cannons']}]};
const directoryClubDivision=new Function('normalizeTeamKey',`${helpers}\nreturn directoryClubDivision;`)(normalizeTeamKey);
assert.equal(directoryClubDivision({...teams[2],division:''},directory),'Under 9D Navy','missing database divisions resolve from the club directory');
const derby=[
 {team:{id:'a',ageGroup:'U12',teamName:'A',leagueName:'Club A'},state:{matches:[{id:'a1',status:'played',date:'2099-10-01',venue:'H',opponent:'Club B',competition:'Cup',gf:2,ga:1}]}},
 {team:{id:'b',ageGroup:'U12',teamName:'B',leagueName:'Club B'},state:{matches:[{id:'b1',status:'played',date:'2099-10-01',venue:'A',opponent:'Club A',competition:'Cup',gf:1,ga:2}]}}
];
assert.equal(clubResultRows(derby,derby.map(r=>r.team),null,true).length,1,'both club teams recording one match do not duplicate a result');
const multiAgeFeed={age_groups:[12,14].map(age=>({age_group:'U'+age,standings:[],published_results:[{date:'2099-10-01',division_name:'Under '+age+'A',home:'Club A',away:'Club B',homeGoals:2,awayGoals:1}]}))};
const multiAgeTeams=[12,14].map(age=>({id:String(age),ageGroup:'U'+age,teamName:'A',leagueName:'Club A'}));
assert.equal(clubResultRows([],multiAgeTeams,multiAgeFeed).length,2,'same club names on the same day in different ages are distinct matches');
const competitionRows=[{team:multiAgeTeams[0],state:{matches:[{id:'league',status:'played',date:'2099-10-01',venue:'H',opponent:'Club B',competition:'League',gf:2,ga:1},{id:'cup',status:'played',date:'2099-10-01',venue:'H',opponent:'Club B',competition:'Cup',gf:1,ga:0}]}}];
assert.equal(clubResultRows(competitionRows,multiAgeTeams,multiAgeFeed,true).length,3,'the published league score supersedes its team copy, while a cup game remains distinct');
console.log('Club Admin results feed, overview count and U9 privacy checks passed');
const cupFeed=structuredClone(feed);
cupFeed.coverage.published_results.cup_parser_status='verified_cup_scored_rows_v1';
const publicCup={date:'2026-10-11',home:'IEXEL F.C Gold',away:'Shooters Hill AFC Cannons',homeGoals:2,awayGoals:3,competition:'Selkent Cup Two',provider_cup_id:'cupCombined6-1',provider_match_ref:'B'};
cupFeed.age_groups[0].published_results.push(publicCup);
cupFeed.age_groups.push({age_group:'U12X',standings:[],published_results:[{...publicCup,home:'Wrong format rival',provider_cup_id:'cupCombined22-1'}]});
cupFeed.age_groups[2].published_results.push({...publicCup,away:'Shooters Hill AFC Valiants'});
const cupRows=clubResultRows([],teams,cupFeed);
assert.equal(cupRows.filter(r=>r.competition==='Selkent Cup Two').length,1,'cups match the exact age and format while U9 scores stay private');
assert.equal(publishedClubTeamData(teams[0],cupFeed).results.length,2,'a cup outside the league division is retained');
assert.equal(publishedClubTeamData(teams[0],cupFeed).standing.rows[0].played,1,'cup scores do not change standings');
browser.setRows(cupRows);browser.setCompetition('cup');browser.show();
assert.match(list.innerHTML,/IEXEL F.C Gold/);assert.match(list.innerHTML,/Selkent Cup Two/);
renderAdminRecentResults(cupRows,true);
assert.match(elements.get('admin-recent-results').innerHTML,/Home score 2.*Away score 3/s,'the real score helper retains home/away score order');
delete cupFeed.coverage.published_results.cup_parser_status;
assert.equal(publishedClubTeamData(teams[0],cupFeed).results.length,1,'unverified cup feed rows are excluded');
console.log('Public cup import, competition filter, format identity and privacy checks passed');

// The staff RPC hydrates shirt numbers in squad, not names in goal/award rows.
// Resolve within each team's squad, even when two teams use the same number.
const staffReportState=name=>({
 squad:[{name,number:9}],
 matches:[{id:'shared-match-id',opponent:'Example Blues',venue:'A',status:'played',gf:3,ga:0}],
 goals:[{matchId:'shared-match-id',shirtNumber:9,goals:2},{matchId:'other-match',shirtNumber:9,goals:4},{matchId:'shared-match-id',shirtNumber:88,goals:1}],
 awards:[{matchId:'shared-match-id',shirtNumber:9,type:'Player of the Match'}]
});
const reportRows=internalAdminClubResults([
 {team:{id:'example-u9',ageGroup:'U9',teamName:'Example Greens'},state:staffReportState('Alex Example')},
 {team:{id:'example-u10',ageGroup:'U10',teamName:'Example Whites'},state:staffReportState('Jamie Example')}
]);
assert.equal(reportRows[0].report.goals[0].player,'Alex Example');
assert.equal(reportRows[1].report.goals[0].player,'Jamie Example');
assert.equal(reportRows[0].report.goals.length,2,'other match goals stay excluded');
assert.equal(reportRows[0].report.goals[1].player,'#88','unmapped shirt stays visible without inventing a name');
assert.equal(reportRows[0].report.awards[0].player,'Alex Example');
assert.equal(reportRows[0].hg,0);assert.equal(reportRows[0].ag,3,'away score order retained');
const legacy=staffReportState('Alex Example');legacy.goals=[{matchId:'shared-match-id',player:'Legacy Example',goals:3}];
assert.equal(internalAdminClubResults([{team:teams[2],state:legacy}])[0].report.goals[0].player,'Legacy Example','existing named records still render');
console.log('PASS team-scoped mini-soccer scorer and award identity resolution');

const clubResultsSourceStatus=new Function(`${helpers}\nreturn clubResultsSourceStatus;`)();
assert.equal(clubResultsSourceStatus(null),'Selkent feed unavailable · showing team-recorded matches only');
assert.equal(clubResultsSourceStatus(feed),'');
assert.equal(clubResultsSourceStatus({...feed,cup_results_status:'verified_current'}),'');
const staleCupFeed={...cupFeed,cup_results_status:'stale_retained',cup_results_last_updated:'2026-10-12T13:49:27Z'};
assert.match(clubResultsSourceStatus(staleCupFeed),/Cup results could not refresh.*12 Oct.*14:49/);
assert.match(clubResultsSourceStatus({...staleCupFeed,cup_results_last_updated:'invalid'}),/date unavailable/);
assert.equal((src.match(/status.textContent=clubResultsSourceStatus\(feed\)/g)||[]).length,2,'Admin and Coach results display the same source warning');
