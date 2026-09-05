/*
 * CSV parsing shared by every importer.
 *
 * Quoted values may contain commas and escaped quotes, which matters for church
 * names and for the comma-separated event lists in the entrants sheet.
 */

/** Cell values by column name, plus the file line the row came from. */
export interface CsvRow {
  [column: string]: string | number;
  _row: number;
}

export interface ParsedCsv {
  headers: string[];
  rows: CsvRow[];
}

/** Cells are always strings; the helper keeps call sites free of casts. */
export const cell = (row: CsvRow, column: string): string => String(row[column] ?? '').trim();

const splitLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values;
};

export const parseCsv = (text: string, required: string[]): ParsedCsv => {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((line) => line.trim());
  if (lines.length < 2) {
    throw new Error('The file needs a header row and at least one row of data');
  }

  // Spreadsheets often save a byte-order mark onto the first header.
  const headers = splitLine(lines[0]).map((header) => header.replace(/^\uFEFF/, ''));
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }

  const rows = lines.slice(1).map((line, index) => {
    const values = splitLine(line);
    const row: CsvRow = { _row: index + 2 };
    headers.forEach((header, position) => {
      row[header] = values[position] ?? '';
    });
    return row;
  });

  return { headers, rows };
};
