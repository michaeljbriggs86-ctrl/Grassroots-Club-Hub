// Build a private schema-v2 publication candidate from one collected snapshot.
// This module never writes R2 or serves data to the website.
const RESTRICTED = new Set(['U7', 'U8', 'U8X', 'U9', 'U10', 'U10X', 'U11']);
const FIXTURE_FIELDS = new Set(['date', 'division_name', 'home', 'away', 'provider_team_ids']);

function ageCode(value) {
  return String(value || '').replace(/\s+/gu, '').toUpperCase().replace(/^UNDER/u, 'U');
}

function sameIds(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    left.every((value, index) => Number.isSafeInteger(value) && value > 0 && value === right[index]);
}

function exactKeys(object, expected, label) {
  if (!object || typeof object !== 'object' || Array.isArray(object) ||
      Object.keys(object).length !== expected.length ||
      expected.some(key => !Object.hasOwn(object, key))) {
    throw new Error(`Incomplete private ${label} preview`);
  }
}

export function buildCandidateFeed(snapshot, feed) {
  if (snapshot?.schema !== 'pitchkind-selkent-shadow-v1' ||
      feed?.schema_version !== 2 || feed?.provider !== 'Selkent' ||
      !Array.isArray(feed.age_groups) || !feed.age_groups.length ||
      snapshot.canonical_feed_last_updated !== feed.last_updated) {
    throw new Error('Candidate snapshot and canonical target list do not match');
  }
  const collectedAt = Date.parse(snapshot.collected_at);
  const feedAt = Date.parse(feed.last_updated);
  if (!Number.isFinite(collectedAt) || !Number.isFinite(feedAt) || collectedAt < feedAt) {
    throw new Error('Candidate collection timestamp is invalid');
  }

  const fixtureKeys = feed.age_groups.map(age => String(age.agegroup_id));
  const publicAges = feed.age_groups.filter(age => age.standings !== null);
  const publicKeys = publicAges.map(age => String(age.agegroup_id));
  if (new Set(fixtureKeys).size !== fixtureKeys.length) {
    throw new Error('Duplicate candidate age group ID');
  }
  exactKeys(snapshot.fixture_preview, fixtureKeys, 'fixture');
  exactKeys(snapshot.published_results_preview, publicKeys, 'results');
  exactKeys(snapshot.standings_preview, publicKeys, 'standings');

  const ageGroups = feed.age_groups.map(age => {
    const key = String(age.agegroup_id);
    const fixture = snapshot.fixture_preview[key];
    if (!fixture || !Array.isArray(fixture.fixtures) ||
        !sameIds(fixture.discovered_week_ids, age.fixture_week_ids) ||
        typeof fixture.fixture_parse_status !== 'string') {
      throw new Error(`Candidate fixture coverage is incomplete for age group ${key}`);
    }
    for (const row of fixture.fixtures) {
      if (!row || typeof row !== 'object' || Array.isArray(row) ||
          Object.keys(row).some(field => !FIXTURE_FIELDS.has(field))) {
        throw new Error(`Candidate fixture shape is unsafe for age group ${key}`);
      }
    }
    const entry = {
      ...age,
      fixtures: fixture.fixtures,
      fixture_parse_status: fixture.fixture_parse_status,
      fixture_week_ids: fixture.discovered_week_ids,
    };
    if (age.standings === null) {
      if (age.published_results !== null ||
          age.published_results_status !== 'not_publicly_published') {
        throw new Error(`Restricted candidate result fields for age group ${key}`);
      }
      entry.standings = null;
      entry.published_results = null;
      return entry;
    }
    if (RESTRICTED.has(ageCode(age.age_group)) || !Array.isArray(age.standings)) {
      throw new Error(`Unexpected public results age group ${key}`);
    }
    const standings = snapshot.standings_preview[key];
    const results = snapshot.published_results_preview[key];
    if (!Array.isArray(standings) || !Array.isArray(results) ||
        standings.length !== age.standings.length ||
        standings.some((table, index) =>
          table?.provider_division_id !== age.standings[index]?.provider_division_id)) {
      throw new Error(`Candidate results coverage is incomplete for age group ${key}`);
    }
    entry.standings = standings;
    entry.published_results = results;
    entry.published_results_status = 'verified_scored_rows_v1';
    return entry;
  });

  return {
    ...feed,
    last_updated: snapshot.collected_at,
    age_groups: ageGroups,
  };
}
