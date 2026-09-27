const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app/src/main/assets/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
const normalizeTeamKey = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const internalBody = src.slice(src.indexOf('function internalAdminClubResults(rows=[]){'), src.indexOf('function renderClubResultsBrowser(){'));
const internalAdminClubResults = new Function(`${internalBody}\nreturn internalAdminClubResults;`)();
const elements = new Map(['admin-recent-results','admin-results-count','admin-results-source-status'].map(id => [id,{innerHTML:'',textContent:''}]));
const document = {getElementById:id => elements.get(id)};
const helpers = src.slice(src.indexOf('function verifiedClubResultsFeed(feed){'), src.indexOf('function nextWeekendDates(){'));
const {verifiedClubResultsFeed,publishedClubTeamData,clubResultRows,renderAdminRecentResults} = new Function(
  'normalizeTeamKey','internalAdminClubResults','document','esc','formatDate','matchTeamLabel',
  `${helpers}\nreturn {verifiedClubResultsFeed,publishedClubTeamData,clubResultRows,renderAdminRecentResults};`
)(normalizeTeamKey,internalAdminClubResults,document,s=>String(s),(s=>s),(s=>s));

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
const rows=clubResultRows(overview,teams,feed,true);
assert.equal(rows.length,3,'published results, one private U9 result, and no duplicate U12 team record');
assert.equal(rows.filter(r=>r.source==='selkent-static').length,2);
assert.equal(rows.filter(r=>r.source==='internal').length,1);
assert.equal(clubResultRows(overview,teams,null,true).length,2,'club records remain available when public feed is unavailable');
assert.equal(verifiedClubResultsFeed({...feed,coverage:{published_results:{parser_status:'awaiting_verified_nonempty_result_sample'}}}),null);
renderAdminRecentResults(rows,true);
assert.equal(elements.get('admin-results-count').textContent,'3');
assert.match(elements.get('admin-recent-results').innerHTML,/Selkent published/);
assert.match(elements.get('admin-recent-results').innerHTML,/Team recorded/);
assert.ok(html.includes('id="admin-recent-results"')&&html.includes('id="club-results-list"'));
const list={innerHTML:''},ageSelect={value:'',innerHTML:''},competitionSelect={value:'league'},page={textContent:''},previous={},next={};
const browserElements={'club-results-list':list,'club-results-age':ageSelect,'club-results-competition':competitionSelect,'club-results-page':page,'club-results-prev':previous,'club-results-next':next};
const browserDocument={getElementById:id=>browserElements[id]||null};
const browserBody=src.slice(src.indexOf('function renderClubResultsBrowser(){'),src.indexOf('async function refreshClubResults(quiet=false){'));
const browser=new Function('document','window','resultForNamedTeam','resultClass','esc','matchTeamLabel','formatDate','isAdmin','isClubOverviewMode','clubResultCompetitionKind',
  `let __clubResultsRows=[],__clubResultsAge='all',__clubResultsCompetition='league',__clubResultsPage=0;const CLUB_RESULTS_PAGE_SIZE=6;const currentView='home',__clubTab='overview';${browserBody}\nreturn {show:renderClubResultsBrowser,setRows:rows=>{__clubResultsRows=rows},setCompetition:value=>{__clubResultsCompetition=value}};`
)(browserDocument,{ClubHubCloud:{visibleTeamList:()=>teams}},()=> 'W',()=> 'result-W',s=>String(s),s=>s,s=>s,()=>true,()=>true,new Function(`${helpers}\nreturn clubResultCompetitionKind;`)());
browser.setRows(rows);browser.show();
assert.equal(ageSelect.value,'all','Club Results opens on the complete club view');
assert.equal(competitionSelect.value,'league','Club Results defaults to league');
assert.match(list.innerHTML,/Shooters Hill AFC Cannons/);
assert.match(list.innerHTML,/Shooters Hill AFC Valiants|Junior Reds Sabres/);
ageSelect.value='12';browser.show();
assert.doesNotMatch(list.innerHTML,/Junior Reds Sabres/,'the age selector still filters after the club-wide default');
browser.setRows([...rows,{home:'Valiants',away:'Friendly Rivals',hg:2,ag:1,date:'2026-09-20',competition:'Friendly',teamName:'Valiants',ageGroup:9},{home:'Cup Rivals',away:'Valiants',hg:0,ag:1,date:'2026-09-21',competition:'Challenge Cup',teamName:'Valiants',ageGroup:9}]);
ageSelect.value='all';browser.show();
assert.doesNotMatch(list.innerHTML,/Friendly Rivals|Cup Rivals/,'league is the default result category');
browser.setCompetition('friendly');browser.show();assert.match(list.innerHTML,/Friendly Rivals/);assert.doesNotMatch(list.innerHTML,/Cup Rivals/);
browser.setCompetition('cup');browser.show();assert.match(list.innerHTML,/Cup Rivals/);assert.doesNotMatch(list.innerHTML,/Friendly Rivals/);
assert.ok(html.includes('id="club-results-competition"'));
const leagueFixture={date:'2099-09-27',opponent:'Junior Reds Sabres',venue:'A'};
const fixtureFns=src.slice(src.indexOf('function fixtureLinkedMatch(f={}){'),src.indexOf('function nextPublishedFixture(){'));
const fixtureState={matches:[{date:'2099-09-27',opponent:'Junior Reds Sabres',venue:'A',status:'played',gf:5,ga:4}],selkent:{fixtures:[leagueFixture,{date:'2099-10-04',opponent:'Phoenix Sports Panthers',venue:'H'}],results:[]},division:{teamName:'Shooters Hill AFC Valiants'}};
const {fixtureIsReported,nextFixture}=new Function('state','normalizeTeamKey','matchStatus',`${fixtureFns}\nreturn {fixtureIsReported,nextFixture:()=>upcomingFixtures()[0]};`)(fixtureState,normalizeTeamKey,m=>m.status||'played');
assert.equal(fixtureIsReported(leagueFixture),true,'a saved result closes its linked public fixture');
assert.equal(nextFixture().opponent,'Phoenix Sports Panthers','the next match advances after the completed fixture');
const directory={leagues:[{age_group:'U9',division_name:'Under 9D Navy',teams:['Shooters Hill AFC Valiants']},{age_group:'U12',division_name:'Under 12C Orange',teams:['Shooters Hill AFC Cannons']}]};
const directoryClubDivision=new Function('normalizeTeamKey',`${helpers}\nreturn directoryClubDivision;`)(normalizeTeamKey);
assert.equal(directoryClubDivision({...teams[2],division:''},directory),'Under 9D Navy','missing database divisions resolve from the club directory');
console.log('Club Admin results feed, overview count and U9 privacy checks passed');
