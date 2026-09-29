import { isDeepStrictEqual } from 'node:util';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const RESTRICTED = new Set(['U7', 'U8', 'U8X', 'U9', 'U10', 'U10X', 'U11']);

export function verifyPublication(snapshot, feed, candidate, previous = null) {
  if (feed?.schema_version !== 2 || feed.provider !== 'Selkent' ||
      candidate?.schema_version !== 2 || candidate.provider !== 'Selkent' ||
      snapshot?.canonical_feed_last_updated !== feed.last_updated ||
      candidate.last_updated !== snapshot.collected_at ||
      !Number.isFinite(Date.parse(candidate.last_updated))) {
    throw new Error('Private publication source versions are invalid');
  }
  if (!Array.isArray(candidate.age_groups) || candidate.age_groups.length === 0) {
    throw new Error('Private publication candidate has no age groups');
  }
  for (const age of candidate.age_groups) {
    if (RESTRICTED.has(String(age.age_group).toUpperCase().replaceAll(/\s/g, '')) &&
        (age.standings !== null || age.published_results !== null ||
         age.published_results_status !== 'not_publicly_published')) {
      throw new Error('Private publication candidate contains restricted results');
    }
  }
  // The Python parity check in the workflow independently rebuilt this candidate.
  // Only its timestamp may differ from the current, GitHub-published feed.
  if (!isDeepStrictEqual({ ...candidate, last_updated: feed.last_updated }, feed)) {
    throw new Error('Private publication candidate differs from the current public feed');
  }
  if (previous !== null) {
    if (previous?.schema_version !== 2 || previous.provider !== 'Selkent' ||
        !Number.isFinite(Date.parse(previous.last_updated)) ||
        Date.parse(previous.last_updated) > Date.parse(candidate.last_updated)) {
      throw new Error('Private publication would replace a newer or invalid R2 feed');
    }
  }
  return { event: 'selkent-private-publication-gate', status: 'exact',
    collected_at: candidate.last_updated, age_groups: candidate.age_groups.length,
    previous: previous === null ? 'absent' : 'checked' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (![5, 6].includes(process.argv.length)) {
    throw new Error('Usage: node verify-publication.mjs SNAPSHOT FEED CANDIDATE [PREVIOUS]');
  }
  const [snapshot, feed, candidate, previous] = await Promise.all(
    process.argv.slice(2).map(path => readFile(path, 'utf8').then(JSON.parse)));
  console.log(JSON.stringify(verifyPublication(snapshot, feed, candidate, previous ?? null)));
}
