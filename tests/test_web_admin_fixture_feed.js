const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app/src/main/assets/app.js'), 'utf8');
const body = src.slice(src.indexOf('function adminFixtureHasResult(st,team,fixture,feed){'), src.indexOf('function renderAdminFixtures(){'));
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const stableKey = f => [norm(f.opponent||'tbc'),String(f.venue||'').toUpperCase(),norm(f.competition||'fixture')].join('|');
const key = f => [f.date,stableKey(f)].join('|');
const build = new Function('selkentNorm', 'normalizeTeamKey', 'fixtureAckState', 'fixtureKitSelectionKey', 'fixtureStableKey', 'matchStatus', 'publishedClubTeamData', 'verifiedClubResultsFeed', `${body}\nreturn buildAdminFixtureRows;`)(
  norm,
  norm,
  (st, f) => st.selkent?.fixtureAcknowledgement?.status === 'confirmed' && st.selkent.fixtureAcknowledgement.key === key(f)
    ? {status: 'confirmed', label: 'Fixture confirmed'} : {status: 'awaiting', label: 'Awaiting confirmation'},
  key,
  stableKey,
  m => m.status || 'scheduled',
  (team, feed) => ({results:feed?.age_groups?.find(group => group.age_group === team.ageGroup)?.published_results || []}),
  feed => feed?.coverage?.published_results?.parser_status === 'verified_scored_rows_v1' ? feed : null
);

const teams = [
  {team: {id: 'u12-lions', ageGroup: 'U12', teamName: 'Lions', leagueName: 'Shooters Hill AFC Lions', division: 'Under 12D Navy'}, state: {matches: []}},
  {team: {id: 'u14-lions', ageGroup: 'U14', teamName: 'Lions', leagueName: 'Shooters Hill AFC Lions', division: 'Under 14C Navy'}, state: {matches: []}},
  {team: {id: 'u13-empty', ageGroup: 'U13', teamName: 'Falcons', leagueName: 'Shooters Hill AFC Falcons', division: 'Under 13A'}, state: {matches: []}}
];
const feed = {age_groups: [
  {age_group: 'U12', fixtures: [
    {date: '2099-10-01', division_name: 'Under 12D Navy', home: 'Dartford Royals', away: 'Shooters Hill AFC Lions'},
    {date: '2099-10-01', division_name: 'Under 12D Navy', home: 'Shooters Hill AFC Lions', away: 'Dartford Royals'},
    {date: '2099-10-02', division_name: 'Under 12A', home: 'Shooters Hill AFC Lions', away: 'Wrong Division'}
  ]},
  {age_group: 'U14', fixtures: [{date: '2099-10-03', division_name: 'Under 14C Navy', home: 'Shooters Hill AFC Lions', away: 'Fleetdown United'}]}
]};
let rows = build(teams, feed);
assert.equal(rows.length, 2, 'the published feed supplies both ages and no invented TBC fixture');
assert.equal(rows.find(x => x.team.id === 'u12-lions').opponent, 'Dartford Royals');
assert.equal(rows.find(x => x.team.id === 'u14-lions').opponent, 'Fleetdown United');

teams[0].state.matches = [{date: '2099-10-01', opponent: 'Dartford Royals', status: 'scheduled'}, {date: '2099-10-07', opponent: 'Cup Opponent', status: 'scheduled'}];
rows = build(teams, feed);
assert.equal(rows.length, 3, 'team matches supplement, without duplicating, the published schedule');
assert.equal(rows.find(x => x.opponent === 'Cup Opponent').source, 'Team');

teams[0].state.selkent = {fixtures: [{date: '2099-10-05', opponent: 'Saved Fallback', venue: 'H'}]};
assert.equal(build(teams, feed).some(x => x.opponent === 'Saved Fallback'), false, 'stale saved fixtures do not override the available feed');
assert.equal(build(teams, null).some(x => x.opponent === 'Saved Fallback'), true, 'saved fixtures remain available when the feed fails');

