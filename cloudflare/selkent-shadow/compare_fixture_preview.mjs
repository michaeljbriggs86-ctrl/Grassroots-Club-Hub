// Compare Worker-normalized private fixtures with the versioned public feed.
// Do not log provider HTML, fixture names or individual match details.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function compareFixturePreview(snapshot, feed) {
  if (!snapshot.fixture_preview) {
    return { event: 'selkent-worker-fixtures', status: 'pending_new_collection' };
  }
  if (snapshot.schema !== 'pitchkind-selkent-shadow-v1' ||
      feed.schema_version !== 2 || feed.provider !== 'Selkent') {
    throw new Error('Unexpected snapshot or public feed contract');
  }
  const preview = snapshot.fixture_preview;
  if (Object.keys(preview).length !== feed.age_groups.length) {
    throw new Error('Incomplete private fixture preview');
  }
  let fixtureCount = 0;
  let differentAgeGroups = 0;
  let differentWeeks = 0;
  let differentStatuses = 0;
  const sameVersion = snapshot.canonical_feed_last_updated === feed.last_updated;
  for (const age of feed.age_groups) {
    const parsed = preview[age.agegroup_id];
    if (!parsed || !Array.isArray(parsed.fixtures) ||
        !Array.isArray(parsed.discovered_week_ids) ||
        typeof parsed.fixture_parse_status !== 'string') {
      throw new Error('Invalid private fixture preview');
    }
    fixtureCount += parsed.fixtures.length;
    if (sameVersion) {
      if (JSON.stringify(parsed.discovered_week_ids) !== JSON.stringify(age.fixture_week_ids)) differentWeeks++;
      if (JSON.stringify(parsed.fixtures) !== JSON.stringify(age.fixtures)) differentAgeGroups++;
      if (parsed.fixture_parse_status !== age.fixture_parse_status) differentStatuses++;
    }
  }
  return {
    event: 'selkent-worker-fixtures',
    status: !sameVersion ? 'deferred_feed_version_differs' :
      differentAgeGroups || differentWeeks || differentStatuses ? 'drift' : 'exact',
    age_groups: feed.age_groups.length,
    fixtures: fixtureCount,
    different_age_groups: differentAgeGroups,
    different_week_lists: differentWeeks,
    different_statuses: differentStatuses,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 4) throw new Error('Usage: compare_fixture_preview.mjs SNAPSHOT FEED');
  const [snapshot, feed] = await Promise.all(process.argv.slice(2).map(path =>
    readFile(path, 'utf8').then(JSON.parse)));
  console.log(JSON.stringify(compareFixturePreview(snapshot, feed)));
}
