// Access-protected Selkent feed route. The R2 source is activated only after
// scheduled publication checks; GitHub remains the current public authority.
const HOST = 'test.pitchkind.com';
const GITHUB_FEED = 'https://raw.githubusercontent.com/michaeljbriggs86-ctrl/Grassroots-Club-Hub/main/data/results.json';
const R2_KEY = 'feed/results.json';
const MAX_AGE_MS = 18 * 60 * 60_000;
const RESTRICTED = new Set(['U7', 'U8', 'U8X', 'U9', 'U10', 'U10X', 'U11']);
const FIXTURE_FIELDS = new Set(['date', 'division_name', 'home', 'away', 'provider_team_ids']);
const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex',
};

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function validateFeed(feed, now, requireFresh = true) {
  if (feed?.schema_version !== 2 || feed.provider !== 'Selkent' ||
      !Array.isArray(feed.age_groups) || !feed.age_groups.length) {
    throw new Error('Invalid Selkent feed contract');
  }
  const updated = Date.parse(feed.last_updated);
  if (!Number.isFinite(updated) || updated > now + 5 * 60_000 ||
      (requireFresh && now - updated > MAX_AGE_MS)) {
    throw new Error('Invalid or stale Selkent feed timestamp');
  }
  for (const age of feed.age_groups) {
    if (!Array.isArray(age.fixtures) ||
        (age.standings !== null && !Array.isArray(age.standings)) ||
        (age.published_results !== null && !Array.isArray(age.published_results))) {
      throw new Error('Invalid Selkent age group');
    }
    if (!RESTRICTED.has(String(age.age_group).replace(/\s+/gu, '').toUpperCase())) continue;
    if (age.standings !== null || age.published_results !== null ||
        age.results != null || age.published_results_status !== 'not_publicly_published' ||
        age.fixtures.some(fixture => !fixture || typeof fixture !== 'object' ||
          Object.keys(fixture).some(key => !FIXTURE_FIELDS.has(key)))) {
      throw new Error('Restricted Selkent results are not public');
    }
  }
  return feed;
}

function sameContent(candidate, github) {
  return JSON.stringify(canonical({ ...candidate, last_updated: github.last_updated })) ===
    JSON.stringify(canonical(github));
}

function serve(feed, source, method) {
  return new Response(method === 'HEAD' ? null : JSON.stringify(feed), {
    headers: { ...HEADERS, 'X-PitchKind-Feed-Source': source },
  });
}

async function readR2(env, now) {
  try {
    const object = await env.SELKENT_CANDIDATE?.get(R2_KEY);
    return object ? validateFeed(await object.json(), now) : null;
  } catch { return null; }
}

async function readGithub(remoteFetch, now) {
  try {
    const response = await remoteFetch(GITHUB_FEED, { headers: { Accept: 'application/json' } });
    return response.ok ? validateFeed(await response.json(), now) : null;
  } catch { return null; }
}

async function readBundled(request, env, now) {
  try {
    const response = await env.ASSETS.fetch(new Request(new URL('/data/results.json', request.url)));
    return response.ok ? validateFeed(await response.json(), now, false) : null;
  } catch { return null; }
}

export async function selkentFeed(request, env, now = Date.now(), remoteFetch = fetch) {
  const url = new URL(request.url);
  if (url.protocol !== 'https:' || url.hostname !== HOST || url.pathname !== '/data/results.json') {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: HEADERS });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...HEADERS, Allow: 'GET, HEAD' },
    });
  }
  if (env.SELKENT_FEED_R2_ENABLED !== 'true') return env.ASSETS.fetch(request);
  const [candidate, github] = await Promise.all([readR2(env, now), readGithub(remoteFetch, now)]);
  if (candidate && (!github || sameContent(candidate, github))) {
    return serve(candidate, 'r2', request.method);
  }
  if (github) return serve(github, 'github', request.method);
  const bundled = await readBundled(request, env, now);
  if (bundled) return serve(bundled, 'bundled', request.method);
  return new Response(JSON.stringify({ error: 'Selkent feed unavailable' }), {
    status: 503, headers: HEADERS,
  });
}
