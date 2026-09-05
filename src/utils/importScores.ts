/*
 * Scores for events that were run off the app.
 *
 * The sheet is what a judge would have entered: one row per judge, per entrant,
 * per criterion. The same completeness rule applies here as in the judge
 * interface — a sheet missing a criterion would drag that entrant's average
 * down without anyone noticing — so a whole import is rejected until every
 * judge/entrant pair is complete.
 */

import { cell, type CsvRow } from '@/utils/csv';

export interface ScoreImportContext {
  events: Array<{
    id: string;
    name: string;
    age_category: string | null;
    event_type: string;
    criteria: Array<{ id: string; name: string; max_score: number }>;
    judgeIds: Set<string>;
    participantIds: Set<string>;
    groupIds: Set<string>;
  }>;
  judgesByUsername: Map<string, { id: string; full_name: string }>;
  participantsByChest: Map<string, { id: string; full_name: string; level_id: string | null }>;
  groupsByName: Map<string, { id: string; name: string }>;
}

export interface PreparedScore {
  event_id: string;
  participant_id: string | null;
  group_id: string | null;
  judge_id: string;
  criteria_id: string;
  score: number;
  is_locked: true;
}

export interface ScoreImportPlan {
  scores: PreparedScore[];
  errors: string[];
  /** Judges who scored but were never assigned to the event in the app. */
  judgeAssignments: Array<{ event_id: string; judge_id: string; label: string }>;
  /** Entrants who were scored but were never entered in the app. */
  entrantRegistrations: Array<{ event_id: string; participant_id?: string; group_id?: string; label: string }>;
  entrantCount: number;
}

export const prepareScoreImport = (rows: CsvRow[], context: ScoreImportContext): ScoreImportPlan => {
  const errors: string[] = [];
  const scores: PreparedScore[] = [];

  const judgeAssignments = new Map<string, { event_id: string; judge_id: string; label: string }>();
  const entrantRegistrations = new Map<
    string,
    { event_id: string; participant_id?: string; group_id?: string; label: string }
  >();

  // Tracks which criteria each judge covered for each entrant.
  const coverage = new Map<string, { eventId: string; label: string; criteria: Set<string> }>();
  const seen = new Set<string>();

  for (const row of rows) {
    const eventName = cell(row, 'event_name');
    const ageCategory = cell(row, 'age_category');
    const chestNumber = cell(row, 'chest_number');
    const groupName = cell(row, 'group_name');
    const judgeUsername = cell(row, 'judge_username');
    const criterionName = cell(row, 'criterion_name');
    const rawScore = cell(row, 'score');

    const event = context.events.find(
      (candidate) =>
        candidate.name.toLowerCase() === eventName.toLowerCase() &&
        (candidate.age_category ?? '') === ageCategory,
    );

    if (!event) {
      errors.push(`Row ${row._row}: no event called ${eventName}${ageCategory ? ` (${ageCategory})` : ''} in this level`);
      continue;
    }

    const judge = context.judgesByUsername.get(judgeUsername);
    if (!judge) {
      errors.push(`Row ${row._row}: no judge with username ${judgeUsername}`);
      continue;
    }

    const criterion = event.criteria.find(
      (candidate) => candidate.name.toLowerCase() === criterionName.toLowerCase(),
    );
    if (!criterion) {
      errors.push(`Row ${row._row}: ${event.name} has no criterion called ${criterionName}`);
      continue;
    }

    const isGroupEvent = event.event_type === 'group';

    if (isGroupEvent && !groupName) {
      errors.push(`Row ${row._row}: ${event.name} is a group event, so group_name is required`);
      continue;
    }
    if (!isGroupEvent && !chestNumber) {
      errors.push(`Row ${row._row}: chest_number is required`);
      continue;
    }

    const participant = isGroupEvent ? undefined : context.participantsByChest.get(chestNumber);
    const group = isGroupEvent ? context.groupsByName.get(groupName.toLowerCase()) : undefined;

    if (!isGroupEvent && !participant) {
      errors.push(`Row ${row._row}: no participant with chest number ${chestNumber} in this level`);
      continue;
    }
    if (isGroupEvent && !group) {
      errors.push(`Row ${row._row}: no group called ${groupName}`);
      continue;
    }

    const score = Number(rawScore);
    if (rawScore === '' || !Number.isFinite(score)) {
      errors.push(`Row ${row._row}: score must be a number`);
      continue;
    }
    if (score < 0 || score > criterion.max_score) {
      errors.push(`Row ${row._row}: ${criterionName} is out of ${criterion.max_score}, got ${rawScore}`);
      continue;
    }

    const entrantId = (isGroupEvent ? group!.id : participant!.id);
    const entrantLabel = isGroupEvent ? group!.name : `#${chestNumber} ${participant!.full_name}`;
    const fingerprint = `${event.id}:${entrantId}:${judge.id}:${criterion.id}`;

    if (seen.has(fingerprint)) {
      errors.push(`Row ${row._row}: ${judge.full_name} already scored ${criterionName} for ${entrantLabel}`);
      continue;
    }
    seen.add(fingerprint);

    if (!event.judgeIds.has(judge.id)) {
      judgeAssignments.set(`${event.id}:${judge.id}`, {
        event_id: event.id,
        judge_id: judge.id,
        label: `${judge.full_name} → ${event.name}`,
      });
    }

    const registered = isGroupEvent ? event.groupIds.has(entrantId) : event.participantIds.has(entrantId);
    if (!registered) {
      entrantRegistrations.set(`${event.id}:${entrantId}`, {
        event_id: event.id,
        ...(isGroupEvent ? { group_id: entrantId } : { participant_id: entrantId }),
        label: `${entrantLabel} → ${event.name}`,
      });
    }

    const coverageKey = `${event.id}:${entrantId}:${judge.id}`;
    const covered = coverage.get(coverageKey) ?? {
      eventId: event.id,
      label: `${judge.full_name} for ${entrantLabel} in ${event.name}`,
      criteria: new Set<string>(),
    };
    covered.criteria.add(criterion.id);
    coverage.set(coverageKey, covered);

    scores.push({
      event_id: event.id,
      participant_id: isGroupEvent ? null : entrantId,
      group_id: isGroupEvent ? entrantId : null,
      judge_id: judge.id,
      criteria_id: criterion.id,
      score,
      is_locked: true,
    });
  }

  // Every sheet must be complete, exactly as the judge interface demands.
  coverage.forEach((covered) => {
    const event = context.events.find((candidate) => candidate.id === covered.eventId);
    if (!event) return;

    const missing = event.criteria.filter((criterion) => !covered.criteria.has(criterion.id));
    if (missing.length > 0) {
      errors.push(`${covered.label}: missing ${missing.map((criterion) => criterion.name).join(', ')}`);
    }
  });

  const entrants = new Set(scores.map((score) => score.participant_id ?? score.group_id));

  return {
    scores,
    errors,
    judgeAssignments: [...judgeAssignments.values()],
    entrantRegistrations: [...entrantRegistrations.values()],
    entrantCount: entrants.size,
  };
};
