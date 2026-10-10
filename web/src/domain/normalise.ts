/** Normalise a team or competition name for comparison. Matches the legacy selkentNorm. */
export function norm(value: string = ''): string {
  return String(value)
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Tidy a provider team name for display (underscores and repeated spaces). */
export function teamLabel(name: string = ''): string {
  return String(name || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface AgeGroup {
  age: number;
  /** True for an "X" team: older, larger squad sizes used before Future Fit (e.g. U9X is 7v7, U9 is 5v5). */
  legacyFormat: boolean;
}

/**
 * Parse "U9", "Under 10" or "U10X". age is 0 when absent.
 * DELIBERATE DIFFERENCE from the legacy ageGroupNumber(): the legacy regex has no
 * word boundary between the digit and a trailing X, so "U10X" read as 0 and X teams
 * silently escaped Cup grouping and youth privacy checks. Mike confirmed 9 Oct 2026
 * that X means pre-Future-Fit squad sizes, so X teams are the same age band (U12X is a published-results group, Mike 10 Oct 2026).
 */
export function parseAgeGroup(text: string): AgeGroup {
  const m = String(text).match(/(?:\bU\s*|\bUnder\s*)(\d{1,2})(X?)\b/i);
  if (!m || !m[1]) return { age: 0, legacyFormat: false };
  const age = Number(m[1]);
  const legacyFormat = m[2] !== '';
  return { age, legacyFormat };
}

export function ageNumber(text: string): number {
  return parseAgeGroup(text).age;
}
