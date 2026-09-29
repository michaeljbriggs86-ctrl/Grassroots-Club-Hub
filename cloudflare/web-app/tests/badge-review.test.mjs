import test from 'node:test';
import assert from 'node:assert/strict';
import { badgeReview } from '../src/badge-review.js';

const approved = { club_id: 447, club_name: 'Samuel Montagu', logo_status: 'pilot_verified', logo_sha256: 'a'.repeat(64) };
const directory = { pilot_badges_revision: 'reviewed', clubs: [
  { club_id: 250, club_name: 'Cray Wanderers', logo_status: 'pilot_verified', logo_sha256: 'b'.repeat(64) },
  approved,
  { club_id: 466, club_name: 'Total FC', logo_status: 'held', logo_sha256: 'c'.repeat(64) },
] };
const env = {
  ASSETS: { fetch: async () => Response.json(directory) },
  PILOT_BADGES: { head: async key => ['250/' + 'b'.repeat(64), '447/' + 'a'.repeat(64)].includes(key) ? {} : null },
};
const base = 'https://test.pitchkind.com/__badge_review';

test('direct review shows the actual approved badge at hero and card sizes', async () => {
  const response = await badgeReview(new Request(base + '?club=447&size=foldable&theme=dark'), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.match(response.headers.get('Content-Security-Policy'), /default-src 'none'/);
  const html = await response.text();
  assert.match(html, /Samuel Montagu/);
  assert.match(html, /__pilot_badges\/447\/a{64}/);
  assert.match(html, /width="20" height="20"/);
  assert.match(html, /width="28" height="28"/);
  assert.match(html, /width="56" height="56"/);
  assert.match(html, /width="60" height="60"/);
  assert.match(html, /review-stage foldable dark/);
  assert.doesNotMatch(html, /Total FC|c{64}/);
  assert.doesNotMatch(html, /https:\/\/smyc.co.uk/);
  assert.match(html, /max-width:86px!important/);
});

test('unavailable approved image shows a preparing response instead of broken images', async () => {
  const response = await badgeReview(new Request(base + '?club=447'), {
    ...env, PILOT_BADGES: { head: async () => null },
  });
  assert.equal(response.status, 503);
  assert.match(await response.text(), /still being prepared/);
});

test('review remains confined to the protected host and exact feed approvals', async () => {
  for (const url of [base.replace('test.pitchkind.com', 'pitchkind.com'),
    base.replace('https:', 'http:'), base.replace('__badge_review', '__badge_review/more'),
    base + '?club=466', base + '?club=999']) {
    assert.equal((await badgeReview(new Request(url), env)).status, 404);
  }
  assert.equal((await badgeReview(new Request(base, { method: 'POST' }), env)).status, 405);
  assert.equal((await badgeReview(new Request(base), {
    ASSETS: { fetch: async () => Response.json({ ...directory, pilot_badges_revision: '' }) },
  })).status, 503);
  const injected = { ...approved, club_name: '<img src=x onerror=alert(1)>' };
  const safe = await badgeReview(new Request(base + '?club=447'), {
    ASSETS: { fetch: async () => Response.json({ ...directory, clubs: [injected] }) },
    PILOT_BADGES: env.PILOT_BADGES,
  });
  assert.equal(safe.status, 200);
  assert.doesNotMatch(await safe.text(), /<img src=x onerror=/);
});