const confirmed = {date:'2099-10-01',opponent:'Dartford Royals',venue:'A',competition:'League'};
teams[0].state.selkent.fixtures.push({...confirmed,time:''});
teams[0].state.selkent.fixtureOverrides = {[key(confirmed)]:{time:'10:30',groundName:'Oak Field',address:'1 Oak Road',confirmedAt:'2099-09-25T12:00:00Z'}};
rows = build(teams, feed);
const adminConfirmed = rows.find(x => x.team.id === 'u12-lions');
assert.equal(adminConfirmed.time, '10:30', 'Club Admin sees the coach confirmed kick-off');
assert.equal(adminConfirmed.groundName, 'Oak Field', 'Club Admin sees the coach confirmed ground');
assert.equal(adminConfirmed.address, '1 Oak Road', 'Club Admin sees the coach confirmed address');
assert.equal(adminConfirmed.ack.status, 'confirmed', 'confirmation is read from the team override, including when the single acknowledgement points elsewhere');
teams[0].state.selkent.fixtureOverrides = {};
teams[0].state.matches.push({date:'2099-10-01',opponent:'Dartford Royals',venue:'A',status:'played',gf:5,ga:4});
assert.equal(build(teams,feed).some(x=>x.team.id==='u12-lions'&&x.opponent==='Dartford Royals'&&x.venue==='A'),false,'a team recorded result removes its matching away fixture');
assert.equal(build(teams,feed).some(x=>x.team.id==='u14-lions'),true,'the other age group remains upcoming');
teams[0].state.matches=teams[0].state.matches.filter(m=>m.status!=='played');
const scoredFeed={coverage:{published_results:{parser_status:'verified_scored_rows_v1'}},age_groups:[{age_group:'U12',fixtures:feed.age_groups[0].fixtures,published_results:[{date:'2099-10-01',home:'Dartford Royals',away:'Shooters Hill AFC Lions',homeGoals:2,awayGoals:3}]}]};
assert.equal(build([teams[0]],scoredFeed).some(x=>x.opponent==='Dartford Royals'&&x.venue==='A'),false,'an official published result also removes its matching fixture');
assert.equal(build([teams[0]],feed).some(x=>x.opponent==='Dartford Royals'&&x.venue==='A'),true,'unverified or missing published scores do not hide fixtures');
const ackBody=src.slice(src.indexOf('function fixtureAckState(st=state,f=nextPublishedFixture()){'),src.indexOf('function setFixtureAcknowledgement(status){'));
const fixtureAck=new Function('fixtureFingerprint','fixtureStableKey','fixtureChangeText',`${ackBody}\nreturn fixtureAckState;`)(f=>key(f),stableKey,()=> 'changed');
const stale={selkent:{fixtureTracking:{key:stableKey({opponent:'Other Club',venue:'A',competition:'League'}),changed:true,changes:[{field:'date',before:'1 Oct',after:'2 Oct'}]},fixtureAcknowledgement:{}}};
assert.equal(fixtureAck(stale,{opponent:'Dartford Royals',venue:'A',competition:'League',date:'2099-10-01'}).status,'awaiting','change tracking for another fixture cannot force reconfirmation');
assert.equal(fixtureAck(stale,{opponent:'Other Club',venue:'A',competition:'League',date:'2099-10-01'}).status,'changed','the actual changed fixture still requires reconfirmation');
stale.selkent.fixtureTracking.changes=[{field:'opponent',before:'Junior Reds Sabres',after:'Phoenix Sports Panthers'},{field:'date',before:'27 Sep',after:'4 Oct'}];
assert.equal(fixtureAck(stale,{opponent:'Other Club',venue:'A',competition:'League',date:'2099-10-01'}).status,'awaiting','a replacement opponent is a new fixture, not a changed one');
stale.selkent.fixtureTracking.changes=[{field:'kitColours',before:'Green',after:'Blue'}];
assert.equal(fixtureAck(stale,{opponent:'Other Club',venue:'A',competition:'League',date:'2099-10-01'}).status,'awaiting','directory kit enrichment is not a published fixture change');
const identityBody=src.slice(src.indexOf('function fixtureChangeList(before={},after={}){'),src.indexOf('function updateFixtureTracking(previousFixture,nextFixture){'));
const {likelySameFixture,fixtureChangeList}=new Function('selkentNorm','formatDate',`${identityBody}\nreturn {likelySameFixture,fixtureChangeList};`)(norm,s=>s);
const junior={opponent:'Junior Reds Sabres',date:'2026-09-27',venue:'H',competition:'Division',groundName:'East Wickham Primary Academy'};
const phoenix={opponent:'Phoenix Sports Panthers',date:'2026-10-04',venue:'H',competition:'Division',groundName:'East Wickham Primary Academy'};
assert.equal(likelySameFixture(junior,phoenix),false,'sharing the same home ground does not make two matches the same fixture');
assert.equal(likelySameFixture(junior,{...junior,date:'2026-10-04'}),true,'a published match rescheduled against the same opponent remains identifiable');
assert.deepEqual(fixtureChangeList(junior,{...junior,groundName:'New Ground',kitColours:'Blue'}),[],'directory ground and kit changes do not trigger fixture warnings');
assert.deepEqual(fixtureChangeList(junior,{...junior,date:'2026-10-04'}).map(x=>x.field),['date'],'a published date change is flagged');

