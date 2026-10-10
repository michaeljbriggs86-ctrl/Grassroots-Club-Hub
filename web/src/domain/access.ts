import type { PrivateMatch, Role } from './types.ts';

export type Capability =
  | 'view_private_results'
  | 'enter_results'
  | 'view_attendance'
  | 'view_safeguarding'
  | 'view_medical'
  | 'view_parent_contacts'
  | 'view_coach_notes'
  | 'view_fixtures'
  | 'use_inbox';

/**
 * One table. No scattered isCoach() checks. A role with no entry has no access.
 * DRAFT: the invariants below are from ARCHITECTURE.md (until 10 Oct 2026 parents and players never saw
 * private results; now only U12+ may, see canSeePrivateResults; players get no inbox, safeguarding, medical, notes or parent contacts).
 * Every other cell is a proposal that must be reconciled against the live Supabase RLS
 * policies and the legacy role checks before this table is trusted.
 * Player Login is U15 only (Mike, 9 Oct 2026). Widening it needs a deliberate club decision
 * and a safeguarding review first, so it is a reviewed constant, not a parameter.
 */
const TABLE: Record<Role, readonly Capability[]> = {
  club_admin: ['view_private_results', 'enter_results', 'view_attendance', 'view_safeguarding', 'view_medical', 'view_parent_contacts', 'view_coach_notes', 'view_fixtures', 'use_inbox'],
  coach: ['view_private_results', 'enter_results', 'view_attendance', 'view_medical', 'view_parent_contacts', 'view_coach_notes', 'view_fixtures', 'use_inbox'],
  assistant_coach: ['view_private_results', 'enter_results', 'view_attendance', 'view_coach_notes', 'view_fixtures', 'use_inbox'],
  parent: ['view_fixtures', 'use_inbox'],
  // U15 players only: no inbox, no safeguarding, medical, notes or parent contacts.
  player: ['view_fixtures'],
};

export function can(role: Role, cap: Capability): boolean {
  return TABLE[role]?.includes(cap) ?? false;
}

/** What a role may see of a private match. Parents and players get no score or status. */
export interface VisibleMatch {
  date: string;
  opponent: string;
  venue: 'H' | 'A';
  status?: PrivateMatch['status'];
}

/**
 * Private match results: staff always. Parents and players only for U12 and above
 * (Mike, 10 Oct 2026). U7 to U11 stay scoreless for them. An unknown team age fails closed.
 */
export function canSeePrivateResults(role: Role, teamAge?: number): boolean {
  if (can(role, 'view_private_results')) return true;
  return (role === 'parent' || role === 'player') && typeof teamAge === 'number' && teamAge >= 12;
}

export function visibleMatch(role: Role, m: PrivateMatch, teamAge?: number): VisibleMatch {
  const base = { date: m.date, opponent: m.opponent, venue: m.venue };
  return canSeePrivateResults(role, teamAge) ? { ...base, status: m.status } : base;
}

/** Team state keys only staff may receive (Mike, 10 Oct 2026: tactics are coach only). */
export const COACH_ONLY_STATE_KEYS: readonly string[] = ['tactics'];

export function stateForRole<T extends Record<string, unknown>>(role: Role, state: T): Partial<T> {
  if (can(role, 'view_coach_notes')) return state;
  const out: Record<string, unknown> = { ...state };
  for (const k of COACH_ONLY_STATE_KEYS) delete out[k];
  return out as Partial<T>;
}

/** Age groups that may use Player Login. Change only after a club decision and safeguarding review. */
export const PLAYER_LOGIN_AGE_GROUPS: readonly number[] = [15];

/** Mirrors the database rule in create_invite (age_group must be 15). */
export function playerLoginAllowed(teamAgeGroup: number): boolean {
  return PLAYER_LOGIN_AGE_GROUPS.includes(teamAgeGroup);
}
