import assert from 'node:assert/strict';
import test from 'node:test';
import { verifySnapshot } from '../verify-snapshot.mjs';

const NOW = Date.parse('2026-09-27T15:00:00Z');
const FEED = {
  schema_version: 2,
  provider: 'Selkent',
  last_updated: '2026-09-27T14:30:00Z',
  age_groups: [
    { agegroup_id: 3, age_group: 'U9', fixture_week_ids: [2], fixtures: [],
      standings: null, published_results: null,
      published_results_status: 'not_publicly_published' },
    { agegroup_id: 6, age_group: 'U12', fixture_week_ids: [2],
      standings: [{ provider_division_id: 4249 }],
      published_results_status: 'verified_scored_rows_v1' },
  ],
};

function snapshot() {
  return {
    schema: 'pitchkind-selkent-shadow-v1',
    collected_at: '2026-09-27T14:40:00Z',
    scheduled_at: '2026-09-27T14:30:00Z',
    canonical_feed_last_updated: FEED.last_updated,
    target_count: 5,
    payloads: {
      'fixturespage/3': '<div id="fixtureContainer"></div>',
      'fixturespage/3/2': '<div id="fixtureContainer"></div>',
      'fixturespage/6': '<div id="fixtureContainer"></div>',
      'fixturespage/6/2': '<div id="fixtureContainer"></div>',
      'resultsTable/4249': '<table></table><div id="results-4249"></div>',
    },
  };
}

test('verifies a matching complete snapshot without logging private HTML', () => {
  const summary = verifySnapshot(snapshot(), FEED, NOW);
  assert.equal(summary.target_count, 5);
  assert.equal(summary.feed_target_match, 'verified');
  assert.equal(summary.snapshot_age_minutes, 20);
  assert.ok(!JSON.stringify(summary).includes('fixtureContainer'));
});

test('fails on a missing provider payload even if the count claim is unchanged', () => {
  const value = snapshot();
  delete value.payloads['fixturespage/3/2'];
  assert.throws(() => verifySnapshot(value, FEED, NOW), /target count is incomplete/);
});

test('fails on a stale private snapshot', () => {
  const value = snapshot();
  value.collected_at = '2026-09-27T12:59:00Z';
  assert.throws(() => verifySnapshot(value, FEED, NOW), /snapshot is stale/);
});

test('does not compare target sets against a newer Sunday feed', () => {
  const newerFeed = { ...FEED, last_updated: '2026-09-27T14:50:00Z' };
  assert.equal(verifySnapshot(snapshot(), newerFeed, NOW).feed_target_match,
    'deferred_feed_version_differs');
});

test('rejects extra result targets absent from the matching public feed', () => {
  const value = snapshot();
  value.payloads['resultsTable/9999'] = '<table></table><div id="results-9999"></div>';
  value.target_count++;
  assert.throws(() => verifySnapshot(value, FEED, NOW), /differ from the matching public feed/);
});