const valiantFixture={date:'2099-09-27',opponent:'Junior Reds Sabres',venue:'A',competition:'Division'};
const valiantTeam={team:{id:'u9-valiants',ageGroup:'U9',teamName:'Valiants',leagueName:'Shooters Hill AFC Valiants',division:'Under 9D Navy'},state:{matches:[],selkent:{fixtures:[valiantFixture],fixtureOverrides:{[key(valiantFixture)]:{time:'09:30',groundName:'Confirmed Ground',address:'Confirmed Address',confirmedAt:'2099-09-26T10:00:00Z'}}}}};
const valiantFeed={age_groups:[{age_group:'U9',fixtures:[{date:'2099-09-27',division_name:'Under 9D Navy',home:'Junior Reds Sabres',away:'Shooters Hill AFC Valiants'}]}]};
const valiantRow=build([valiantTeam],valiantFeed).find(x=>x.opponent==='Junior Reds Sabres');
assert.equal(valiantRow?.ack.status,'confirmed','the U9 feed joins to the saved Valiants confirmation');
assert.equal(valiantRow?.time,'09:30');
valiantTeam.state.matches.push({date:'2099-09-27',opponent:'Junior Reds Sabres',venue:'A',status:'played',gf:5,ga:4});
assert.equal(build([valiantTeam],valiantFeed).length,0,'Valiants recorded result removes the fixture from the admin list');

const renderBody=src.slice(src.indexOf('function renderAdminFixtures(){'),src.indexOf('async function refreshAdminFixtures(',src.indexOf('function renderAdminFixtures(){')));
const list={innerHTML:''},summary={textContent:''},ageSelect={value:'all'};
const homeTeam={id:'u12-lions',ageGroup:'U12',teamName:'Lions'};
const fixtureRows=[{team:homeTeam,source:'Selkent',date:'2099-10-01',time:'10:30',opponent:'Dartford Royals',venue:'H',competition:'Division',groundName:'Oak Field',address:'1 Oak Road',ack:{status:'confirmed',label:'Fixture confirmed'}}];
const render=new Function('document','populateAdminFixtureAgeFilter','__adminOverviewRows','__adminFixtureRows','__adminPublishedFeed','__adminDirectoryCache','selkentNorm','formatDate','matchTeamLabel','esc','clubResultTeamBadgeHtml','fullClubResultTeamName',`${renderBody}\nreturn renderAdminFixtures;`)(
  {getElementById:id=>({'admin-fixture-list':list,'admin-fixtures-age':ageSelect,'admin-fixture-summary':summary})[id]},
  ()=>{},[{team:homeTeam}],
  fixtureRows,
  {age_groups:[]},new Map(),norm,s=>s,s=>s,s=>s,s=>`<img alt="" src="badge.svg" data-team="${s}">`,team=>`Shooters Hill AFC ${team.teamName}`
);
render();
assert.equal((list.innerHTML.match(/badge\.svg/g)||[]).length,2,'Admin fixtures show a badge beside both clubs');
assert.doesNotMatch(list.innerHTML,/Oak Field|1 Oak Road|East Wickham Primary Academy/,'venue and address are absent from the card');
assert.match(list.innerHTML,/admin-fixture-matchup.*<b>v<\/b>/,'clubs share one matchup row');
assert.match(list.innerHTML,/>League</,'division fixtures display as league fixtures');
assert.match(list.innerHTML,/club-result-team home[^>]*>.*Shooters Hill AFC Lions.*<b>v<\/b>.*club-result-team away[^>]*>.*Dartford Royals.*badge\.svg/s,'home name and badge are left, away name and badge are right');
assert.doesNotMatch(list.innerHTML,/League · Home|League · Away|Venue unconfirmed/,'venue labels are absent');
assert.doesNotMatch(list.innerHTML,/Open in Maps|fixture-source-pill|>Selkent</,'redundant links and source labels are omitted');
fixtureRows[0].venue='A';
render();
assert.match(list.innerHTML,/club-result-team home[^>]*>.*Dartford Royals.*<b>v<\/b>.*club-result-team away[^>]*>.*Shooters Hill AFC Lions.*badge\.svg/s,'an away fixture puts the opponent and its badge on the left');
console.log('Club Admin fixture feed checks passed');
