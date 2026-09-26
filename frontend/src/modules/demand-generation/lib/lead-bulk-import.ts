import { COLOMBIA_MUNICIPIOS } from '../../discovery/lib/colombia-municipios';
import { assertConsistentRepeatedCompanies } from './lead-import-repeated-rows';
import { LEAD_INFLUENCIA_SLOTS } from './lead-vocab';
import {
  CANALES_ORIGEN,
  ORIGENES_LEAD,
  SEGMENTOS,
} from '../types';
import { createStoreZip, readZip } from './zip-binary';

const LEAD_IMPORT_DATA_ROWS = 200;
const LEAD_PREFILLED_ROWS = 30;
const LISTAS_SHEET = 'Listas';
const CONTENT_TYPES_NS =
  'http://schemas.openxmlformats.org/package/2006/content-types';
const RELS_NS =
  'http://schemas.openxmlformats.org/package/2006/relationships';
const MAIN_NS =
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const WORKSHEET_REL =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';
const STYLES_REL =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles';
const OFFICE_DOC_REL =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';

export type LeadCsvField = {
  key: string;
  header?: string;
  label: string;
  required: boolean;
  hint: string;
  example: string;
  list?: boolean;
};

export type LeadImportLists = {
  subsegmentos?: string[];
  traductores?: string[];
  campanas?: string[];
  empresas?: string[];
};

export const LEAD_CSV_FIELDS: LeadCsvField[] = [
  {
    key: 'origen',
    label: 'Origen',
    required: true,
    hint: 'Lista: elige un origen',
    example: 'Web',
    list: true,
  },
  {
    key: 'canal_origen',
    label: 'Canal de origen',
    required: true,
    hint: 'Lista: elige un canal',
    example: 'CAMPANA_DIGITAL',
    list: true,
  },
  {
    key: 'segmento',
    label: 'Segmento',
    required: true,
    hint: 'Lista: elige un segmento',
    example: 'Gobierno central',
    list: true,
  },
  {
    key: 'subsegmento',
    label: 'Subsegmento',
    required: false,
    hint: 'Lista. Obligatorio si segmento = Industria.',
    example: '',
    list: true,
  },
  {
    key: 'city',
    label: 'Ciudad',
    required: true,
    hint: 'Lista de municipios. La región se toma del departamento de la ciudad.',
    example: 'Bogotá, D.C. (Bogotá, D.C.)',
    list: true,
  },
  {
    key: 'account_name',
    header: 'Empresa',
    label: 'Empresa',
    required: true,
    hint: 'Lista de empresas ya creadas. No se crean empresas nuevas en el cargue.',
    example: 'Empresa ejemplo S.A.S.',
    list: true,
  },
  {
    key: 'tax_id',
    header: 'NIT',
    label: 'NIT',
    required: false,
    hint: 'Opcional si la empresa de la lista ya trae NIT',
    example: '900123456',
  },
  {
    key: 'contacto_nombre',
    label: 'Contacto',
    required: true,
    hint: 'Nombre del contacto principal',
    example: 'Ana Pérez',
  },
  {
    key: 'cargo',
    label: 'Cargo',
    required: false,
    hint: 'Cargo del contacto',
    example: 'Directora',
  },
  {
    key: 'email',
    label: 'Email',
    required: true,
    hint: 'Correo del contacto',
    example: 'ana@ejemplo.com',
  },
  {
    key: 'telefono',
    label: 'Teléfono',
    required: false,
    hint: 'Celular o fijo',
    example: '3001234567',
  },
  {
    key: 'tipo_influencia',
    label: 'Tipo de contacto',
    required: false,
    hint: 'Lista: Economica, Tecnica, Fabrica, Usuario, Coach',
    example: 'Economica',
    list: true,
  },
  {
    key: 'traductor',
    label: 'Traductor referente',
    required: false,
    hint: 'Lista de correos. Obligatorio si canal_origen = TRADUCTOR_NEGOCIO',
    example: '',
    list: true,
  },
  {
    key: 'campana',
    label: 'Campaña',
    required: false,
    hint: 'Lista de campañas activas',
    example: '',
    list: true,
  },
];

