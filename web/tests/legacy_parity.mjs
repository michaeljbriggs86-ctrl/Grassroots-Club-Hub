// Differential parity check: legacy app.js vs web/src/domain. Not part of the product.
// Slices legacy source by name (the fragile technique the rebuild removes) only to compare outputs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { teamFixtures } from '../src/domain/fixtures.ts';
import { miniCupGroup } from '../src/domain/cupGroups.ts';
import { eventKey } from '../src/domain/keys.ts';
import { upcomingEvents } from '../src/domain/upcoming.ts';

const app = fs.readFileSync('app/src/main/assets/app.js', 'utf8');
const take = (from, to) => { const a = app.indexOf(from), b = app.indexOf(to, a); assert(a >= 0 && b > a, from); return app.slice(a, b); };
const feed = JSON.parse(fs.readFileSync('data/results.json', 'utf8'));
const norm = s => String(s || '').toLowerCase().replace(/&amp;/g, 'and').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

const TEAM = 'Shooters Hill AFC Royals', DIV = 'Under 10C Orange';
const rows = feed.age_groups.find(a => a.age_group === 'U10').fixtures;
const fixtures = teamFixtures(rows, { teamName: TEAM, divisionName: DIV, leagueLabel: 'League' });

class Clock extends Date { constructor(...a) { super(...(a.length ? a : ['2026-10-09T12:00:00'])); } static now() { return new Date('2026-10-09T12:00:00').getTime(); } }
function legacy(matches, role) {
  const ctx = {
    Date: Clock, CLOUD_MODE: true, currentRole: role,
    state: { meta: { ageGroup: 'U10' }, division: { name: DIV, teamName: TEAM }, matches, selkent: { fixtures: structuredClone(fixtures), results: [] } },
    ageGroupNumber: () => 10, selkentNorm: norm, normalizeTeamKey: norm, matchTeamLabel: s => s, matchStatus: m => m.status || 'played',
    resolvedFixture: f => f, fixtureDetailsConfirmed: () => false, cupFixtureDefaults: () => ({}),
  };
  vm.createContext(ctx);
  vm.runInContext(
    take('function fixtureLinkedMatch(', 'function fixtureFingerprint(') +
    take('function fixtureStableKey(', 'function legacyResponseKeyForFixture(') +
    take('function fixtureIsReported(', 'function fixtureCompetitionLabel(').replace(/function parentCupGroupDetails[\s\S]*$/, ''),
    ctx);
  return ctx;
}
const cup = fixtures.filter(f => f.competition.includes('Cup'));
const mk = (f, status = 'played') => ({ date: f.date, opponent: f.opponent, venue: f.venue, status });
const scenarios = [
  ['no results', []], ['one played', [mk(cup[0])]], ['both played', [mk(cup[0]), mk(cup[1])]],
  ['one abandoned', [mk(cup[0], 'abandoned')]], ['one scheduled', [mk(cup[0], 'scheduled')]],
];
let checked = 0;
for (const role of ['coach', 'parent']) for (const [name, matches] of scenarios) {
  const L = legacy(matches, role);
  const legacyOut = [...L.upcomingFixtures()].map(f => `${f.date}|${f.competition}|${L.miniCupGroup(f) ? 'GROUP' : norm(f.opponent)}`);
  const ev = upcomingEvents({ fixtures, matches, publishedResults: [], ownName: TEAM, ageNumber: 10, role, today: new Date('2026-10-09T00:00:00') });
  const newOut = ev.map(e => `${e.fixture.date}|${e.fixture.competition}|${e.group ? 'GROUP' : norm(e.fixture.opponent)}`);
  assert.deepEqual(newOut, legacyOut, `${role} / ${name}`);
  checked++;
}
const L = legacy([], 'coach');
for (const f of fixtures) {
  assert.equal(JSON.stringify(miniCupGroup(f, fixtures, 10)?.key ?? null), JSON.stringify(L.miniCupGroup(f)?.key ?? null), `group key ${f.date} ${f.opponent}`);
  assert.equal(eventKey(f, fixtures, 10), L.fixtureResponseKey(f), `event key ${f.date} ${f.opponent}`);
  checked++;
}
console.log(`PARITY OK: ${checked} comparisons, ${fixtures.length} real Royals fixtures`);
