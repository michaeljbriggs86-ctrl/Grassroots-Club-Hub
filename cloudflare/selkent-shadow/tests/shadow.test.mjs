import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import worker, { collectShadow, FEED_URL, targetsFromFeed } from '../src/index.mjs';

const NOW = Date.parse('2026-09-27T15:00:00Z');
const miniFeed = {
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

function fakeProvider(feed = miniFeed, failPath = '') {
  const seen = [];
  async function fetcher(input) {
    const url = String(input);
    seen.push(url);
    if (url === FEED_URL) return Response.json(feed);
    const path = new URL(url).pathname.replace('/public/', '');
    if (path === failPath) return new Response('unavailable', { status: 503 });
    const html = path.startsWith('fixturespage/')
      ? '<div id="fixtureContainer"></div>'
      : '<table><thead></thead></table><div id="results-4249"></div>';
    return Response.json({ success: true, html });
  }
  return { fetcher, seen };
}

test('collects a complete private snapshot without requesting U9 results', async () => {
  const { fetcher, seen } = fakeProvider();
  const writes = [];
  const bucket = { async put(...args) { writes.push(args); return { etag: 'test' }; } };
  const summary = await collectShadow({ bucket, fetcher, now: NOW, scheduledAt: NOW, paceMs: 0 });
  assert.equal(summary.target_count, 5);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], 'shadow/latest.json');
  const snapshot = JSON.parse(writes[0][1]);
  assert.equal(snapshot.target_count, 5);
  assert.ok(snapshot.payloads['resultsTable/4249']);
  assert.ok(seen.every(url => !url.includes('resultsTable/3')));
  assert.equal(writes[0][2].httpMetadata.contentType, 'application/json');
  assert.equal(worker.fetch().status, 404);
});

test('one failed provider request leaves the previous R2 snapshot untouched', async () => {
  const { fetcher } = fakeProvider(miniFeed, 'resultsTable/4249');
  let writes = 0;
  await assert.rejects(() => collectShadow({
    bucket: { async put() { writes++; } }, fetcher, now: NOW, paceMs: 0,
  }), /HTTP 503/);
  assert.equal(writes, 0);
});

test('an unfamiliar provider results panel never replaces the snapshot', async () => {
  const { fetcher: base } = fakeProvider();
  let writes = 0;
  const fetcher = (input, init) => String(input).endsWith('resultsTable/4249')
    ? Response.json({ success: true, html: '<div>Different markup</div>' })
    : base(input, init);
  await assert.rejects(() => collectShadow({
    bucket: { async put() { writes++; } }, fetcher, now: NOW, paceMs: 0,
  }), /missing results or standings panel/);
  assert.equal(writes, 0);
});

test('rejects a restricted age score before requesting provider pages', async () => {
  const unsafe = structuredClone(miniFeed);
  unsafe.age_groups[0].age_group = 'Under 9';
  unsafe.age_groups[0].published_results = [{ homeGoals: 1 }];
  const { fetcher, seen } = fakeProvider(unsafe);
  let writes = 0;
  await assert.rejects(() => collectShadow({
    bucket: { async put() { writes++; } }, fetcher, now: NOW, paceMs: 0,
  }), /Restricted age group/);
  assert.deepEqual(seen, [FEED_URL]);
  assert.equal(writes, 0);
});

test('an old target list does not run a shadow scrape', async () => {
  assert.throws(() => targetsFromFeed(miniFeed, NOW + 49 * 60 * 60_000),
    /stale or has an invalid timestamp/);
});

test('current published feed fits the paid pilot target guard', async () => {
  const url = new URL('../../../data/results.json', import.meta.url);
  const feed = JSON.parse(await readFile(url, 'utf8'));
  const paths = targetsFromFeed(feed, Date.parse(feed.last_updated) + 60_000);
  assert.ok(paths.length > 50 && paths.length < 400);
  assert.ok(paths.includes('resultsTable/4249'));
  assert.ok(paths.every(path => !path.startsWith('resultsTable/') ||
    /^resultsTable\/\d+$/.test(path)));
});
