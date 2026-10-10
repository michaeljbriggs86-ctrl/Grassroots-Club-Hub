import { norm, teamLabel } from './normalise.ts';
import type { CupGroup, TeamFixture } from './types.ts';

const CUP_OR_VASE = /\b(?:cup|vase)\b/i;

/**
 * A mini Cup group applies only to U8 to U11: one matchday event holding exactly
 * two games on the same date and competition. Older ages play single ties.
 */
export function miniCupGroup(f: TeamFixture, all: TeamFixture[], ageNumber: number): CupGroup | null {
  if (!f.date || ageNumber > 11 || ageNumber < 8 || !CUP_OR_VASE.test(String(f.competition || ''))) return null;
  const competition = norm(f.competition);
  const rows = all
    .filter((r) => r.date === f.date && norm(r.competition) === competition && r.opponent)
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const byOpponent = new Map<string, TeamFixture>();
  for (const r of rows) if (!byOpponent.has(norm(r.opponent))) byOpponent.set(norm(r.opponent), r);
  if (byOpponent.size !== 2) return null;
  const [a, b] = [...byOpponent.values()] as [TeamFixture, TeamFixture];
  return {
    key: `${f.date}|cup-group|${competition}`,
    date: f.date,
    competition: a.competition,
    fixtures: [a, b],
    opponents: [teamLabel(a.opponent), teamLabel(b.opponent)],
  };
}

function sortKey(r: TeamFixture): string {
  return `${norm(r.opponent)}|${r.venue || ''}|${r.providerTeamIds.join(',')}`;
}