export function excelColumnLetter(index: number): string {
  let n = index;
  let letter = '';
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function excelHeader(field: LeadCsvField): string {
  return field.header ?? field.key;
}

const CSV_HEADER_ALIASES: Record<string, string> = {
  empresa: 'account_name',
  nit: 'tax_id',
};

function canonicalCsvHeader(header: string): string {
  const normalized = header.trim().toLowerCase();
  return CSV_HEADER_ALIASES[normalized] ?? normalized;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort(
    (left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' }),
  );
}

function colombiaCityLabels(): string[] {
  return uniqueSorted(
    COLOMBIA_MUNICIPIOS.map(
      (row) => `${row.municipio} (${row.departamento})`,
    ),
  );
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type CatalogColumn = {
  fieldKey: string;
  header: string;
  values: string[];
  name: string;
};

function catalogName(fieldKey: string): string {
  return `lista_${fieldKey}`.replace(/[^A-Za-z0-9_]/g, '_');
}

function buildCatalogColumns(lists: LeadImportLists = {}): CatalogColumn[] {
  return [
    { fieldKey: 'origen', header: 'origen', values: [...ORIGENES_LEAD] },
    { fieldKey: 'canal_origen', header: 'canal_origen', values: [...CANALES_ORIGEN] },
    { fieldKey: 'segmento', header: 'segmento', values: [...SEGMENTOS] },
    {
      fieldKey: 'subsegmento',
      header: 'subsegmento',
      values: uniqueSorted(lists.subsegmentos ?? []),
    },
    { fieldKey: 'city', header: 'city', values: colombiaCityLabels() },
    {
      fieldKey: 'account_name',
      header: 'Empresa',
      values: uniqueSorted(lists.empresas ?? []),
    },
    {
      fieldKey: 'tipo_influencia',
      header: 'tipo_influencia',
      values: LEAD_INFLUENCIA_SLOTS.map((slot) => slot.key),
    },
    {
      fieldKey: 'traductor',
      header: 'traductor',
      values: uniqueSorted(lists.traductores ?? []),
    },
    {
      fieldKey: 'campana',
      header: 'campana',
      values: uniqueSorted(lists.campanas ?? []),
    },
  ]
    .filter((column) => column.values.length > 0)
    .map((column) => ({ ...column, name: catalogName(column.fieldKey) }));
}

function xlsxCell(ref: string, value: string, header = false): string {
  const style = header ? 1 : 0;
  if (!value) {
    return `<c r="${ref}" s="${style}"/>`;
  }
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function xlsxRow(rowNumber: number, cells: string[]): string {
  return `<row r="${rowNumber}">${cells.join('')}</row>`;
}

function colLetter(index: number): string {
  return excelColumnLetter(index);
}

function buildListasSheet(columns: CatalogColumn[]): string {
  const maxRows = Math.max(...columns.map((column) => column.values.length), 1);
  const rows: string[] = [
    xlsxRow(
      1,
      columns.map((column, index) =>
        xlsxCell(`${colLetter(index)}1`, column.header, true),
      ),
    ),
  ];
  for (let valueIndex = 0; valueIndex < maxRows; valueIndex += 1) {
    const cells: string[] = [];
    columns.forEach((column, columnIndex) => {
      const value = column.values[valueIndex];
      if (!value) {
        return;
      }
      cells.push(
        xlsxCell(`${colLetter(columnIndex)}${valueIndex + 2}`, value),
      );
    });
    if (cells.length > 0) {
      rows.push(xlsxRow(valueIndex + 2, cells));
    }
  }
  const lastCol = colLetter(Math.max(columns.length - 1, 0));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">
  <dimension ref="A1:${lastCol}${maxRows + 1}"/>
  <sheetData>
    ${rows.join('')}
  </sheetData>
</worksheet>`;
}

function buildLeadsSheet(catalogs: CatalogColumn[]): string {
  const lastCol = colLetter(LEAD_CSV_FIELDS.length - 1);
  const lastRow = LEAD_IMPORT_DATA_ROWS + 1;
  const header = xlsxRow(
    1,
    LEAD_CSV_FIELDS.map((field, index) =>
      xlsxCell(`${colLetter(index)}1`, excelHeader(field), true),
    ),
  );
  const bodyRows: string[] = [];
  for (let row = 2; row <= LEAD_PREFILLED_ROWS + 1; row += 1) {
    bodyRows.push(
      xlsxRow(
        row,
        LEAD_CSV_FIELDS.map((_, index) => xlsxCell(`${colLetter(index)}${row}`, '')),
      ),
    );
  }

  const validations = catalogs
    .map((catalog, catalogIndex) => {
      const fieldIndex = LEAD_CSV_FIELDS.findIndex(
        (field) => field.key === catalog.fieldKey,
      );
      if (fieldIndex < 0) {
        return '';
      }
      const leadLetter = colLetter(fieldIndex);
      const listLetter = colLetter(catalogIndex);
      const lastListRow = catalog.values.length + 1;
      return `<dataValidation type="list" allowBlank="1" showDropDown="0" showInputMessage="1" showErrorMessage="1" errorStyle="stop" errorTitle="Valor no válido" error="Elige un valor de la lista." sqref="${leadLetter}2:${leadLetter}${lastRow}">
      <formula1>'${LISTAS_SHEET}'!$${listLetter}$2:$${listLetter}$${lastListRow}</formula1>
    </dataValidation>`;
    })
    .join('');

  const cols = LEAD_CSV_FIELDS.map(
    (_, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="22" customWidth="1"/>`,
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">
  <dimension ref="A1:${lastCol}${lastRow}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <cols>${cols}</cols>
  <sheetData>
    ${header}
    ${bodyRows.join('')}
  </sheetData>
  <dataValidations count="${catalogs.length}">
    ${validations}
  </dataValidations>
</worksheet>`;
}

function buildGuiaSheet(): string {
  const header = xlsxRow(1, [
    xlsxCell('A1', 'Campo', true),
    xlsxCell('B1', 'Obligatorio', true),
    xlsxCell('C1', 'Guía', true),
  ]);
  const rows = LEAD_CSV_FIELDS.map((field, index) =>
    xlsxRow(index + 2, [
      xlsxCell(`A${index + 2}`, excelHeader(field)),
      xlsxCell(`B${index + 2}`, field.required ? 'Sí' : 'No'),
      xlsxCell(`C${index + 2}`, field.hint),
    ]),
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">
  <sheetData>
    ${header}
    ${rows}
  </sheetData>
</worksheet>`;
}

function buildWorkbookXml(catalogs: CatalogColumn[]): string {
  const definedNames = catalogs
    .map((catalog, index) => {
      const letter = colLetter(index);
      const lastRow = catalog.values.length + 1;
      return `<definedName name="${catalog.name}">'${LISTAS_SHEET}'!$${letter}$2:$${letter}$${lastRow}</definedName>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">
  <sheets>
    <sheet name="Leads" sheetId="1" r:id="rId1"/>
    <sheet name="Guia" sheetId="2" r:id="rId2"/>
    <sheet name="${LISTAS_SHEET}" sheetId="3" r:id="rId3" state="hidden"/>
  </sheets>
  <definedNames>${definedNames}</definedNames>
</workbook>`;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${MAIN_NS}">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="@"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
  </cellXfs>
</styleSheet>`;
}

function buildContentTypes(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${CONTENT_TYPES_NS}">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function buildRootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${RELS_NS}">
  <Relationship Id="rId1" Type="${OFFICE_DOC_REL}" Target="xl/workbook.xml"/>
</Relationships>`;
}

function buildWorkbookRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${RELS_NS}">
  <Relationship Id="rId1" Type="${WORKSHEET_REL}" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="${WORKSHEET_REL}" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="${WORKSHEET_REL}" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="${STYLES_REL}" Target="styles.xml"/>
</Relationships>`;
}

function encodeXml(xml: string): Uint8Array {
  return new TextEncoder().encode(xml);
}

export function buildLeadImportXlsx(lists: LeadImportLists = {}): Uint8Array {
  const catalogs = buildCatalogColumns(lists);
  return createStoreZip([
    { name: '[Content_Types].xml', data: encodeXml(buildContentTypes()) },
    { name: '_rels/.rels', data: encodeXml(buildRootRels()) },
    { name: 'xl/workbook.xml', data: encodeXml(buildWorkbookXml(catalogs)) },
    { name: 'xl/_rels/workbook.xml.rels', data: encodeXml(buildWorkbookRels()) },
    { name: 'xl/styles.xml', data: encodeXml(buildStylesXml()) },
    { name: 'xl/worksheets/sheet1.xml', data: encodeXml(buildLeadsSheet(catalogs)) },
    { name: 'xl/worksheets/sheet2.xml', data: encodeXml(buildGuiaSheet()) },
    { name: 'xl/worksheets/sheet3.xml', data: encodeXml(buildListasSheet(catalogs)) },
  ]);
}

export function downloadLeadImportTemplate(lists: LeadImportLists = {}): void {
  const bytes = buildLeadImportXlsx(lists);
  const blob = new Blob([bytes.slice()], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'plantilla-carga-leads.xlsx';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Copy the picker File into memory so Chrome/Windows does not lose the handle. */
export async function snapshotImportFile(file: File): Promise<File> {
  try {
    const buffer = await file.arrayBuffer();
    return new File([buffer], file.name, {
      type: file.type || 'application/octet-stream',
      lastModified: file.lastModified,
    });
  } catch {
    throw new Error(
      'No se pudo leer el archivo. Ciérralo en Excel si está abierto, cópialo a una carpeta local y vuelve a seleccionarlo.',
    );
  }
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function columnIndexFromRef(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0] ?? 'A';
  let index = 0;
  for (const char of letters.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

function parseSharedStrings(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return [...doc.getElementsByTagName('si')].map((item) =>
    [...item.getElementsByTagName('t')]
      .map((node) => node.textContent ?? '')
      .join('')
      .trim(),
  );
}

function worksheetToCsv(xml: string, sharedStrings: string[]): string | null {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return null;
  }
  const rows = [...doc.getElementsByTagName('row')];
  if (rows.length === 0) {
    return null;
  }

  const csvRows = rows.map((row, rowIndex) => {
    const values: string[] = [];
    for (const cell of [...row.getElementsByTagName('c')]) {
      const ref = cell.getAttribute('r') ?? '';
      const index = columnIndexFromRef(ref);
      while (values.length <= index) {
        values.push('');
      }
      const type = cell.getAttribute('t');
      let text = '';
      if (type === 's') {
        const sharedIndex = Number(cell.getElementsByTagName('v')[0]?.textContent ?? '');
        text = sharedStrings[sharedIndex] ?? '';
      } else if (type === 'inlineStr') {
        text = cell.textContent ?? '';
      } else {
        text =
          cell.getElementsByTagName('is')[0]?.textContent ??
          cell.getElementsByTagName('v')[0]?.textContent ??
          cell.textContent ??
          '';
      }
      const value = text.trim();
      values[index] = rowIndex === 0 ? canonicalCsvHeader(value) : value;
    }
    return values.map(csvEscape).join(',');
  });

  const header = csvRows[0];
  const dataRows = csvRows.slice(1).filter((row) =>
    row.split(',').some((cell) => cell.replace(/"/g, '').trim()),
  );
  return [header, ...dataRows].join('\n');
}

function spreadsheetMlToCsv(xml: string): string | null {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return null;
  }
  const worksheets = [...doc.getElementsByTagName('Worksheet')];
  const leadsSheet =
    worksheets.find(
      (sheet) =>
        sheet.getAttribute('ss:Name') === 'Leads' ||
        sheet.getAttribute('Name') === 'Leads',
    ) ?? worksheets[0];
  if (!leadsSheet) {
    return null;
  }

  const rows = [...leadsSheet.getElementsByTagName('Row')];
  if (rows.length === 0) {
    return null;
  }

  const csvRows = rows.map((row, rowIndex) => {
    const cells = [...row.getElementsByTagName('Cell')];
    const values: string[] = [];
    let nextIndex = 0;
    for (const cell of cells) {
      const indexAttr =
        cell.getAttribute('ss:Index') ?? cell.getAttribute('Index');
      const index = indexAttr ? Number(indexAttr) - 1 : nextIndex;
      while (values.length < index) {
        values.push('');
      }
      const value = (cell.textContent ?? '').trim();
      values[index] = rowIndex === 0 ? canonicalCsvHeader(value) : value;
      nextIndex = index + 1;
    }
    return values.map(csvEscape).join(',');
  });

  const header = csvRows[0];
  const dataRows = csvRows
    .slice(1)
    .filter((row) => row.split(',').some((cell) => cell.replace(/"/g, '').trim()));
  return [header, ...dataRows].join('\n');
}

function workbookSheetPath(workbookXml: string, files: Map<string, Uint8Array>): string | null {
  const doc = new DOMParser().parseFromString(workbookXml, 'application/xml');
  const sheets = [...doc.getElementsByTagName('sheet')];
  const leads =
    sheets.find((sheet) => sheet.getAttribute('name') === 'Leads') ?? sheets[0];
  const rId =
    leads?.getAttributeNS(REL_NS, 'id') ??
    leads?.getAttribute('r:id') ??
    leads?.getAttribute('id');
  if (!rId) {
    return 'xl/worksheets/sheet1.xml';
  }
  const relsXml = new TextDecoder().decode(
    files.get('xl/_rels/workbook.xml.rels') ?? new Uint8Array(),
  );
  const relsDoc = new DOMParser().parseFromString(relsXml, 'application/xml');
  const rel = [...relsDoc.getElementsByTagName('Relationship')].find(
    (item) => item.getAttribute('Id') === rId,
  );
  const target = rel?.getAttribute('Target');
  if (!target) {
    return 'xl/worksheets/sheet1.xml';
  }
  return target.startsWith('/')
    ? target.slice(1)
    : `xl/${target.replace(/^\.\//, '')}`;
}

async function xlsxToCsv(buffer: ArrayBuffer): Promise<string | null> {
  const files = await readZip(buffer);
  const workbook = files.get('xl/workbook.xml');
  if (!workbook) {
    return null;
  }
  const shared = files.get('xl/sharedStrings.xml');
  const sharedStrings = shared
    ? parseSharedStrings(new TextDecoder().decode(shared))
    : [];
  const sheetPath = workbookSheetPath(new TextDecoder().decode(workbook), files);
  const sheet = sheetPath ? files.get(sheetPath) : files.get('xl/worksheets/sheet1.xml');
  if (!sheet) {
    return null;
  }
  return worksheetToCsv(new TextDecoder().decode(sheet), sharedStrings);
}

function remapCsvHeaders(csv: string): string {
  const withoutBom = csv.replace(/^\uFEFF/, '');
  const breakMatch = withoutBom.match(/\r\n|\n|\r/);
  const breakAt = breakMatch?.index ?? withoutBom.length;
  const newline = breakMatch?.[0] ?? '\n';
  const headerLine = withoutBom.slice(0, breakAt);
  const rest = withoutBom.slice(breakAt + newline.length);
  const headers = headerLine.split(',').map((cell) => {
    const unquoted = cell.trim().replace(/^"(.*)"$/s, '$1').replace(/""/g, '"');
    return csvEscape(canonicalCsvHeader(unquoted));
  });
  if (!breakMatch) {
    return headers.join(',');
  }
  return `${headers.join(',')}${newline}${rest}`;
}

export async function fileToLeadImportCsv(file: File): Promise<string> {
  const snapshot = await snapshotImportFile(file);
  const name = snapshot.name.toLowerCase();
  if (name.endsWith('.csv') || snapshot.type.includes('csv')) {
    return remapCsvHeaders(await snapshot.text());
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await snapshot.arrayBuffer();
  } catch {
    throw new Error(
      'No se pudo leer el archivo. Ciérralo en Excel si está abierto, cópialo a una carpeta local y vuelve a seleccionarlo.',
    );
  }
  const bytes = new Uint8Array(buffer);
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip || name.endsWith('.xlsx')) {
    const csv = await xlsxToCsv(buffer);
    if (csv) {
      return remapCsvHeaders(csv);
    }
    throw new Error('No se pudo leer la hoja Leads del Excel.');
  }

  const text = new TextDecoder().decode(buffer);
  if (name.endsWith('.xls') || text.includes('urn:schemas-microsoft-com:office:spreadsheet')) {
    const csv = spreadsheetMlToCsv(text);
    if (csv) {
      return remapCsvHeaders(csv);
    }
  }

  return remapCsvHeaders(text);
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

function csvToImportRows(csv: string): Array<{
  rowNumber: number;
  values: Record<string, string>;
}> {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    canonicalCsvHeader(header.replace(/^"(.*)"$/s, '$1')),
  );
  const rows: Array<{ rowNumber: number; values: Record<string, string> }> =
    [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = parseCsvLine(lines[lineIndex]);
    const values: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      values[header] = cells[columnIndex]?.trim() ?? '';
    });
    rows.push({ rowNumber: lineIndex + 1, values });
  }

  return rows;
}

export function assertRepeatedCompaniesInLeadCsv(csv: string): void {
  assertConsistentRepeatedCompanies(csvToImportRows(csv));
}

export function assertCampaignFileMatchesSegmento(
  csv: string,
  expectedSegmento: string,
): void {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error('El archivo no tiene filas de leads para importar.');
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    canonicalCsvHeader(header.replace(/^"(.*)"$/s, '$1')),
  );
  const segmentoIndex = headers.indexOf('segmento');
  if (segmentoIndex < 0) {
    throw new Error('El archivo no incluye la columna segmento.');
  }

  if (expectedSegmento === 'Todos') {
    return;
  }

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = parseCsvLine(lines[lineIndex]);
    const segmento = (cells[segmentoIndex] ?? '').trim();
    if (segmento !== expectedSegmento) {
      throw new Error(
        `El segmento de la fila ${lineIndex + 1} (${segmento || 'vacío'}) no coincide con el segmento objetivo (${expectedSegmento}).`,
      );
    }
  }
}
