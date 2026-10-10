import { norm } from './normalise.ts';
import { miniCupGroup } from './cupGroups.ts';
import type { CupGroup, PrivateMatch, Role, TeamFixture } from './types.ts';

export interface PublishedResult {
  date: string;
  home: string;
  away: string;
}

export interface UpcomingInput {
  fixtures: TeamFixture[];
  matches: PrivateMatch[];
  /** Public results (U12+ only). Empty for U7 to U11. */
  publishedResults: PublishedResult[];
  ownName: string;
  ageNumber: number;
  role: Role;
  /** Start of today, local. Fixtures before this are dropped. */
  today: Date;
}

export interface UpcomingEvent {
  /** Representative row. For a group this is identity only, never "game 1". */
  fixture: TeamFixture;
  group: CupGroup | null;
}

/** Private match linked to a public fixture: same date and opponent, venue preferred. */
export function linkedMatch(f: TeamFixture, matches: PrivateMatch[]): PrivateMatch | null {
  const opponent = norm(f.opponent);
  if (!opponent || !f.date) return null;
  const candidates = matches.filter((m) => m.date === f.date && norm(m.opponent) === opponent);
  return candidates.find((m) => m.venue === f.venue) ?? (candidates.length === 1 ? (candidates[0] ?? null) : null);
}

export function isReported(f: TeamFixture, i: Pick<UpcomingInput, 'matches' | 'publishedResults' | 'ownName'>): boolean {
  const m = linkedMatch(f, i.matches);
  if (m && (m.status === 'played' || m.status === 'abandoned')) return true;
  const self = norm(i.ownName);
  const opp = norm(f.opponent);
  return i.publishedResults.some(
    (r) => r.date === f.date && [r.home, r.away].some((n) => norm(n) === self) && [r.home, r.away].some((n) => norm(n) === opp),
  );
}

/**
 * Upcoming events, one per ordinary fixture and one per mini Cup group.
 * A group stays until BOTH games are recorded. Parents always see the group:
 * private completion never changes what a parent sees.
 */
export function upcomingEvents(i: UpcomingInput): UpcomingEvent[] {
  const seen = new Set<string>();
  const events: UpcomingEvent[] = [];
  const today = i.today.getTime();
  for (const f of i.fixtures) {
    if (f.date && new Date(`${f.date}T12:00:00`).getTime() < today) continue;
    const group = miniCupGroup(f, i.fixtures, i.ageNumber);
    if (group) {
      if (seen.has(group.key)) continue;
      seen.add(group.key);
      if (i.role === 'parent' || group.fixtures.some((row) => !isReported(row, i))) events.push({ fixture: group.fixtures[0], group });
    } else if (!isReported(f, i)) {
      events.push({ fixture: f, group: null });
    }
  }
  const time = (e: UpcomingEvent): string => {
    const t = e.group ? (e.group.fixtures.find((r) => r.time)?.time ?? '') : e.fixture.time;
    return t || '99:99';
  };
  return events.sort(
    (a, b) =>
      (a.fixture.date || '9999-99-99').localeCompare(b.fixture.date || '9999-99-99') || time(a).localeCompare(time(b)),
  );
}

export function nextEvent(i: UpcomingInput): UpcomingEvent | null {
  return upcomingEvents(i)[0] ?? null;
}
