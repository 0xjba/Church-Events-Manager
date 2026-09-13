/*
 * Group import.
 *
 * A group is an entrant, not a roster: it competes under a chest number, and
 * its placings count towards the church or district it represents. So the
 * sheet carries a name, a chest number and an affiliation, and nothing about
 * who stands on the stage.
 */

import { cell, type CsvRow } from '@/utils/csv';

export interface ParsedGroup {
  name: string;
  chest_number: string | null;
  church: string | null;
  district: string | null;
  row: number;
}

export const parseGroupRows = (
  rows: CsvRow[],
  existing: Array<{ name: string; chest_number: string | null }>,
): { groups: ParsedGroup[]; errors: string[] } => {
  const errors: string[] = [];
  const groups: ParsedGroup[] = [];

  // A chest number identifies an entrant within its level, so it has to be
  // unique there — against the sheet and against what is already stored.
  const takenChest = new Set(
    existing.map((group) => group.chest_number).filter((value): value is string => Boolean(value)),
  );
  const takenName = new Set(existing.map((group) => group.name.toLowerCase()));

  for (const row of rows) {
    const name = cell(row, 'name');
    const chestNumber = cell(row, 'chest_number');
    const church = cell(row, 'church');
    const district = cell(row, 'district');

    if (!name) {
      errors.push(`Row ${row._row}: missing name`);
      continue;
    }

    if (takenName.has(name.toLowerCase())) {
      errors.push(`Row ${row._row}: a group called ${name} is already in this level`);
      continue;
    }

    if (!chestNumber) {
      errors.push(`Row ${row._row}: missing chest_number`);
    } else if (takenChest.has(chestNumber)) {
      errors.push(`Row ${row._row}: chest number ${chestNumber} is already taken in this level`);
    }

    if (!church && !district) {
      errors.push(
        `Row ${row._row}: give a church or a district — a placing has to count towards something`,
      );
    }

    takenName.add(name.toLowerCase());
    if (chestNumber) takenChest.add(chestNumber);

    groups.push({
      name,
      chest_number: chestNumber || null,
      church: church || null,
      district: district || null,
      row: row._row,
    });
  }

  return { groups, errors };
};
