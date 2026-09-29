import assert from 'node:assert/strict';
import test from 'node:test';
import { selkentCandidate } from '../src/selkent-candidate.js';

const now = Date.parse('2026-09-29T14:00:00Z');
const path = 'https://test.pitchkind.com/__selkent_candidate';
const ageGroups = [
  { agegroup_id: 3, age_group: 'U9', fixtures: [{ date: '2026-09-30', home: 'A', away: 'B' }],
    published_results: null, standings: null },
  { agegroup_id: 6, age_group: 'U12', fixtures: [], published_results: [
    { date: '2026-09-28', homeGoals: 1, awayGoals: 0 }],
    standings: [{ provider_division_id: 4249, rows: [{ team: 'A', points: 3 }] }] },
];
const current = { schema_version: 2, provider: 'Selkent',
  last_updated: '2026-09-29T12:06:00Z', age_groups: ageGroups };
const candidate = { ...current, last_updated: '2026-09-29T12:16:00Z',
  age_groups: structuredClone(ageGroups) };
const env = {
  SELKENT_CANDIDATE_KEY: 'staging/commit/results.json',
  SELKENT_CANDIDATE: { get: async () => ({ json: async () => candidate }) },
  ASSETS: { fetch: async () => Response.json(current) },
};

test('protected diagnostic reports counts and exact content without match details', async () => {
  const result = await selkentCandidate(new Request(path), env, now);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
  const body = await result.json();
  assert.equal(body.status, 'exact');
  assert.deepEqual(body.counts, { age_groups: 2, fixtures: 1,
    published_results: 1, standings_rows: 1 });
  assert.equal(JSON.stringify(body).includes('homeGoals'), false);
  assert.equal(JSON.stringify(body).includes('"home":"A"'), false);
});

test('mismatch is visible without serving candidate data', async () => {
  const changed = structuredClone(current);
  changed.age_groups[1].published_results = [];
  const result = await selkentCandidate(new Request(path), {
    ...env, ASSETS: { fetch: async () => Response.json(changed) },
  }, now);
  assert.equal(result.status, 409);
  assert.equal((await result.json()).different_age_groups, 1);
});

test('host, method, freshness, restricted scores and storage fail closed', async () => {
  assert.equal((await selkentCandidate(new Request(path.replace('test.pitchkind.com',
    'pitchkind.com')), env, now)).status, 404);
  assert.equal((await selkentCandidate(new Request(path, { method: 'POST' }), env, now)).status, 405);
  assert.equal((await selkentCandidate(new Request(path), env,
    Date.parse('2026-09-30T08:17:00Z'))).status, 503);
  const leaked = structuredClone(candidate);
  leaked.age_groups[0].published_results = [{ homeGoals: 1 }];
  assert.equal((await selkentCandidate(new Request(path), { ...env,
    SELKENT_CANDIDATE: { get: async () => ({ json: async () => leaked }) },
  }, now)).status, 503);
  assert.equal((await selkentCandidate(new Request(path), { ...env,
    SELKENT_CANDIDATE: { get: async () => null },
  }, now)).status, 503);
});
