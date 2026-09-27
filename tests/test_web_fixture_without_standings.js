const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const feed = JSON.parse(fs.readFileSync(path.join(root, 'data/results.json'), 'utf8'));
const overlay = fs.readFileSync(path.join(root, 'app/src/main/assets/static-feed-overlay.js'), 'utf8');
const extract = (start, end) => {
  const a = overlay.indexOf(start), b = overlay.indexOf(end, a);
  assert(a >= 0 && b > a, `Missing overlay section: ${start}`);
  return overlay.slice(a, b);
};

const state = {
  meta: { ageGroup: 'U12', teamName: 'Lions' },
  division: { name: 'Under 12D Navy', teamName: 'Shooters Hill AFC Lions' },
  selkent: { fixtures: [], table: [] }
};
let saves = 0;
const window = {
  leagueTableEnabled: () => true,
  isPublishedLeagueTeam: () => true,
  nextPublishedFixture: () => state.selkent.fixtures[0] || null,
  syncProviderClubTeams: async () => {},
  refreshPublishedLeagueAges: async () => {}
};
const context = vm.createContext({
  state, window, document: { getElementById: () => null },
  norm: s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
  ageCode: () => 'U12', loadResults: async () => feed,
  persistWithoutRender: () => {}, saveAndRender: () => { saves++; },
  TABLE_SOURCE: 'test-standings', FIXTURE_SOURCE: 'test-fixtures',
  applyStaticDivision: async () => {}, liveResultFallback: async () => ({ results: [] })
});
vm.runInContext(extract('  function findResultsAge(', '  async function staticPublishedAges('), context);
vm.runInContext(extract('  function sameTeam(', '  async function liveFixtureFallback('), context);
vm.runInContext(extract('  window.syncSelkent=async function(silent=false){', '  /* Defence in depth:'), context);

(async () => {
  await window.syncSelkent(true);
  assert.equal(state.selkent.fixtureSource, 'test-fixtures');
  assert.equal(state.selkent.fixtures.length, 2);
  assert.deepEqual(Array.from(state.selkent.fixtures, f => f.date), ['2026-09-27', '2026-10-04']);
  assert.equal(state.selkent.fixtures[0].opponent, 'Dartford Royals yellow');
  assert.equal(state.selkent.fixtures[1].opponent, 'Cray Wanderers Ambers');
  assert.equal(state.selkent.table.length, 0);
  assert.match(state.selkent.tableStatus, /has not published standings/);
  assert.equal(saves, 1);
  console.log('U12 Lions fixtures load without published standings');
})().catch(error => { console.error(error); process.exitCode = 1; });
