// Shadow-only Selkent collector. The GitHub JSON remains the public authority.
// This Worker has no public route; its R2 bucket must remain private.
import { fixturePreview } from './fixtures.mjs';
import { publishedResultsPreview } from './published-results.mjs';
import { standingsPreview } from './standings.mjs';
export const FEED_URL = 'https://raw.githubusercontent.com/michaeljbriggs86-ctrl/Grassroots-Club-Hub/main/data/results.json';
const SELKENT_BASE = 'https://www.selkent.org.uk/public/';
const RESTRICTED = new Set(['U7', 'U8', 'U8X', 'U9', 'U10', 'U10X', 'U11']);
const MAX_PROVIDER_BYTES = 256_000;
const MAX_FEED_BYTES = 8_000_000;
const MAX_TARGETS = 400;
const FETCH_CONCURRENCY = 3;
const MIN_START_GAP_MS = 350;

function ageCode(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase().replace(/^UNDER/, 'U');
}

function validId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function assertFeed(feed, now) {
  if (feed?.schema_version !== 2 || feed.provider !== 'Selkent' ||
      !Array.isArray(feed.age_groups) || feed.age_groups.length < 1 ||
      feed.age_groups.length > 30) {
    throw new Error('Invalid canonical feed contract');
  }
  const updated = Date.parse(feed.last_updated);
  if (!Number.isFinite(updated) || updated > now + 5 * 60_000 ||
      now - updated > 48 * 60 * 60_000) {
    throw new Error('Canonical feed is stale or has an invalid timestamp');
  }
  for (const age of feed.age_groups) {
    if (!validId(age.agegroup_id) || !Array.isArray(age.fixture_week_ids)) {
      throw new Error('Invalid age group or fixture weeks');
    }
    if (RESTRICTED.has(ageCode(age.age_group))) {
      if (age.standings !== null || age.published_results != null ||
          age.published_results_status !== 'not_publicly_published') {
        throw new Error('Restricted age group contains public results');
      }
      if ((age.fixtures || []).some(row =>
        Object.keys(row).some(key => /score|goal|result|point|table/i.test(key)))) {
        throw new Error('Restricted fixture contains result fields');
      }
    }
  }
}

export function targetsFromFeed(feed, now = Date.now()) {
  assertFeed(feed, now);
  const paths = new Set();
  for (const age of feed.age_groups) {
    paths.add(`fixturespage/${age.agegroup_id}`);
    for (const week of age.fixture_week_ids) {
      if (!validId(week)) throw new Error('Invalid fixture week ID');
      paths.add(`fixturespage/${age.agegroup_id}/${week}`);
    }
    if (age.standings === null) continue;
    if (!Array.isArray(age.standings) || RESTRICTED.has(ageCode(age.age_group))) {
      throw new Error('Unexpected public standings age group');
    }
    for (const table of age.standings) {
      if (!validId(table.provider_division_id)) {
        throw new Error('Invalid division ID');
      }
      paths.add(`resultsTable/${table.provider_division_id}`);
    }
  }
  if (paths.size > MAX_TARGETS) throw new Error('Target count exceeds pilot limit');
  return [...paths];
}

async function readBounded(response, limit, label) {
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) {
    throw new Error(`${label}: response exceeds limit`);
  }
  const body = await response.text();
  if (body.length > limit) throw new Error(`${label}: response exceeds limit`);
  return body;
}

function verifyProviderHtml(path, html) {
  if (path.startsWith('fixturespage/')) {
    if (!/id=["']fixtureContainer["']/.test(html)) {
      throw new Error(`${path}: missing fixture container`);
    }
  } else {
    const id = path.split('/')[1];
    if (!html.includes(`id="results-${id}"`) || !html.includes('<table')) {
      throw new Error(`${path}: missing results or standings panel`);
    }
  }
}

export async function collectShadow({ bucket, fetcher = fetch, now = Date.now(),
                                      scheduledAt = now, paceMs = MIN_START_GAP_MS,
                                      normalizeFixtures = fixturePreview,
                                      normalizeResults = publishedResultsPreview,
                                      normalizeStandings = standingsPreview }) {
  if (!bucket?.put) throw new Error('Private R2 shadow binding is unavailable');
  const feedResponse = await fetcher(FEED_URL, {
    headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000),
  });
  const feed = JSON.parse(await readBounded(feedResponse, MAX_FEED_BYTES, 'canonical feed'));
  const paths = targetsFromFeed(feed, now);
  const payloads = {};
  let cursor = 0;
  let nextStart = 0;
  let failed = false;
  let firstError;

  async function worker() {
    while (!failed && cursor < paths.length) {
      const path = paths[cursor++];
      const wait = Math.max(0, nextStart - Date.now());
      nextStart = Math.max(nextStart, Date.now()) + paceMs;
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      if (failed) break;
      try {
        const response = await fetcher(new URL(path, SELKENT_BASE), {
          headers: { Accept: 'application/json', 'User-Agent': 'PitchKind-Public-Feed-Shadow/1' },
          signal: AbortSignal.timeout(20_000),
        });
        const data = JSON.parse(await readBounded(response, MAX_PROVIDER_BYTES, path));
        if (data?.success !== true || typeof data.html !== 'string') {
          throw new Error(`${path}: invalid provider JSON contract`);
        }
        verifyProviderHtml(path, data.html);
        payloads[path] = data.html;
      } catch (error) {
        failed = true;
        firstError ||= error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, paths.length) }, worker));
  if (firstError) throw firstError;
  if (Object.keys(payloads).length !== paths.length) {
    throw new Error('Incomplete shadow collection');
  }
  // Normalize in the Worker, privately; keep the public feed as the authority.
  const fixture_preview = await normalizeFixtures(payloads, feed);
  const published_results_preview = await normalizeResults(payloads, feed);
  const standings_preview = await normalizeStandings(payloads, feed);
  const snapshot = {
    schema: 'pitchkind-selkent-shadow-v1',
    scheduled_at: new Date(scheduledAt).toISOString(),
    collected_at: new Date().toISOString(),
    canonical_feed_last_updated: feed.last_updated,
    target_count: paths.length,
    fixture_preview,
    published_results_preview,
    standings_preview,
    payloads,
  };
  // One private overwrite only after every public target succeeds; no app route reads it.
  const written = await bucket.put('shadow/latest.json', JSON.stringify(snapshot), {
    httpMetadata: { contentType: 'application/json' },
  });
  if (!written) throw new Error('R2 shadow snapshot write failed');
  return { target_count: paths.length, feed_last_updated: feed.last_updated };
}

export default {
  // No public status or data route, even if a hostname is attached accidentally.
  fetch() { return new Response('Not found', { status: 404 }); },
  async scheduled(controller, env) {
    const summary = await collectShadow({
      bucket: env.SHADOW_SNAPSHOTS, scheduledAt: controller.scheduledTime,
    });
    console.log(JSON.stringify({ event: 'selkent-shadow-collected', ...summary }));
  },
};
