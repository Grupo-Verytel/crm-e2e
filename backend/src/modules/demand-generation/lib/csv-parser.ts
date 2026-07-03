export interface ParsedCsvRow {
  rowNumber: number;
  values: Record<string, string>;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCsvContent(
  content: string,
  expectedHeaders: readonly string[],
): ParsedCsvRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headerCells = parseCsvLine(lines[0]).map((header) =>
    header.trim().toLowerCase(),
  );
  const expected = expectedHeaders.map((header) => header.toLowerCase());

  for (const header of expected) {
    if (!headerCells.includes(header)) {
      throw new Error(`Missing required CSV column: ${header}`);
    }
  }

  const rows: ParsedCsvRow[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = parseCsvLine(lines[lineIndex]);
    const values: Record<string, string> = {};

    headerCells.forEach((header, columnIndex) => {
      values[header] = cells[columnIndex]?.trim() ?? '';
    });

    rows.push({
      rowNumber: lineIndex + 1,
      values,
    });
  }

  return rows;
}
