import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { targetsFromFeed } from './src/index.mjs';

const MAX_AGE_MS = 2 * 60 * 60_000;
const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const MAX_TARGETS = 400;
const MAX_HTML_LENGTH = 256_000;

function timestamp(value, name, now) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed > now + MAX_CLOCK_SKEW_MS) {
    throw new Error(`${name} is invalid or in the future`);
  }
  return parsed;
}

export function verifySnapshot(snapshot, currentFeed, now = Date.now()) {
  if (snapshot?.schema !== 'pitchkind-selkent-shadow-v1' ||
      !snapshot.payloads || typeof snapshot.payloads !== 'object' ||
      Array.isArray(snapshot.payloads)) {
    throw new Error('Invalid private shadow snapshot contract');
  }
  const collectedAt = timestamp(snapshot.collected_at, 'collected_at', now);
  const scheduledAt = timestamp(snapshot.scheduled_at, 'scheduled_at', now);
  timestamp(snapshot.canonical_feed_last_updated, 'canonical_feed_last_updated', now);
  if (now - collectedAt > MAX_AGE_MS) {
    // Safe diagnostic metadata only; the snapshot's provider HTML stays private.
    throw new Error(`Private shadow snapshot is stale: collected_at=${snapshot.collected_at}, ` +
      `scheduled_at=${snapshot.scheduled_at}, age_minutes=${Math.floor((now - collectedAt) / 60_000)}, ` +
      `max_age_minutes=${MAX_AGE_MS / 60_000}`);
  }
  if (collectedAt + MAX_CLOCK_SKEW_MS < scheduledAt) {
    throw new Error('Private shadow snapshot predates its scheduled event');
  }

  const paths = Object.keys(snapshot.payloads);
  if (!Number.isSafeInteger(snapshot.target_count) || snapshot.target_count < 1 ||
      snapshot.target_count > MAX_TARGETS || paths.length !== snapshot.target_count) {
    throw new Error('Private shadow target count is incomplete');
  }
  let fixtureCount = 0;
  let resultsTableCount = 0;
  for (const path of paths) {
    const html = snapshot.payloads[path];
    if (typeof html !== 'string' || html.length > MAX_HTML_LENGTH) {
      throw new Error('Invalid private shadow payload');
    }
    if (/^fixturespage\/[1-9]\d*(?:\/[1-9]\d*)?$/.test(path)) {
      fixtureCount++;
      if (!/id=["']fixtureContainer["']/.test(html)) {
        throw new Error('Private shadow fixture payload has changed shape');
      }
    } else if (/^resultsTable\/[1-9]\d*$/.test(path)) {
      resultsTableCount++;
      if (!html.includes(`id="results-${path.split('/')[1]}"`) ||
          !html.includes('<table')) {
        throw new Error('Private shadow results payload has changed shape');
      }
    } else {
      throw new Error('Unexpected private shadow target path');
    }
  }
  if (!fixtureCount || !resultsTableCount) {
    throw new Error('Private shadow is missing fixtures or public results tables');
  }

  // Sunday feed updates can follow a shadow run by ten minutes. Only compare
  // target lists when both are demonstrably from the same canonical feed.
  const expected = targetsFromFeed(currentFeed, now);
  let feedTargetMatch = 'deferred_feed_version_differs';
  if (currentFeed?.last_updated === snapshot.canonical_feed_last_updated) {
    if (expected.length !== paths.length ||
        expected.some(path => !Object.hasOwn(snapshot.payloads, path))) {
      throw new Error('Private shadow targets differ from the matching public feed');
    }
    feedTargetMatch = 'verified';
  }
  return {
    event: 'selkent-shadow-verified',
    collected_at: snapshot.collected_at,
    scheduled_at: snapshot.scheduled_at,
    snapshot_age_minutes: Math.round((now - collectedAt) / 60_000),
    canonical_feed_last_updated: snapshot.canonical_feed_last_updated,
    target_count: paths.length,
    fixture_count: fixtureCount,
    results_table_count: resultsTableCount,
    feed_target_match: feedTargetMatch,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 4) {
    throw new Error('Usage: node verify-snapshot.mjs SNAPSHOT_PATH PUBLIC_FEED_PATH');
  }
  const [snapshot, feed] = await Promise.all([
    readFile(process.argv[2], 'utf8').then(JSON.parse),
    readFile(process.argv[3], 'utf8').then(JSON.parse),
  ]);
  // Never print private HTML or store the raw snapshot as a CI artifact.
  console.log(JSON.stringify(verifySnapshot(snapshot, feed)));
}
