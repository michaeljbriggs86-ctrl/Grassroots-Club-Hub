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
  assert.throws(() => verifySnapshot(value, FEED, NOW), error => {
    assert.match(error.message, /snapshot is stale/);
    assert.match(error.message, /collected_at=2026-09-27T12:59:00Z/);
    assert.match(error.message, /scheduled_at=2026-09-27T14:30:00Z/);
    assert.match(error.message, /age_minutes=121/);
    assert.match(error.message, /max_age_minutes=120/);
    assert.ok(!error.message.includes('fixtureContainer'));
    return true;
  });
});

test('allows an on-demand comparison between six-hour collections', () => {
  const value = snapshot();
  value.collected_at = '2026-09-27T11:00:00Z';
  value.scheduled_at = '2026-09-27T10:59:00Z';
  assert.throws(() => verifySnapshot(value, FEED, NOW), /snapshot is stale/);
  assert.equal(verifySnapshot(value, FEED, NOW, 420).feed_target_match, 'verified');
  assert.throws(() => verifySnapshot(value, FEED, NOW, 421), /Unsupported/);
});

test('delayed six-hour checks accept the last collection but reject a missed cycle', () => {
  const value = snapshot();
  value.collected_at = '2026-09-27T08:00:00Z';
  value.scheduled_at = '2026-09-27T07:59:00Z';
  assert.equal(verifySnapshot(value, FEED, NOW, 420).snapshot_age_minutes, 420);
  assert.throws(() => verifySnapshot(value, FEED, NOW + 1, 420), /snapshot is stale/);
  // The Sunday matchday check keeps its existing two-hour limit.
  assert.throws(() => verifySnapshot(value, FEED, NOW, 120), /snapshot is stale/);
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

// Exercise the CI output contract, including the invalid-snapshot fail-closed path.
test('CI defers only a validated version mismatch and never emits readiness for invalid snapshots', async () => {
  const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const dir = await mkdtemp(join(tmpdir(), 'selkent-readiness-'));
  try {
    const now = Date.now(), feed = structuredClone(FEED), value = snapshot();
    feed.last_updated = new Date(now - 60_000).toISOString();
    value.canonical_feed_last_updated = feed.last_updated;
    value.collected_at = value.scheduled_at = new Date(now).toISOString();
    const run = async () => {
      const output = join(dir, 'output'), summary = join(dir, 'summary');
      await writeFile(join(dir, 'snapshot.json'), JSON.stringify(value));
      await writeFile(join(dir, 'feed.json'), JSON.stringify(feed));
      await writeFile(output, ''); await writeFile(summary, '');
      const result = spawnSync(process.execPath, ['cloudflare/selkent-shadow/verify-snapshot.mjs',
        join(dir, 'snapshot.json'), join(dir, 'feed.json'), '420'], {
        encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
      });
      return { ...result, output: await readFile(output, 'utf8'), summary: await readFile(summary, 'utf8') };
    };
    let result = await run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'candidate_ready=true\n');
    feed.last_updated = new Date(now - 30_000).toISOString();
    result = await run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'candidate_ready=false\n');
    assert.match(result.summary, /deferred/);
    assert.match(result.summary, /existing R2 feed is retained/);
    value.collected_at = new Date(now - 421 * 60_000).toISOString();
    result = await run();
    assert.notEqual(result.status, 0);
    assert.equal(result.output, '');
    value.collected_at = new Date(now).toISOString();
    delete value.payloads[Object.keys(value.payloads)[0]];
    result = await run();
    assert.notEqual(result.status, 0);
    assert.equal(result.output, '');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
