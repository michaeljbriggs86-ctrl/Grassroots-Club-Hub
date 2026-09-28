import assert from 'node:assert/strict';
import test from 'node:test';
import { compareFixturePreview } from '../compare_fixture_preview.mjs';

const feed = { schema_version: 2, provider: 'Selkent', last_updated: '2026-09-28T06:00:00Z',
  age_groups: [{ agegroup_id: 3, fixture_week_ids: [2], fixtures: [{ home: 'ABC' }],
    fixture_parse_status: 'verified_multiweek_fixture_rows_v2' }] };
const snapshot = { schema: 'pitchkind-selkent-shadow-v1', canonical_feed_last_updated: feed.last_updated,
  fixture_preview: { 3: { discovered_week_ids: [2], fixtures: [{ home: 'ABC' }],
    fixture_parse_status: 'verified_multiweek_fixture_rows_v2' } } };

test('compares private fixture preview only for the captured feed version', () => {
  assert.equal(compareFixturePreview(snapshot, feed).status, 'exact');
  assert.equal(compareFixturePreview(snapshot, { ...feed, last_updated: '2026-09-28T12:00:00Z' }).status,
    'deferred_feed_version_differs');
  assert.equal(compareFixturePreview({ ...snapshot, fixture_preview: undefined }, feed).status,
    'pending_new_collection');
  const changed = structuredClone(snapshot);
  changed.fixture_preview[3].fixtures[0].home = 'Changed';
  assert.deepEqual(compareFixturePreview(changed, feed), {
    event: 'selkent-worker-fixtures', status: 'drift', age_groups: 1, fixtures: 1,
    different_age_groups: 1, different_week_lists: 0, different_statuses: 0,
  });
});
