/*
 * Events-with-criteria import.
 *
 * One row per criterion; rows sharing an event name and age category describe
 * one event, whose own columns are read from its first row. Everything is
 * validated before a single event is created, so a bad row cannot leave half an
 * event behind without its criteria.
 */

import { cell, type CsvRow } from '@/utils/csv';
import { AGE_CATEGORIES } from '@/utils/importTemplates';

export interface ParsedCriterion {
  name: string;
  max_score: number;
  weight: number;
}

export interface ParsedEvent {
  name: string;
  age_category: string | null;
  type: 'stage' | 'writing';
  event_type: 'individual' | 'group';
  event_order: number | null;
  time_limit: number | null;
  max_participants: number | null;
  rules: string | null;
  criteria: ParsedCriterion[];
  rows: number[];
}

const FORMATS = ['stage', 'writing'];
const ENTRANTS = ['individual', 'group'];

const optionalNumber = (value: string): number | null => {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseEventRows = (
  rows: CsvRow[],
  existing: Array<{ name: string; age_category: string | null }>,
): { events: ParsedEvent[]; errors: string[] } => {
  const errors: string[] = [];
  const grouped = new Map<string, ParsedEvent>();

  const alreadyThere = new Set(
    existing.map((event) => `${event.name.toLowerCase()}::${event.age_category ?? ''}`),
  );

  for (const row of rows) {
    const name = cell(row, 'event_name');
    const ageCategory = cell(row, 'age_category');
    const format = cell(row, 'event_format').toLowerCase();
    const entrantType = cell(row, 'entrant_type').toLowerCase();
    const criterionName = cell(row, 'criterion_name');
    const criterionMax = cell(row, 'criterion_max');
    const criterionWeight = cell(row, 'criterion_weight');

    if (!name) {
      errors.push(`Row ${row._row}: missing event_name`);
      continue;
    }

    const key = `${name.toLowerCase()}::${ageCategory}`;
    // The event's own columns only have to be filled in once. A second row for
    // the same event may carry just its criterion.
    const continuation = grouped.has(key);

    if (ageCategory && !AGE_CATEGORIES.includes(ageCategory as (typeof AGE_CATEGORIES)[number])) {
      errors.push(`Row ${row._row}: age_category must be blank or one of ${AGE_CATEGORIES.join(', ')}`);
    }
    if (!continuation && !FORMATS.includes(format)) {
      errors.push(`Row ${row._row}: event_format must be stage or writing`);
    }
    if (!continuation && !ENTRANTS.includes(entrantType)) {
      errors.push(`Row ${row._row}: entrant_type must be individual or group`);
    }
    if (!criterionName) {
      errors.push(`Row ${row._row}: missing criterion_name`);
    }

    const max = Number(criterionMax);
    if (!criterionMax || !Number.isFinite(max) || max <= 0) {
      errors.push(`Row ${row._row}: criterion_max must be a number above zero`);
    }

    const weight = criterionWeight === '' ? 1 : Number(criterionWeight);
    if (!Number.isFinite(weight) || weight <= 0) {
      errors.push(`Row ${row._row}: criterion_weight must be a number above zero`);
    }

    if (alreadyThere.has(key)) {
      errors.push(`Row ${row._row}: ${name}${ageCategory ? ` (${ageCategory})` : ''} already exists in this level`);
      continue;
    }

    const event = grouped.get(key) ?? {
      name,
      age_category: ageCategory || null,
      type: (FORMATS.includes(format) ? format : 'stage') as 'stage' | 'writing',
      event_type: (ENTRANTS.includes(entrantType) ? entrantType : 'individual') as 'individual' | 'group',
      event_order: optionalNumber(cell(row, 'event_order')),
      time_limit: optionalNumber(cell(row, 'time_limit')),
      max_participants: optionalNumber(cell(row, 'max_participants')),
      rules: cell(row, 'rules') || null,
      criteria: [],
      rows: [],
    };

    if (event.criteria.some((criterion) => criterion.name.toLowerCase() === criterionName.toLowerCase())) {
      errors.push(`Row ${row._row}: ${name} already has a criterion called ${criterionName}`);
      continue;
    }

    event.criteria.push({ name: criterionName, max_score: max, weight });
    event.rows.push(row._row);
    grouped.set(key, event);
  }

  const events = [...grouped.values()];

  for (const event of events) {
    if (event.criteria.length === 0) {
      errors.push(`${event.name}: no criteria, so judges would have nothing to score`);
    }
  }

  // A row that fills the event columns in again must agree with the first one;
  // disagreeing rows are a copy-paste mistake worth catching before creation.
  for (const event of events) {
    const conflicting = rows.filter((row) => {
      if (cell(row, 'event_name').toLowerCase() !== event.name.toLowerCase()) return false;
      if (cell(row, 'age_category') !== (event.age_category ?? '')) return false;

      const format = cell(row, 'event_format').toLowerCase();
      const entrantType = cell(row, 'entrant_type').toLowerCase();

      return (
        (format !== '' && format !== event.type) ||
        (entrantType !== '' && entrantType !== event.event_type)
      );
    });

    for (const row of conflicting) {
      errors.push(`Row ${row._row}: ${event.name} is described differently here than in row ${event.rows[0]}`);
    }
  }

  return { events, errors };
};
