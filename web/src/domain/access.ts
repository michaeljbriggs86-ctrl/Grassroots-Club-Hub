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
 * DRAFT: the invariants below are from ARCHITECTURE.md (parents and players never see
 * private results; players get no inbox, safeguarding, medical, notes or parent contacts).
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

export function visibleMatch(role: Role, m: PrivateMatch): VisibleMatch {
  const base = { date: m.date, opponent: m.opponent, venue: m.venue };
  return can(role, 'view_private_results') ? { ...base, status: m.status } : base;
}

/** Age groups that may use Player Login. Change only after a club decision and safeguarding review. */
export const PLAYER_LOGIN_AGE_GROUPS: readonly number[] = [15];

/** Mirrors the database rule in create_invite (age_group must be 15). */
export function playerLoginAllowed(teamAgeGroup: number): boolean {
  return PLAYER_LOGIN_AGE_GROUPS.includes(teamAgeGroup);
}
