import { norm } from './normalise.ts';
import { miniCupGroup } from './cupGroups.ts';
import type { TeamFixture } from './types.ts';

/** Per-opponent identity. Links a private result to one real game. */
export function fixtureStableKey(f: TeamFixture): string {
  return [norm(f.opponent || 'tbc'), String(f.venue || '').toUpperCase(), norm(f.competition || 'fixture')].join('|');
}

export function datedGameKey(f: TeamFixture): string {
  return `${f.date}|${fixtureStableKey(f)}`;
}

/**
 * Event identity for availability, tactics, acknowledgements and notes.
 * A mini Cup group is ONE event, so its key does not change when one of its two
 * games is played and the other becomes the representative row.
 */
export function eventKey(f: TeamFixture, all: TeamFixture[], ageNumber: number): string {
  const group = miniCupGroup(f, all, ageNumber);
  return group ? group.key : datedGameKey(f);
}
