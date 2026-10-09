import { ageNumber } from './normalise.ts';

interface AgeEntry {
  age_group?: string;
  standings?: unknown[] | null;
  published_results?: unknown[] | null;
}

export class FeedPrivacyError extends Error {}

/**
 * ARCHITECTURE.md section 7: U7 to U11 public scores, results and tables are
 * prohibited. A feed that carries them must be rejected, never displayed.
 */
export function assertNoYouthPublicResults(feed: { age_groups?: AgeEntry[] }): void {
  for (const a of feed.age_groups ?? []) {
    const n = ageNumber(String(a.age_group ?? ''));
    if (n === 0 || n > 11) continue;
    const hasStandings = Array.isArray(a.standings) && a.standings.length > 0;
    const hasResults = Array.isArray(a.published_results) && a.published_results.length > 0;
    if (hasStandings || hasResults) throw new FeedPrivacyError(`${a.age_group}: youth public results or standings present`);
  }
}
