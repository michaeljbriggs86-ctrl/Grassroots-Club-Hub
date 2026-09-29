import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyPublication } from '../verify-publication.mjs';

function sample() {
  const feed = { schema_version: 2, provider: 'Selkent',
    last_updated: '2026-09-29T12:06:00Z', age_groups: [
      { age_group: 'U9', standings: null, published_results: null,
        published_results_status: 'not_publicly_published', fixtures: [] },
      { age_group: 'U12', standings: [], published_results: [], fixtures: [] },
    ] };
  const snapshot = { canonical_feed_last_updated: feed.last_updated,
    collected_at: '2026-09-29T12:16:00Z' };
  const candidate = { ...feed, last_updated: snapshot.collected_at };
  return { feed, snapshot, candidate };
}

test('publishes only an exact, newer private candidate', () => {
  const { snapshot, feed, candidate } = sample();
  assert.equal(verifyPublication(snapshot, feed, candidate).status, 'exact');
  assert.equal(verifyPublication(snapshot, feed, candidate,
    { ...candidate, last_updated: '2026-09-29T06:16:00Z' }).previous, 'checked');
  assert.throws(() => verifyPublication(snapshot, feed, candidate,
    { ...candidate, last_updated: '2026-09-29T18:16:00Z' }), /newer/);
});

test('rejects provider changes, stale feed versions and restricted results', () => {
  const { snapshot, feed, candidate } = sample();
  candidate.age_groups = structuredClone(candidate.age_groups);
  candidate.age_groups[1].published_results.push({ homeGoals: 2 });
  assert.throws(() => verifyPublication(snapshot, feed, candidate), /differs/);
  candidate.age_groups[1].published_results = [];
  candidate.age_groups[0].published_results = [];
  assert.throws(() => verifyPublication(snapshot, feed, candidate), /restricted/);
  candidate.age_groups[0].published_results = null;
  snapshot.canonical_feed_last_updated = '2026-09-29T06:06:00Z';
  assert.throws(() => verifyPublication(snapshot, feed, candidate), /versions/);
});
