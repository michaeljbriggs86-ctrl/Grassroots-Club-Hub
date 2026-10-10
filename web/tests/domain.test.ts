import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { teamFixtures, homeAway } from '../src/domain/fixtures.ts';
import { miniCupGroup } from '../src/domain/cupGroups.ts';
import { eventKey } from '../src/domain/keys.ts';
import { upcomingEvents } from '../src/domain/upcoming.ts';
import type { UpcomingInput } from '../src/domain/upcoming.ts';
import { ageNumber, parseAgeGroup } from '../src/domain/normalise.ts';
import { can, visibleMatch, playerLoginAllowed, stateForRole } from '../src/domain/access.ts';
import { assertNoYouthPublicResults, FeedPrivacyError } from '../src/domain/feedGuard.ts';
import type { FeedFixture, PrivateMatch } from '../src/domain/types.ts';

const feed = JSON.parse(readFileSync(new URL('../../data/results.json', import.meta.url), 'utf8'));
const u10: FeedFixture[] = feed.age_groups.find((a: { age_group: string }) => a.age_group === 'U10').fixtures;

const ROYALS = { teamName: 'Shooters Hill AFC Royals', divisionName: 'Under 10C Orange', leagueLabel: 'League' as const };
const TODAY = new Date('2026-10-09T00:00:00');

function input(over: Partial<UpcomingInput>): UpcomingInput {
  return { fixtures: [], matches: [], publishedResults: [], ownName: ROYALS.teamName, ageNumber: 10, role: 'coach', today: TODAY, ...over };
}

test('real feed: Royals Cup Two Round 2 is one group of two real games, home first', () => {
  const fx = teamFixtures(u10, ROYALS);
  const g = miniCupGroup(fx.find((f) => f.competition.includes('Cup'))!, fx, 10);
  assert.ok(g, 'group detected');
  assert.equal(g.date, '2026-10-18');
  assert.deepEqual([...g.opponents].sort(), ['Foots Cray Lions Black', 'Newpark Football Club']);
  const rows = g.fixtures.map((f) => homeAway(f, ROYALS.teamName));
  const newpark = rows.find((r) => r.home === 'Newpark Football Club');
  const foots = rows.find((r) => r.away === 'Foots Cray Lions Black');
  assert.deepEqual(newpark, { home: 'Newpark Football Club', away: ROYALS.teamName });
  assert.deepEqual(foots, { home: ROYALS.teamName, away: 'Foots Cray Lions Black' });
});

test('real feed: friendly and other-team rows are not Royals fixtures', () => {
  const fx = teamFixtures(u10, ROYALS);
  assert.ok(fx.every((f) => !/Gipsy Hill/.test(f.opponent)));
});

test('SYNTHETIC: intra-club game is kept in both team views (not dropped for a shared prefix)', () => {
  const rows: FeedFixture[] = [
    { date: '2099-01-01', division_name: 'SYNTHETIC U10 Cup', home: 'Shooters Hill AFC Vikings', away: 'Shooters Hill AFC Royals' },
  ];
  const vik = teamFixtures(rows, { teamName: 'Shooters Hill AFC Vikings', divisionName: '', leagueLabel: 'League' });
  const roy = teamFixtures(rows, { teamName: 'Shooters Hill AFC Royals', divisionName: '', leagueLabel: 'League' });
  assert.equal(vik.length, 1);
  assert.equal(roy.length, 1);
  assert.equal(vik[0]!.venue, 'H');
  assert.equal(roy[0]!.venue, 'A');
  assert.deepEqual(homeAway(vik[0]!, 'Shooters Hill AFC Vikings'), homeAway(roy[0]!, 'Shooters Hill AFC Royals'));
});

test('group is ONE upcoming event, stays after one result, leaves after both', () => {
  const fixtures = teamFixtures(u10, ROYALS);
  const cupGames = fixtures.filter((f) => f.competition.includes('Cup'));
  const played = (f: (typeof cupGames)[number]): PrivateMatch => ({ date: f.date, opponent: f.opponent, venue: f.venue, status: 'played' });
  const countCup = (m: PrivateMatch[]) => upcomingEvents(input({ fixtures, matches: m })).filter((e) => e.group).length;
  assert.equal(countCup([]), 1);
  assert.equal(countCup([played(cupGames[0]!)]), 1);
  assert.equal(countCup([played(cupGames[0]!), played(cupGames[1]!)]), 0);
});

test('parent still sees the group after both private results (private completion never changes parent view)', () => {
  const fixtures = teamFixtures(u10, ROYALS);
  const cupGames = fixtures.filter((f) => f.competition.includes('Cup'));
  const both = cupGames.map((f): PrivateMatch => ({ date: f.date, opponent: f.opponent, venue: f.venue, status: 'played' }));
  const ev = upcomingEvents(input({ fixtures, matches: both, role: 'parent' }));
  assert.equal(ev.filter((e) => e.group).length, 1);
});

test('a Cup group does not hide later non-Cup fixtures', () => {
  const fixtures = teamFixtures(
    [
      ...u10,
      { date: '2099-02-01', division_name: 'SYNTHETIC Under 10C Orange', home: 'Shooters Hill AFC Royals', away: 'SYNTHETIC FC' },
    ],
    { ...ROYALS, divisionName: 'SYNTHETIC Under 10C Orange' },
  );
  const ev = upcomingEvents(input({ fixtures }));
  assert.ok(ev.some((e) => e.fixture.opponent === 'SYNTHETIC FC'));
});

