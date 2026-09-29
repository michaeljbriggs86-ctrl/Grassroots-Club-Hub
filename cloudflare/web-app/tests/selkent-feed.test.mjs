import assert from 'node:assert/strict';
import test from 'node:test';
import { selkentFeed } from '../src/selkent-feed.js';
import worker from '../src/index.js';

const path = 'https://test.pitchkind.com/data/results.json';
const now = Date.parse('2026-09-29T14:00:00Z');
const github = { schema_version: 2, provider: 'Selkent',
  last_updated: '2026-09-29T12:06:00Z', age_groups: [
    { age_group: 'U9', fixtures: [{ date: '2026-09-30', home: 'A', away: 'B' }],
      standings: null, published_results: null,
      published_results_status: 'not_publicly_published' },
    { age_group: 'U12', fixtures: [], standings: [], published_results: [] },
  ] };
const candidate = { ...github, last_updated: '2026-09-29T12:16:00Z',
  age_groups: structuredClone(github.age_groups) };
const env = {
  SELKENT_FEED_R2_ENABLED: 'true',
  SELKENT_CANDIDATE: { get: async () => ({ json: async () => candidate }) },
  ASSETS: { fetch: async () => Response.json(github) },
};
const fetchGithub = async () => Response.json(github);

test('serves exact verified R2 content with an explicit private cache policy', async () => {
  const response = await selkentFeed(new Request(path), env, now, fetchGithub);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-PitchKind-Feed-Source'), 'r2');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await response.json(), candidate);
  const head = await selkentFeed(new Request(path, { method: 'HEAD' }), env, now, fetchGithub);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('chooses current GitHub feed after provider changes or stale R2', async () => {
  const newer = structuredClone(github);
  newer.age_groups[1].published_results = [{ homeGoals: 2, awayGoals: 1 }];
  const changed = await selkentFeed(new Request(path), env, now,
    async () => Response.json(newer));
  assert.equal(changed.headers.get('X-PitchKind-Feed-Source'), 'github');
  assert.deepEqual(await changed.json(), newer);

  const stale = structuredClone(candidate);
  stale.last_updated = '2026-09-28T12:16:00Z';
  const response = await selkentFeed(new Request(path), { ...env,
    SELKENT_CANDIDATE: { get: async () => ({ json: async () => stale }) },
  }, now, fetchGithub);
  assert.equal(response.headers.get('X-PitchKind-Feed-Source'), 'github');
});

test('uses validated R2 during a GitHub outage, then bundled fallback', async () => {
  const githubDown = async () => { throw new Error('unavailable'); };
  const r2 = await selkentFeed(new Request(path), env, now, githubDown);
  assert.equal(r2.headers.get('X-PitchKind-Feed-Source'), 'r2');
  const bundled = await selkentFeed(new Request(path), { ...env,
    SELKENT_CANDIDATE: { get: async () => null },
  }, now, githubDown);
  assert.equal(bundled.headers.get('X-PitchKind-Feed-Source'), 'bundled');
  const head = await selkentFeed(new Request(path, { method: 'HEAD' }), { ...env,
    SELKENT_CANDIDATE: { get: async () => null },
  }, now, githubDown);
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('X-PitchKind-Feed-Source'), 'bundled');
  assert.equal(await head.text(), '');
});

test('rejects restricted results in every source and fails closed', async () => {
  const unsafe = structuredClone(candidate);
  unsafe.age_groups[0].published_results = [{ homeGoals: 1 }];
  const bad = { ...env,
    SELKENT_CANDIDATE: { get: async () => ({ json: async () => unsafe }) },
    ASSETS: { fetch: async () => Response.json(unsafe) },
  };
  const unavailable = await selkentFeed(new Request(path), bad, now,
    async () => Response.json(unsafe));
  assert.equal(unavailable.status, 503);
  assert.equal(JSON.stringify(await unavailable.json()).includes('homeGoals'), false);
});

test('disabled switch preserves the packaged feed; route limits host and method', async () => {
  const asset = new Response('packaged', { headers: { 'X-Asset': 'yes' } });
  const disabled = { ...env, SELKENT_FEED_R2_ENABLED: 'false',
    ASSETS: { fetch: async () => asset } };
  const response = await worker.fetch(new Request(path), disabled);
  assert.equal(response.headers.get('X-Asset'), 'yes');
  assert.equal(await response.text(), 'packaged');
  assert.equal((await selkentFeed(new Request(path.replace('test.pitchkind.com',
    'pitchkind.com')), env, now, fetchGithub)).status, 404);
  assert.equal((await selkentFeed(new Request(path, { method: 'POST' }),
    env, now, fetchGithub)).status, 405);
});
