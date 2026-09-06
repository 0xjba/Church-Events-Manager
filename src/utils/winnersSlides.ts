/*
 * The running order of a prize-giving.
 *
 * Kept apart from the screen that shows it so the order can be checked without
 * a browser and a hall.
 */

import {
  churchStandings,
  districtStandings,
  individualStandings,
  scopeAllows,
  type PlacedResult,
} from '@/utils/championship';

export interface Entrant {
  name: string;
  chestNumber: string | null;
  church: string | null;
}

export interface EventBlock {
  id: string;
  name: string;
  ageCategory: string | null;
  entrantType: 'individual' | 'group';
  placings: Array<{ rank: number; entrants: Entrant[] }>;
}

export type Slide =
  | { kind: 'event'; event: EventBlock }
  | { kind: 'placing'; event: EventBlock; rank: number; entrants: Entrant[] }
  | { kind: 'champion'; title: string; caption: string; winners: string[]; tied: boolean }
  | { kind: 'end' };

/**
 * Announce the event, then read its placings from third to first, then crown
 * the champions. Exported so the running order can be checked without a
 * browser and a hall.
 */
export const buildSlides = (
  blocks: EventBlock[],
  placed: PlacedResult[],
  scope: 'church' | 'district' | 'state' | undefined,
): Slide[] => {
  const built: Slide[] = [];

  for (const block of blocks) {
    built.push({ kind: 'event', event: block });
    // Third to first: the room should not hear the winner first.
    const descending = [...block.placings].sort((a, b) => b.rank - a.rank);
    for (const placing of descending) {
      built.push({ kind: 'placing', event: block, rank: placing.rank, entrants: placing.entrants });
    }
  }

  built.push(...championSlides(placed, scope));
  built.push({ kind: 'end' });
  return built;
};

const championSlides = (placed: PlacedResult[], scope: 'church' | 'district' | 'state' | undefined) => {
  const allows = scopeAllows(scope);
  const built: Slide[] = [];

  const leaders = <T,>(rows: Array<{ rank: number; subject: T }>) => rows.filter((row) => row.rank === 1);

  const individuals = leaders(individualStandings(placed));
  if (individuals.length > 0) {
    built.push({
      kind: 'champion',
      title: 'Individual champion',
      caption: 'Most rank points across the level',
      winners: individuals.map((row) => row.subject.full_name),
      tied: individuals.length > 1,
    });
  }

  // A local church level has one church in it, so crowning one says nothing.
  if (allows.church) {
    const churches = leaders(churchStandings(placed));
    if (churches.length > 0) {
      built.push({
        kind: 'champion',
        title: 'Champion church',
        caption: 'Most rank points across the level',
        winners: churches.map((row) => row.subject),
        tied: churches.length > 1,
      });
    }
  }

  if (allows.district) {
    const districts = leaders(districtStandings(placed));
    if (districts.length > 0) {
      built.push({
        kind: 'champion',
        title: 'Champion district',
        caption: 'Most rank points across the level',
        winners: districts.map((row) => row.subject),
        tied: districts.length > 1,
      });
    }
  }

  return built;
};
