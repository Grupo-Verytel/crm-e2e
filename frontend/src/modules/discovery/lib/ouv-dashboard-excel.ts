import { createStoreZip } from '../../demand-generation/lib/zip-binary';
import type { OuvDashboardDetailItem } from '../api/ouv-dashboard-api';
import { OUV_ZONA_LABEL, type OuvZona } from '../lib/ouv-vocab';

const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE_DOC_REL =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';
const WORKSHEET_REL =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';
const STYLES_REL =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles';

const HEADERS = [
  'Consecutivo',
  'Título',
  'Empresa',
  'Comercial',
  'Segmento',
  'Zona',
  'Monto',
  'Fecha',
] as const;

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function columnLetter(index: number): string {
  let n = index;
  let letter = '';
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function zonaLabel(zona: string): string {
  if (zona in OUV_ZONA_LABEL) return OUV_ZONA_LABEL[zona as OuvZona];
  return zona;
}

function formatFecha(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function fechaHeader(items: OuvDashboardDetailItem[]): string {
  const fechaTipo = items[0]?.fecha_tipo;
  if (fechaTipo === 'cierre') return 'Fecha de cierre';
  if (fechaTipo === 'creacion') return 'Fecha de creación';
  return 'Fecha';
}

function textCell(ref: string, value: string, header = false): string {
  const style = header ? 1 : 0;
  if (!value) return `<c r="${ref}" s="${style}"/>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function numberCell(ref: string, value: number): string {
  if (!Number.isFinite(value)) return `<c r="${ref}" s="2"/>`;
  return `<c r="${ref}" s="2"><v>${value}</v></c>`;
}

function buildSheet(items: OuvDashboardDetailItem[]): string {
  const headers = [...HEADERS.slice(0, 7), fechaHeader(items)];
  const rows = [
    `<row r="1">${headers
      .map((header, index) => textCell(`${columnLetter(index)}1`, header, true))
      .join('')}</row>`,
  ];
  items.forEach((item, index) => {
    const row = index + 2;
    const cells = [
      textCell(`A${row}`, item.consecutivo),
      textCell(`B${row}`, item.titulo),
      textCell(`C${row}`, item.empresa ?? ''),
      textCell(`D${row}`, item.comercial),
      textCell(`E${row}`, item.segmento),
      textCell(`F${row}`, zonaLabel(item.zona)),
      numberCell(`G${row}`, item.monto),
      textCell(`H${row}`, formatFecha(item.fecha)),
    ];
    rows.push(`<row r="${row}">${cells.join('')}</row>`);
  });
  const lastRow = Math.max(items.length + 1, 1);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">
  <dimension ref="A1:H${lastRow}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <cols>
    <col min="1" max="1" width="16" customWidth="1"/>
    <col min="2" max="2" width="42" customWidth="1"/>
    <col min="3" max="3" width="36" customWidth="1"/>
    <col min="4" max="4" width="28" customWidth="1"/>
    <col min="5" max="5" width="28" customWidth="1"/>
    <col min="6" max="6" width="22" customWidth="1"/>
    <col min="7" max="7" width="18" customWidth="1"/>
    <col min="8" max="8" width="22" customWidth="1"/>
  </cols>
  <sheetData>${rows.join('')}</sheetData>
</worksheet>`;
}

function buildWorkbook(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">
  <sheets>
    <sheet name="Detalle" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function buildStyles(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${MAIN_NS}">
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
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`;
}

function encodeXml(xml: string): Uint8Array {
  return new TextEncoder().encode(xml);
}

export function buildOuvDashboardDetailXlsx(
  items: OuvDashboardDetailItem[],
): Uint8Array {
  return createStoreZip([
    {
      name: '[Content_Types].xml',
      data: encodeXml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${CONTENT_TYPES_NS}">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    },
    {
      name: '_rels/.rels',
      data: encodeXml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${RELS_NS}">
  <Relationship Id="rId1" Type="${OFFICE_DOC_REL}" Target="xl/workbook.xml"/>
</Relationships>`),
    },
    { name: 'xl/workbook.xml', data: encodeXml(buildWorkbook()) },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: encodeXml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${RELS_NS}">
  <Relationship Id="rId1" Type="${WORKSHEET_REL}" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="${STYLES_REL}" Target="styles.xml"/>
</Relationships>`),
    },
    { name: 'xl/styles.xml', data: encodeXml(buildStyles()) },
    { name: 'xl/worksheets/sheet1.xml', data: encodeXml(buildSheet(items)) },
  ]);
}

function fileName(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  return `detalle-ouv-${slug || 'tablero'}-${stamp}.xlsx`;
}

export function downloadOuvDashboardDetailXlsx(
  title: string,
  items: OuvDashboardDetailItem[],
): void {
  const bytes = buildOuvDashboardDetailXlsx(items);
  const blob = new Blob([bytes.slice()], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName(title);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
