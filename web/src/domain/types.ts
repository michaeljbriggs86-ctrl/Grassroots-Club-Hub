/** Raw row as published in data/results.json (age_groups[].fixtures[]). */
export interface FeedFixture {
  date: string;
  time?: string;
  division_name: string;
  home: string;
  away: string;
  provider_team_ids?: string[];
}

export type Venue = 'H' | 'A';

/** A fixture seen from one team's point of view. */
export interface TeamFixture {
  date: string;
  time: string;
  opponent: string;
  venue: Venue;
  competition: string;
  providerTeamIds: string[];
  raw: string;
  source: 'selkent-static';
}

export type Role = 'coach' | 'assistant_coach' | 'club_admin' | 'parent' | 'player';

export type MatchStatus = 'scheduled' | 'played' | 'abandoned';

/** A privately entered match record (Supabase / team state). Never public. */
export interface PrivateMatch {
  date: string;
  opponent: string;
  venue: Venue;
  status: MatchStatus;
}

export interface CupGroup {
  /** Stable event key: date | cup-group | normalised competition. */
  key: string;
  date: string;
  competition: string;
  /** Two real games. Identity only, never ordering. */
  fixtures: [TeamFixture, TeamFixture];
  opponents: [string, string];
}
