/*
 * Championship standings.
 *
 * A placing is worth rank points; the entrant, church or district with the most
 * points wins. This is the single source of truth — the leaderboard and the
 * admin winners view previously each had their own scheme (110 - rank*10 and
 * 5/3/1), so who was champion depended on which screen you opened.
 *
 * Only placings score. Everything below third is worth nothing.
 */

export const RANK_POINTS: Record<number, number> = { 1: 5, 2: 3, 3: 1 };

export const pointsForRank = (rank: number | null | undefined): number =>
  rank == null ? 0 : (RANK_POINTS[rank] ?? 0);

export interface PlacedResult {
  event_id: string;
  rank: number | null;
  participant: {
    id?: string;
    full_name: string;
    chest_number: string;
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
        tiedWithPrevious ||
        (index + 1 < sorted.length && sorted[index + 1].points === row.points),
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
    const points = pointsForRank(result.rank);
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

/** Individual champion of the event level. */
export const individualStandings = (results: PlacedResult[]) =>
  tally(
    results,
    (result) => result.participant?.id ?? result.participant?.chest_number,
    (result) => result.participant as ParticipantSubject,
  );

/** Champion church — every placing its participants earned, added up. */
export const churchStandings = (results: PlacedResult[]) =>
  tally(results, (result) => result.participant?.church, (_, key) => key);

/** Champion district, once the competition is above district level. */
export const districtStandings = (results: PlacedResult[]) =>
  tally(results, (result) => result.participant?.district, (_, key) => key);
