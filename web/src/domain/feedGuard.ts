import { ageNumber } from './normalise.ts';

interface AgeEntry {
  age_group?: string;
  standings?: unknown[] | null;
  published_results?: unknown[] | null;
}

const ADULT_NAME = /\b(senior|seniors|open age|adult|veterans?)\b/i;

export class FeedPrivacyError extends Error {}

/**
 * ARCHITECTURE.md section 7: U7 to U11 public scores, results and tables are
 * prohibited. A feed that carries them must be rejected, never displayed.
 */
export function assertNoYouthPublicResults(feed: { age_groups?: AgeEntry[] }): void {
  for (const a of feed.age_groups ?? []) {
    const n = ageNumber(String(a.age_group ?? ''));
    if (n > 11) continue;
    if (n === 0 && ADULT_NAME.test(String(a.age_group ?? ''))) continue;
    const hasStandings = Array.isArray(a.standings) && a.standings.length > 0;
    const hasResults = Array.isArray(a.published_results) && a.published_results.length > 0;
    // n === 0 means the age could not be read. Fail closed: unreadable group with results is rejected.
    if (hasStandings || hasResults) throw new FeedPrivacyError(`${a.age_group}: youth or unreadable age group with public results or standings`);
  }
}
