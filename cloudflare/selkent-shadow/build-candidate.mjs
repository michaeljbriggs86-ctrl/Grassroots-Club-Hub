// CI-only private candidate. The output file stays inside the runner's temp dir.
import { readFile, writeFile } from 'node:fs/promises';
import { buildCandidateFeed } from './src/candidate-feed.mjs';

if (process.argv.length !== 5) {
  throw new Error('Usage: build-candidate.mjs SNAPSHOT FEED OUTPUT');
}
const [snapshot, feed] = await Promise.all([
  readFile(process.argv[2], 'utf8').then(JSON.parse),
  readFile(process.argv[3], 'utf8').then(JSON.parse),
]);
const candidate = buildCandidateFeed(snapshot, feed);
await writeFile(process.argv[4], JSON.stringify(candidate));
console.log(JSON.stringify({
  event: 'selkent-private-candidate-built',
  age_groups: candidate.age_groups.length,
  fixtures: candidate.age_groups.reduce((sum, age) => sum + age.fixtures.length, 0),
  published_results: candidate.age_groups.reduce((sum, age) =>
    sum + (age.published_results?.length || 0), 0),
  standings_rows: candidate.age_groups.reduce((sum, age) => sum +
    (age.standings || []).reduce((rows, table) => rows + table.rows.length, 0), 0),
}));
