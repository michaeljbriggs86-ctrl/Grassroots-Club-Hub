const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app/src/main/assets/app.js'), 'utf8');
const body = src.slice(src.indexOf('function buildAdminFixtureRows(rows,feed=null){'), src.indexOf('function renderAdminFixtures(){'));
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const stableKey = f => [norm(f.opponent||'tbc'),String(f.venue||'').toUpperCase(),norm(f.competition||'fixture')].join('|');
const key = f => [f.date,stableKey(f)].join('|');
const build = new Function('selkentNorm', 'fixtureAckState', 'fixtureKitSelectionKey', 'fixtureStableKey', 'matchStatus', `${body}\nreturn buildAdminFixtureRows;`)(
  norm,
  (st, f) => st.selkent?.fixtureAcknowledgement?.status === 'confirmed' && st.selkent.fixtureAcknowledgement.key === key(f)
    ? {status: 'confirmed', label: 'Fixture confirmed'} : {status: 'awaiting', label: 'Awaiting confirmation'},
  key,
  stableKey,
  m => m.status || 'scheduled'
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

const realFeed = JSON.parse(fs.readFileSync(path.join(root, 'data/results.json'), 'utf8'));
const real = build(teams, realFeed);
if (new Date().toISOString().slice(0, 10) <= '2026-09-27') {
  assert.ok(real.some(x => x.team.id === 'u12-lions' && /Dartford Royals/i.test(x.opponent)), 'the bundled U12 feed matches its actual team and division');
  assert.ok(real.some(x => x.team.id === 'u14-lions' && /South Darenth/i.test(x.opponent)), 'the same team name matches the independent U14 feed');
  const valiantFixture={date:'2026-09-27',opponent:'Junior Reds Sabres',venue:'A',competition:'Division'};
  const valiantTeam={team:{id:'u9-valiants',ageGroup:'U9',teamName:'Valiants',leagueName:'Shooters Hill AFC Valiants',division:'Under 9D Navy'},state:{matches:[],selkent:{fixtures:[valiantFixture],fixtureOverrides:{[key(valiantFixture)]:{time:'09:30',groundName:'Confirmed Ground',address:'Confirmed Address',confirmedAt:'2026-09-26T10:00:00Z'}}}}};
  const valiantRow=build([valiantTeam],realFeed).find(x=>x.opponent==='Junior Reds Sabres');
  assert.equal(valiantRow?.ack.status,'confirmed','the actual U9 feed joins to the saved Valiants confirmation');
  assert.equal(valiantRow?.time,'09:30');
}
console.log('Club Admin fixture feed checks passed');
