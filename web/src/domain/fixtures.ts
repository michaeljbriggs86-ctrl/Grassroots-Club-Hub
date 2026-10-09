import { norm } from './normalise.ts';
import type { FeedFixture, TeamFixture } from './types.ts';

/** League division titles in the Selkent directory, e.g. "Under 12 Division", "Under 9 Navy". */
export function isLeagueDivisionName(name: string): boolean {
  return /^(?:under\s*\d{1,2}x?(?:\s*[a-z](?=\s|$)|\s+(?:division|navy|blue|green|orange|red|silver|yellow|white)(?=\s|$))|senior\s+division\b)/i.test(
    String(name || '').trim(),
  );
}

/** League names tolerate partial matches; other competitions need the full team name. */
export function sameTeamLoose(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || (x.length > 8 && y.includes(x)) || (y.length > 8 && x.includes(y));
}

export interface TeamContext {
  /** The team's own provider name, e.g. "Shooters Hill AFC Vikings". */
  teamName: string;
  /** The team's league division name, e.g. "Under 10 Navy". May be empty. */
  divisionName: string;
  /** Label used for league fixtures: "League" for a published league team, else "Division". */
  leagueLabel: 'League' | 'Division';
}

/**
 * Turn raw feed rows into one team's fixtures.
 * A row where the team appears on both sides or neither is dropped, so an
 * intra-club game is kept for each side and never lost because both clubs
 * share a prefix.
 */
export function teamFixtures(rows: FeedFixture[], team: TeamContext): TeamFixture[] {
  if (!team.teamName.trim()) throw new Error('Current team identity is missing');
  const division = norm(team.divisionName);
  const out: TeamFixture[] = [];
  for (const row of rows) {
    const competitionName = String(row.division_name || '').trim();
    const isLeague = !!division && norm(competitionName) === division;
    if (!competitionName || (!isLeague && isLeagueDivisionName(competitionName))) continue;
    const home = String(row.home || '').trim();
    const away = String(row.away || '').trim();
    const ownHome = isLeague ? sameTeamLoose(home, team.teamName) : norm(home) === norm(team.teamName);
    const ownAway = isLeague ? sameTeamLoose(away, team.teamName) : norm(away) === norm(team.teamName);
    if (ownHome === ownAway) continue;
    const opponent = ownHome ? away : home;
    if (!opponent) continue;
    const time = String(row.time || '').trim();
    out.push({
      date: String(row.date || ''),
      time: /^\d{2}:\d{2}$/.test(time) ? time : '',
      opponent,
      venue: ownHome ? 'H' : 'A',
      competition: isLeague ? team.leagueLabel : competitionName,
      providerTeamIds: Array.isArray(row.provider_team_ids) ? row.provider_team_ids.map(String) : [],
      raw: `${home} v ${away}`,
      source: 'selkent-static',
    });
  }
  return out.sort(
    (a, b) =>
      (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99') || a.opponent.localeCompare(b.opponent),
  );
}

/** Home team first, away team second, from the selected team's point of view. */
export function homeAway(f: TeamFixture, ownName: string): { home: string; away: string } {
  return f.venue === 'A' ? { home: f.opponent, away: ownName } : { home: ownName, away: f.opponent };
}
