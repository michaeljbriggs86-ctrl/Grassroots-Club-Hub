import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCandidateFeed } from '../src/candidate-feed.mjs';

function example() {
  const feed = {
    schema_version: 2, provider: 'Selkent', last_updated: '2026-09-29T12:06:00Z',
    coverage: { fixtures: { scope: 'all Selkent age groups' } },
    age_groups: [
      { agegroup_id: 3, age_group: 'U9', fixture_week_ids: [2], fixtures: [],
        fixture_parse_status: 'verified_empty_multiweek_v2', standings: null,
        published_results: null, published_results_status: 'not_publicly_published' },
      { agegroup_id: 6, age_group: 'U12', fixture_week_ids: [], fixtures: [],
        fixture_parse_status: 'verified_empty', results_format_type: '11v11',
        standings: [{ provider_division_id: 4249, rows: [] }],
        published_results: [], published_results_status: 'verified_scored_rows_v1' },
    ],
  };
  const fixture = { date: '2026-09-30', division_name: 'U9 Test',
    home: 'Home', away: 'Away', provider_team_ids: ['10', '11'] };
  const snapshot = {
    schema: 'pitchkind-selkent-shadow-v1',
    canonical_feed_last_updated: feed.last_updated,
    collected_at: '2026-09-29T12:16:00Z',
    fixture_preview: {
      3: { discovered_week_ids: [2], fixtures: [fixture],
        fixture_parse_status: 'verified_multiweek_fixture_rows_v2' },
      6: { discovered_week_ids: [], fixtures: [], fixture_parse_status: 'verified_empty' },
    },
    standings_preview: { 6: [{ provider_division_id: 4249, rows: [] }] },
    published_results_preview: { 6: [{ date: '2026-09-28', home: 'Home',
      away: 'Away', homeGoals: 1, awayGoals: 0, provider_division_id: 4249,
      division_name: 'U12 Test' }] },
  };
  return { feed, snapshot };
}

test('assembles one private schema-v2 candidate without restricted results', () => {
  const { feed, snapshot } = example();
  const candidate = buildCandidateFeed(snapshot, feed);
  assert.equal(candidate.last_updated, snapshot.collected_at);
  assert.equal(candidate.age_groups[0].fixtures.length, 1);
  assert.equal(candidate.age_groups[0].published_results, null);
  assert.equal(candidate.age_groups[0].standings, null);
  assert.equal(candidate.age_groups[1].published_results.length, 1);
  assert.equal(candidate.age_groups[1].results_format_type, '11v11');
  assert.equal(candidate.coverage, feed.coverage);
  assert.equal(feed.age_groups[0].fixtures.length, 0);
});

test('rejects a new fixture week because its page was not collected', () => {
  const { feed, snapshot } = example();
  snapshot.fixture_preview[3].discovered_week_ids.push(3);
  assert.throws(() => buildCandidateFeed(snapshot, feed), /coverage is incomplete/);
});

test('rejects missing public tables and restricted score fields', () => {
  const { feed, snapshot } = example();
  snapshot.standings_preview[6] = [];
  assert.throws(() => buildCandidateFeed(snapshot, feed), /results coverage is incomplete/);
  snapshot.standings_preview[6] = [{ provider_division_id: 4249, rows: [] }];
  snapshot.fixture_preview[3].fixtures[0].homeGoals = 2;
  assert.throws(() => buildCandidateFeed(snapshot, feed), /fixture shape is unsafe/);
});

test('rejects mismatched feed version and extra restricted result preview', () => {
  const { feed, snapshot } = example();
  snapshot.canonical_feed_last_updated = '2026-09-29T06:00:00Z';
  assert.throws(() => buildCandidateFeed(snapshot, feed), /do not match/);
  snapshot.canonical_feed_last_updated = feed.last_updated;
  snapshot.published_results_preview[3] = [];
  assert.throws(() => buildCandidateFeed(snapshot, feed), /Incomplete private results preview/);
});
