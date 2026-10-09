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

/**
 * Age number from text such as "U9", "Under 10" or "U10X". 0 when absent.
 * DELIBERATE DIFFERENCE from the legacy ageGroupNumber(): the legacy regex has no
 * word boundary between the digit and a trailing X, so "U10X" read as 0. This
 * version reads it as 10. Confirm with Mike before cutover.
 */
export function ageNumber(text: string): number {
  const m = String(text).match(/(?:\bU\s*|\bUnder\s*)(\d{1,2})X?\b/i);
  return m && m[1] ? Number(m[1]) : 0;
}
