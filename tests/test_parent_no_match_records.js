#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('app/src/main/assets/app.js', 'utf8');
function extract(startMarker, endMarker) {
  const start = app.indexOf(startMarker), end = app.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `source boundary: ${startMarker}`);
  return app.slice(start, end);
}
const body = extract('function applyMatchFilter(){', 'function ensureTournamentState(){')
  + extract('function ensureTournamentState(){', 'function renderTournamentSquadChoices(');
const groups = {}, tables = {};
const tournamentList = {innerHTML: 'PRIVATE TOURNAMENT CONTENT'};
const tournamentCount = {textContent: '99'};
const state = {tournaments: [{id: 'private-tournament', name: 'PRIVATE TOURNAMENT'}]};
Object.defineProperty(state, 'matches', {configurable: true, get() {
  throw new Error('Parent read private match records');
}});
const ctx = {
  CLOUD_MODE: true, currentRole: 'parent', state,
  document: {getElementById: id => id === 'tournament-event-list' ? tournamentList
    : id === 'tournament-event-count' ? tournamentCount : {value: ''}},
  isPublishedLeagueTeam: () => true,
  isLeagueMatch: m => m.competition === 'League', isDivisionMatch: () => false,
  isFriendlyMatch: m => m.competition === 'Friendly', isCupMatch: m => m.competition === 'Cup',
  isVaseMatch: m => m.competition === 'Vase', isShieldMatch: m => m.competition === 'Shield',
  competitionBucket: m => ['League', 'Friendly', 'Cup', 'Vase', 'Shield'].includes(m.competition),
  renderMatchGroup: (id, _count, rows) => {groups[id] = Array.from(rows, m => m.id);},
  renderCompetitionGameTable: (kind, rows) => {tables[kind] = Array.from(rows, m => m.id);},
};
vm.runInNewContext(body, ctx);
ctx.applyMatchFilter();
for (const kind of ['league', 'friendly', 'other']) assert.deepEqual(groups[`${kind}-match-list`], []);
for (const kind of ['cup', 'vase', 'shield']) assert.deepEqual(tables[kind], []);
assert.equal(tournamentList.innerHTML, '');
assert.equal(tournamentCount.textContent, '0');
// Test the real tournament renderer independently, so the filter cannot mask a leak there.
tournamentList.innerHTML = 'PRIVATE TOURNAMENT CONTENT';
ctx.renderTournamentEvents();
assert.equal(tournamentList.innerHTML, '');
// A positive staff control proves the same extraction can render real records.
const records = ['League', 'Friendly', 'Cup', 'Vase', 'Shield', 'Other'].flatMap(competition => [
  {id: `${competition}-past`, competition, status: 'played', date: '2099-09-01', opponent: 'Earlier'},
  {id: `${competition}-later`, competition, status: 'scheduled', date: '2099-10-11', opponent: 'Later'},
]);
Object.defineProperty(state, 'matches', {value: records, configurable: true});
state.tournaments = [];
ctx.currentRole = 'coach';
ctx.applyMatchFilter();
for (const [kind, competition] of [['league', 'League'], ['friendly', 'Friendly'], ['other', 'Other']])
  assert.deepEqual(groups[`${kind}-match-list`], [`${competition}-later`, `${competition}-past`]);
for (const [kind, competition] of [['cup', 'Cup'], ['vase', 'Vase'], ['shield', 'Shield']])
  assert.deepEqual(tables[kind], [`${competition}-later`, `${competition}-past`]);
assert.match(app, /parent\?\[\['Home','home'\],\['Schedule','matches'\],\['Inbox','inbox'\]/);
assert.match(app, /currentRole==='parent'&&!\['home','matches','inbox','more'\]\.includes\(view\)/);
console.log('PASS independent parent match-record privacy and coach controls');