test('event key is identical before and after the first group result', () => {
  const fixtures = teamFixtures(u10, ROYALS);
  const cupGames = fixtures.filter((f) => f.competition.includes('Cup'));
  const k0 = eventKey(cupGames[0]!, fixtures, 10);
  const k1 = eventKey(cupGames[1]!, fixtures, 10);
  assert.equal(k0, k1);
});

test('older-age Cup ties stay ordinary single matches', () => {
  const rows: FeedFixture[] = [
    { date: '2099-03-01', division_name: 'SYNTHETIC U14 Cup', home: 'Shooters Hill AFC Vikings', away: 'SYNTHETIC A' },
    { date: '2099-03-01', division_name: 'SYNTHETIC U14 Cup', home: 'SYNTHETIC B', away: 'Shooters Hill AFC Vikings' },
  ];
  const fx = teamFixtures(rows, { teamName: 'Shooters Hill AFC Vikings', divisionName: '', leagueLabel: 'League' });
  assert.equal(miniCupGroup(fx[0]!, fx, 14), null);
});

test('DELIBERATE DIFFERENCE: U10X reads as 10 (legacy regex read it as 0)', () => {
  assert.equal(ageNumber('U10X'), 10);
  assert.equal(ageNumber('Under 8'), 8);
  assert.equal(ageNumber('Senior'), 0);
});

test('privacy: parents and players never see private results; players have no inbox or sensitive data', () => {
  const m: PrivateMatch = { date: '2099-01-01', opponent: 'X', venue: 'H', status: 'played' };
  assert.equal('status' in visibleMatch('parent', m), false);
  assert.equal('status' in visibleMatch('player', m), false);
  assert.equal('status' in visibleMatch('coach', m), true);
  for (const cap of ['view_private_results', 'enter_results', 'view_safeguarding', 'view_medical', 'view_parent_contacts', 'view_coach_notes', 'use_inbox'] as const) {
    assert.equal(can('player', cap), false, `player must not have ${cap}`);
  }
  for (const cap of ['view_private_results', 'enter_results', 'view_safeguarding', 'view_medical', 'view_parent_contacts', 'view_coach_notes'] as const) {
    assert.equal(can('parent', cap), false, `parent must not have ${cap}`);
  }
});

test('feed guard: real feed passes; a youth results leak is rejected', () => {
  assert.doesNotThrow(() => assertNoYouthPublicResults(feed));
  const leaked = { age_groups: [{ age_group: 'U9', published_results: [{ any: 1 }] }] };
  assert.throws(() => assertNoYouthPublicResults(leaked), FeedPrivacyError);
});

test('X teams: same age band, flagged as legacy squad format', () => {
  assert.deepEqual(parseAgeGroup('U9X'), { age: 9, legacyFormat: true });
  assert.deepEqual(parseAgeGroup('U9'), { age: 9, legacyFormat: false });
  assert.deepEqual(parseAgeGroup('Senior'), { age: 0, legacyFormat: false });
});

test('Player Login is U15 only', () => {
  for (let n = 5; n <= 18; n++) assert.equal(playerLoginAllowed(n), n === 15, `age ${n}`);
});

test('feed guard covers X youth groups and fails closed on unreadable names', () => {
  const mk = (age_group: string) => ({ age_groups: [{ age_group, standings: [{}], published_results: [{}] }] });
  assert.throws(() => assertNoYouthPublicResults(mk('U8X')), FeedPrivacyError);
  assert.throws(() => assertNoYouthPublicResults(mk('U10X')), FeedPrivacyError);
  assert.throws(() => assertNoYouthPublicResults(mk('Mystery squad')), FeedPrivacyError);
  assert.doesNotThrow(() => assertNoYouthPublicResults(mk('Senior')));
  assert.doesNotThrow(() => assertNoYouthPublicResults(mk('U12X')));
});

test('U12X is a published-results group, not a protected youth group', () => {
  const feedLike = { age_groups: [{ age_group: 'U12X', standings: [{}], published_results: [{}] }] };
  assert.doesNotThrow(() => assertNoYouthPublicResults(feedLike));
  assert.equal(parseAgeGroup('U12X').age, 12);
});

test('private scores: parents and players see them from U12 up only, unknown age fails closed', () => {
  const m: PrivateMatch = { date: '2026-10-18', opponent: 'X', venue: 'H', status: 'played' };
  for (const role of ['parent', 'player'] as const) {
    assert.equal('status' in visibleMatch(role, m, 11), false);
    assert.equal('status' in visibleMatch(role, m, undefined), false);
    assert.equal('status' in visibleMatch(role, m, 12), true);
    assert.equal('status' in visibleMatch(role, m, 15), true);
  }
});

test('tactics are coach only', () => {
  const state = { tactics: [1], squad: [2] };
  assert.equal('tactics' in stateForRole('parent', state), false);
  assert.equal('tactics' in stateForRole('player', state), false);
  assert.equal('tactics' in stateForRole('coach', state), true);
  assert.equal('squad' in stateForRole('parent', state), true);
});
