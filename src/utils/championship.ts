/*
 * Championship standings.
 *
 * A placing is worth rank points; whoever holds the most wins. Individual and
 * group events are scored on different scales, because a group placing
 * represents a whole church or district rather than one entrant:
 *
 *   individual   1st = 5, 2nd = 3
 *   group        1st = 10, 2nd = 5
 *
 * Third place is a placing, shown as such, but it earns nothing.
 *
 * This is the single source of truth for both the leaderboard and the admin
 * winners view, which previously each had their own scheme.
 */

export const INDIVIDUAL_RANK_POINTS: Record<number, number> = { 1: 5, 2: 3 };
export const GROUP_RANK_POINTS: Record<number, number> = { 1: 10, 2: 5 };

export type EntrantType = 'individual' | 'group';

export const pointsForRank = (rank: number | null | undefined, entrant: EntrantType): number => {
  if (rank == null) return 0;
  const table = entrant === 'group' ? GROUP_RANK_POINTS : INDIVIDUAL_RANK_POINTS;
  return table[rank] ?? 0;
};

export interface PlacedResult {
  event_id: string;
  event_type: EntrantType;
  rank: number | null;
  /** Set for individual events. */
  participant?: {
    id?: string;
    full_name: string;
    chest_number: string;
    church?: string | null;
    district?: string | null;
  } | null;
  /** Set for group events. A group represents its church or district. */
  group?: {
    id?: string;
    name: string;
    chest_number?: string | null;
    church?: string | null;
    district?: string | null;
  } | null;
}

export interface Standing<T> {
  key: string;
  subject: T;
  points: number;
  placings: { first: number; second: number; third: number };
  events: number;
  rank: number;
  tied: boolean;
}

const rankStandings = <T>(rows: Array<Standing<T>>): Array<Standing<T>> => {
  const sorted = [...rows].sort(
    (a, b) => b.points - a.points || b.placings.first - a.placings.first || a.key.localeCompare(b.key),
  );

  let current = 1;
  return sorted.map((row, index) => {
    const tiedWithPrevious = index > 0 && sorted[index - 1].points === row.points;
    if (!tiedWithPrevious) current = index + 1;

    return {
      ...row,
      rank: current,
      tied:
        tiedWithPrevious || (index + 1 < sorted.length && sorted[index + 1].points === row.points),
    };
  });
};

const tally = <T>(
  results: PlacedResult[],
  keyOf: (result: PlacedResult) => string | null | undefined,
  subjectOf: (result: PlacedResult, key: string) => T,
): Array<Standing<T>> => {
  const accumulator = new Map<string, Standing<T>>();

  for (const result of results) {
    const points = pointsForRank(result.rank, result.event_type);
    if (points === 0) continue;

    const key = keyOf(result);
    if (!key) continue;

    const existing = accumulator.get(key) ?? {
      key,
      subject: subjectOf(result, key),
      points: 0,
      placings: { first: 0, second: 0, third: 0 },
      events: 0,
      rank: 0,
      tied: false,
    };

    existing.points += points;
    existing.events += 1;
    if (result.rank === 1) existing.placings.first += 1;
    if (result.rank === 2) existing.placings.second += 1;
    if (result.rank === 3) existing.placings.third += 1;

    accumulator.set(key, existing);
  }

  return rankStandings([...accumulator.values()]);
};

export type ParticipantSubject = NonNullable<PlacedResult['participant']>;

/**
 * Individual champion of the event level — individual events only, since a
 * group placing belongs to the group rather than to any one entrant.
 */
export const individualStandings = (results: PlacedResult[]) =>
  tally(
    results.filter((result) => result.event_type === 'individual'),
    (result) => result.participant?.id ?? result.participant?.chest_number,
    (result) => result.participant as ParticipantSubject,
  );

const affiliation = (result: PlacedResult, field: 'church' | 'district') =>
  result.event_type === 'group' ? result.group?.[field] : result.participant?.[field];

/**
 * Champion church, and champion district above it: every placing earned by that
 * church's entrants, individual and group alike, added together.
 */
export const churchStandings = (results: PlacedResult[]) =>
  tally(results, (result) => affiliation(result, 'church'), (_, key) => key);

export const districtStandings = (results: PlacedResult[]) =>
  tally(results, (result) => affiliation(result, 'district'), (_, key) => key);
