// Metadata-only comparison of a private R2 staging object and the packaged feed.
const HOST = 'test.pitchkind.com';
const RESTRICTED = new Set(['U7', 'U8', 'U8X', 'U9', 'U10', 'U10X', 'U11']);
const MAX_AGE_MS = 18 * 60 * 60_000;
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex',
};

function response(status, data) {
  return new Response(JSON.stringify(data), { status, headers });
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function count(ageGroups) {
  return {
    age_groups: ageGroups.length,
    fixtures: ageGroups.reduce((sum, age) => sum + age.fixtures.length, 0),
    published_results: ageGroups.reduce((sum, age) => sum + (age.published_results?.length || 0), 0),
    standings_rows: ageGroups.reduce((sum, age) => sum +
      (age.standings || []).reduce((rows, table) => rows + table.rows.length, 0), 0),
  };
}

export async function selkentCandidate(request, env, now = Date.now()) {
  const url = new URL(request.url);
  if (url.protocol !== 'https:' || url.hostname !== HOST || url.pathname !== '/__selkent_candidate') {
    return response(404, { status: 'not_found' });
  }
  if (request.method !== 'GET') return response(405, { status: 'method_not_allowed' });
  if (!env.SELKENT_CANDIDATE?.get || !env.SELKENT_CANDIDATE_KEY || !env.ASSETS?.fetch) {
    return response(503, { status: 'unavailable' });
  }
  try {
    const [object, asset] = await Promise.all([
      env.SELKENT_CANDIDATE.get(env.SELKENT_CANDIDATE_KEY),
      env.ASSETS.fetch(new Request(new URL('/data/results.json', url))),
    ]);
    if (!object || !asset.ok) throw new Error('Candidate or feed unavailable');
    const [candidate, current] = await Promise.all([object.json(), asset.json()]);
    if (candidate?.schema_version !== 2 || current?.schema_version !== 2 ||
        candidate.provider !== 'Selkent' || current.provider !== 'Selkent' ||
        !Array.isArray(candidate.age_groups) || !Array.isArray(current.age_groups) ||
        candidate.age_groups.length !== current.age_groups.length ||
        !candidate.age_groups.length) throw new Error('Invalid feed contract');
    const updated = Date.parse(candidate.last_updated);
    if (!Number.isFinite(updated) || updated > now + 5 * 60_000 || now - updated > MAX_AGE_MS) {
      return response(503, { status: 'stale', candidate_last_updated: candidate.last_updated });
    }
    for (const age of candidate.age_groups) {
      if (!Array.isArray(age.fixtures) ||
          (RESTRICTED.has(String(age.age_group).replace(/\s+/gu, '').toUpperCase()) &&
            (age.standings !== null || age.published_results !== null))) {
        throw new Error('Unsafe candidate age group');
      }
    }
    const differences = candidate.age_groups.reduce((total, age, index) =>
      total + Number(JSON.stringify(canonical(age)) !==
        JSON.stringify(canonical(current.age_groups[index]))), 0);
    const rootMatches = Object.keys(current).every(key => key === 'last_updated' ||
      key === 'age_groups' || JSON.stringify(canonical(candidate[key])) ===
        JSON.stringify(canonical(current[key]))) &&
      Object.keys(candidate).length === Object.keys(current).length;
    const exact = rootMatches && differences === 0;
    return response(exact ? 200 : 409, {
      status: exact ? 'exact' : 'drift', candidate_last_updated: candidate.last_updated,
      current_last_updated: current.last_updated, different_age_groups: differences,
      root_matches: rootMatches, counts: count(candidate.age_groups),
    });
  } catch {
    return response(503, { status: 'unavailable' });
  }
}
