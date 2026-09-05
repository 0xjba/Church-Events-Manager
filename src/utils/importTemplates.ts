/*
 * CSV templates for every batch import.
 *
 * Single source of truth, kept in step with docs/import-formats.md. The screens
 * used to carry their own inline template strings, which drifted from what the
 * parsers actually accepted.
 */

export interface ImportTemplate {
  /** Filename offered to the browser. */
  file: string;
  headers: string[];
  /** Two example rows, so the shape of an awkward column is obvious. */
  examples: string[][];
  /** Shown above the upload box. */
  note: string;
}

export const AGE_CATEGORIES = ['Sub Juniors', 'Juniors', 'Intermediates', 'Seniors'] as const;

export const TEMPLATES = {
  participants: {
    file: 'participants-template.csv',
    headers: ['full_name', 'age_category', 'chest_number', 'church', 'district', 'username', 'password'],
    examples: [
      ['Anna Mathew', 'Juniors', '101', 'Grace Church', 'North District', 'anna.mathew', 'changeme123'],
      ['Jerry Thomas', 'Seniors', '102', 'Hope Church, Kottayam', 'South District', 'jerry.thomas', 'changeme456'],
    ],
    note: 'Chest numbers and usernames must be unique; clashes are renumbered automatically and reported before import. Passwords need 8 characters and are hashed on the server.',
  },

  judges: {
    file: 'judges-template.csv',
    headers: ['full_name', 'username', 'password', 'email', 'church', 'contact'],
    examples: [
      ['Pr. Samuel George', 'samuel.george', 'changeme123', 'samuel@example.org', 'Grace Church', '+91 98765 43210'],
      ['Mrs. Leah Mathew', 'leah.mathew', 'changeme456', 'leah@example.org', 'Hope Church', ''],
    ],
    note: 'Contact is optional. Passwords need 8 characters and are hashed on the server.',
  },

  events: {
    file: 'events-template.csv',
    headers: [
      'event_name', 'age_category', 'event_format', 'entrant_type', 'event_order',
      'time_limit', 'max_participants', 'rules', 'criterion_name', 'criterion_max', 'criterion_weight',
    ],
    examples: [
      ['Solo Song Female', 'Juniors', 'stage', 'individual', '1', '3', '20', 'Three minutes maximum', 'Voice quality', '10', '1'],
      ['Solo Song Female', 'Juniors', '', '', '', '', '', '', 'Pronunciation', '10', '1'],
      ['Solo Song Female', 'Juniors', '', '', '', '', '', '', 'Expression', '5', '1'],
      ['Bible Quiz', 'Seniors', 'writing', 'individual', '2', '45', '', '', 'Round one', '20', '1'],
      ['Bible Quiz', 'Seniors', '', '', '', '', '', '', 'Round two', '20', '1'],
    ],
    note: 'One row per criterion: an event with three criteria is three rows. Repeat the event name and age category on each of them — the remaining event columns only need filling in on the first row, as the example shows.',
  },

  eventParticipants: {
    file: 'event-participants-template.csv',
    headers: ['chest_number', 'age_category', 'events'],
    examples: [
      ['201', 'Juniors', 'Solo Song Female, Bible Quiz'],
      ['202', 'Seniors', 'Speech'],
    ],
    note: 'Adds participants who already exist to events that already exist; it creates neither. Events match on name plus age category, and the category must match the participant\'s own.',
  },

  offlineScores: {
    file: 'offline-scores-template.csv',
    headers: [
      'event_name', 'age_category', 'chest_number', 'group_name',
      'judge_username', 'criterion_name', 'score',
    ],
    examples: [
      ['Solo Song Female', 'Juniors', '201', '', 'samuel.george', 'Voice quality', '8'],
      ['Action Song', 'Juniors', '', 'Zion Youth Team', 'samuel.george', 'Voice quality', '9'],
    ],
    note: 'One row per judge, per entrant, per criterion — the same sheet a judge would have filled in on a phone. Leave chest_number blank for group events and name the group instead.',
  },
} satisfies Record<string, ImportTemplate>;

export type TemplateKey = keyof typeof TEMPLATES;

const escapeCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export const templateCsv = (key: TemplateKey): string => {
  const template = TEMPLATES[key];
  return [template.headers, ...template.examples]
    .map((row) => row.map(escapeCell).join(','))
    .join('\n');
};

export const downloadTemplate = (key: TemplateKey): void => {
  const template = TEMPLATES[key];
  const blob = new Blob([templateCsv(key)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = template.file;
  anchor.click();
  URL.revokeObjectURL(url);
};
