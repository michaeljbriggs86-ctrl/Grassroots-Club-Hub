const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app/src/main/assets/app.js'), 'utf8');
const body = src.slice(src.indexOf('function buildAdminFixtureRows(rows,feed=null){'), src.indexOf('function renderAdminFixtures(){'));
const build = new Function('selkentNorm', 'fixtureAckState', 'matchStatus', `${body}\nreturn buildAdminFixtureRows;`)(
  s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
  () => ({status: 'awaiting', label: 'Awaiting confirmation'}),
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

const realFeed = JSON.parse(fs.readFileSync(path.join(root, 'data/results.json'), 'utf8'));
const real = build(teams, realFeed);
if (new Date().toISOString().slice(0, 10) <= '2026-09-27') {
  assert.ok(real.some(x => x.team.id === 'u12-lions' && /Dartford Royals/i.test(x.opponent)), 'the bundled U12 feed matches its actual team and division');
  assert.ok(real.some(x => x.team.id === 'u14-lions' && /South Darenth/i.test(x.opponent)), 'the same team name matches the independent U14 feed');
}
console.log('Club Admin fixture feed checks passed');
