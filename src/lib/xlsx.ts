import 'server-only';
import { deflateRawSync } from 'node:zlib';

/**
 * Minimal .xlsx writer.
 *
 * An xlsx file is a ZIP of XML parts, and Node ships the only hard part —
 * DEFLATE — in zlib. That is cheaper than adding a spreadsheet library to the
 * bundle for the four sheets this app exports, and it produces a genuine
 * workbook rather than a CSV wearing a different extension.
 *
 * CSV was the previous format and it fails people in ordinary ways: Excel
 * silently reinterprets a booking reference as a number, mangles a name with a
 * comma in it, and asks about delimiters before it will open anything. A real
 * workbook has typed cells, so a phone number stays a string and an amount
 * stays a number you can sum.
 */

export type CellValue = string | number | boolean | Date | null | undefined;

export interface SheetColumn<T> {
  header: string;
  /** Column width in characters. Excel's default is unhelpfully narrow. */
  width?: number;
  value: (row: T) => CellValue;
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Control characters are not representable in XML 1.0 and corrupt the file
    // rather than being ignored. A guest name pasted from a PDF can carry them.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/** A1, B1, … Z1, AA1. */
function cellRef(columnIndex: number, rowIndex: number): string {
  let dividend = columnIndex + 1;
  let name = '';
  while (dividend > 0) {
    const remainder = (dividend - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    dividend = Math.floor((dividend - 1) / 26);
  }
  return `${name}${rowIndex + 1}`;
}

/** Excel counts days from 1899-12-30, in local-free serial form. */
function excelSerialDate(date: Date): number {
  return date.getTime() / 86_400_000 + 25569;
}

function cellXml(value: CellValue, ref: string): string {
  if (value === null || value === undefined || value === '') {
    return `<c r="${ref}"/>`;
  }
  if (value instanceof Date) {
    return `<c r="${ref}" s="2"><v>${excelSerialDate(value)}</v></c>`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  if (typeof value === 'boolean') {
    return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }

  // Inline strings rather than a shared-strings table: it costs a few bytes on
  // repeated values and removes a whole part that has to stay in sync.
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function sheetXml<T>(columns: Array<SheetColumn<T>>, rows: T[]): string {
  const cols = columns
    .map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width ?? 18}" customWidth="1"/>`)
    .join('');

  const header = `<row r="1">${columns
    .map((column, index) => `<c r="${cellRef(index, 0)}" s="1" t="inlineStr"><is><t>${escapeXml(column.header)}</t></is></c>`)
    .join('')}</row>`;

  const body = rows
    .map((row, rowIndex) => {
      const cells = columns
        .map((column, columnIndex) => {
          let value: CellValue;
          try {
            value = column.value(row);
          } catch {
            // One bad cell must not cost the whole export.
            value = null;
          }
          return cellXml(value, cellRef(columnIndex, rowIndex + 1));
        })
        .join('');
      return `<row r="${rowIndex + 2}">${cells}</row>`;
    })
    .join('');

  const lastCell = cellRef(Math.max(columns.length - 1, 0), rows.length);

  return `${XML_HEADER}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${lastCell}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols>
<sheetData>${header}${body}</sheetData>
<autoFilter ref="A1:${lastCell}"/>
</worksheet>`;
}

// ---------------------------------------------------------------------------
// ZIP container
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

/**
 * Write a ZIP with DEFLATE entries.
 *
 * No Zip64, no encryption, no data descriptors — none of which a spreadsheet
 * of this size needs, and each of which is a way to produce a file Excel opens
 * with a repair prompt.
 */
function zip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data, { level: 9 });
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0x21, 12); // date — a fixed 1980-01-01 keeps output deterministic
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);

    locals.push(local, compressed);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0, 38); // external attributes
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);

    offset += local.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralDirectory, end]);
}

// ---------------------------------------------------------------------------

export interface Sheet<T> {
  name: string;
  columns: Array<SheetColumn<T>>;
  rows: T[];
}

/**
 * Build a workbook. Sheet names are sanitised because Excel refuses to open a
 * file whose sheet name contains any of : \ / ? * [ ] or exceeds 31 characters.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildXlsx(sheets: Array<Sheet<any>>): Buffer {
  const safeNames = sheets.map((sheet, index) =>
    (sheet.name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || `Sheet${index + 1}`),
  );

  const contentTypes = `${XML_HEADER}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`;

  const rootRels = `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `${XML_HEADER}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${safeNames.map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`;

  const workbookRels = `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // Three styles: default, bold header, and a date format. s="1" and s="2" in
  // the sheet XML refer to the cellXfs entries below, by index.
  const styles = `${XML_HEADER}
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd\\-mmm\\-yyyy\\ hh:mm"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF3FF"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
</styleSheet>`;

  return zip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rootRels, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(workbook, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRels, 'utf8') },
    { name: 'xl/styles.xml', data: Buffer.from(styles, 'utf8') },
    ...sheets.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: Buffer.from(sheetXml(sheet.columns, sheet.rows), 'utf8'),
    })),
  ]);
}

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
