import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pilotBadge } from '../src/pilot-badges.js';

const bytes = new Uint8Array([137, 80, 78, 71]);
const hash = createHash('sha256').update(bytes).digest('hex');
const path = `https://test.pitchkind.com/__pilot_badges/250/${hash}`;
const directory = { pilot_badges_revision: 'current', clubs: [
  { club_id: 250, club_name: 'Cray Wanderers', logo_status: 'pilot_verified', logo_sha256: hash },
] };
const env = {
  ASSETS: { fetch: async () => Response.json(directory) },
  PILOT_BADGES: { get: async key => key === `250/${hash}` ?
    { arrayBuffer: async () => bytes.buffer, httpMetadata: { contentType: 'image/png' } } : null },
};

test('serves only the approved ID and exact hash on the protected pilot host', async () => {
  const response = await pilotBadge(new Request(path), env);
  assert.equal(response.status, 200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  for (const bad of [path.replace('/250/', '/251/'), path.replace(hash, 'b'.repeat(64)),
    path.replace('test.pitchkind.com', 'pitchkind.com'), path.replace('https:', 'http:')]) {
    assert.equal((await pilotBadge(new Request(bad), env)).status, 404);
  }
  assert.equal((await pilotBadge(new Request(path), {
    ...env, ASSETS: { fetch: async () => Response.json({ ...directory, clubs: [] }) },
  })).status, 404);
});

test('revocation and unavailable storage fail closed', async () => {
  const revoked = { ...directory, clubs: [{ ...directory.clubs[0], logo_status: 'deprecated' }] };
  assert.equal((await pilotBadge(new Request(path), {
    ...env, ASSETS: { fetch: async () => Response.json(revoked) },
  })).status, 404);
  assert.equal((await pilotBadge(new Request(path), { ...env, PILOT_BADGES: undefined })).status, 503);
  assert.equal((await pilotBadge(new Request(path), {
    ...env, PILOT_BADGES: { get: async () => null },
  })).status, 404);
  assert.equal((await pilotBadge(new Request(path), {
    ...env, PILOT_BADGES: { get: async () => ({
      arrayBuffer: async () => new Uint8Array([0]).buffer,
      httpMetadata: { contentType: 'image/png' },
    }) },
  })).status, 502);
  assert.equal((await pilotBadge(new Request(path, { method: 'POST' }), env)).status, 405);
});
