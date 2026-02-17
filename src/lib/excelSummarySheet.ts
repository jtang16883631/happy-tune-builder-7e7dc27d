/**
 * Styled Summary Sheet Builder
 * Creates a professional Meridian Inventory-style summary sheet
 * with logo space, facility info, styled table, total, and certification block.
 */

import * as XLSX from 'xlsx-js-style';
import type { WorkSheet } from 'xlsx-js-style';
import { COLUMN_INDICES, getColLetter } from './excelFormulas';

interface SummarySheetOptions {
  facilityName: string;
  templateName: string;
  dateStr: string;
  sectionSheetNames: string[];
  /** Optional address line */
  address?: string;
}

/**
 * Create a professionally styled Summary worksheet matching the Meridian Inventory format.
 * Layout:
 *   Rows 1-4: Reserved for logo (manually inserted or left blank)
 *   Row 6: Facility name
 *   Row 7: Address or template name
 *   Row 8: Date
 *   Row 10: Table header (Section | Value) - blue background
 *   Row 11+: Section rows with hyperlinks
 *   After sections: Total row
 *   Certification text + signature block
 */
export function createStyledSummarySheet(options: SummarySheetOptions): WorkSheet {
  const { facilityName, templateName, dateStr, sectionSheetNames, address } = options;

  const rows: any[][] = [];

  // Rows 1-4: Logo placeholder (empty)
  rows.push([]); // 1
  rows.push([]); // 2
  rows.push([]); // 3
  rows.push([]); // 4
  rows.push([]); // 5 - spacer

  // Row 6: Facility name
  rows.push([facilityName || templateName]);
  // Row 7: Address or template name
  rows.push([address || templateName]);
  // Row 8: Date
  rows.push([dateStr]);
  // Row 9: spacer
  rows.push([]);

  // Row 10: Table header
  rows.push(['Section', 'Value']);

  // Row 11+: Section rows (placeholders for formulas)
  const sectionStartRow = 11;
  sectionSheetNames.forEach(() => {
    rows.push(['', '']); // Will be filled with names + formulas
  });

  // Spacer rows after sections
  const afterSectionsRow = sectionStartRow + sectionSheetNames.length;
  rows.push([]); // spacer
  rows.push([]); // spacer

  // Total row
  const totalRow = afterSectionsRow + 2;
  rows.push(['', '']); // Total value placeholder

  // Spacer rows before certification
  for (let i = 0; i < 5; i++) rows.push([]);

  // Certification block
  const certStartRow = totalRow + 6;
  rows.push([`This is to certify that the inventory of`]);
  rows.push([` ${facilityName || templateName} ,`]);
  rows.push([address ? ` ${address}` : '']);
  rows.push([` taken on the date of ${dateStr}`]);
  rows.push([` calculated actual cost, totaled to $0.00`]); // Will be updated by formula
  rows.push([]); // spacer
  rows.push([]); // spacer

  // Signature
  rows.push(['Christopher Green']);
  rows.push(['Chris Green, CEO/CFO']);
  rows.push(['cgreen@meridianinventory.com']);

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // -- Column widths --
  ws['!cols'] = [{ wch: 35 }, { wch: 18 }];

  // -- Merge cells for header rows --
  ws['!merges'] = [
    { s: { r: 5, c: 0 }, e: { r: 5, c: 1 } }, // Row 6: facility
    { s: { r: 6, c: 0 }, e: { r: 6, c: 1 } }, // Row 7: address
    { s: { r: 7, c: 0 }, e: { r: 7, c: 1 } }, // Row 8: date
  ];

  // -- Style: Facility name (Row 6) --
  const facilityCell = 'A6';
  if (ws[facilityCell]) {
    ws[facilityCell].s = {
      font: { bold: true, sz: 12 },
    };
  }

  // -- Style: Table header (Row 10) --
  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
    fill: { fgColor: { rgb: '4472C4' } }, // Blue background
    alignment: { horizontal: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
  };
  ws['A10'] = { t: 's', v: 'Section', s: { ...headerStyle, alignment: { horizontal: 'center' } } };
  ws['B10'] = { t: 's', v: 'Value', s: { ...headerStyle, alignment: { horizontal: 'center' } } };

  // -- Fill section names + hyperlinks + value formulas --
  sectionSheetNames.forEach((sheetName, index) => {
    const rowNum = sectionStartRow + index;
    const escapedName = sheetName.replace(/'/g, "''");
    const sectionCell = `A${rowNum}`;
    const valueCell = `B${rowNum}`;

    // Section name with hyperlink
    ws[sectionCell] = {
      t: 's',
      v: sheetName,
      l: { Target: `#'${escapedName}'!A1`, Tooltip: `Go to ${sheetName}` },
      s: {
        font: { color: { rgb: '0000FF' }, underline: true, sz: 10 },
        border: {
          top: { style: 'thin', color: { rgb: 'D9D9D9' } },
          bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
          left: { style: 'thin', color: { rgb: 'D9D9D9' } },
          right: { style: 'thin', color: { rgb: 'D9D9D9' } },
        },
      },
    };

    // Value formula: reference the section sheet's SUM cell
    const valueFormula = `'${escapedName}'!${getColLetter(COLUMN_INDICES.SUM_COLUMN)}1`;
    ws[valueCell] = {
      t: 'n',
      f: valueFormula,
      z: '"$"#,##0.00;[Red]("$"#,##0.00);"$ "-',
      s: {
        numFmt: '"$"#,##0.00;[Red]("$"#,##0.00);"$ "-',
        alignment: { horizontal: 'right' },
        border: {
          top: { style: 'thin', color: { rgb: 'D9D9D9' } },
          bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
          left: { style: 'thin', color: { rgb: 'D9D9D9' } },
          right: { style: 'thin', color: { rgb: 'D9D9D9' } },
        },
      },
    };
  });

  // -- Total row --
  const totalCellRef = `B${totalRow}`;
  const firstSectionRow = sectionStartRow;
  const lastSectionRow = sectionStartRow + sectionSheetNames.length - 1;

  ws[totalCellRef] = {
    t: 'n',
    f: `SUM(B${firstSectionRow}:B${lastSectionRow})`,
    z: '"$"#,##0.00',
    s: {
      font: { bold: true, sz: 12 },
      numFmt: '"$"#,##0.00',
      alignment: { horizontal: 'right' },
      border: {
        top: { style: 'medium', color: { rgb: '000000' } },
        bottom: { style: 'medium', color: { rgb: '000000' } },
        left: { style: 'medium', color: { rgb: '000000' } },
        right: { style: 'medium', color: { rgb: '000000' } },
      },
    },
  };

  // -- Certification text styling (italic) --
  const certRows = [certStartRow, certStartRow + 1, certStartRow + 2, certStartRow + 3, certStartRow + 4];
  certRows.forEach(r => {
    const cell = `A${r}`;
    if (ws[cell]) {
      ws[cell].s = {
        font: { italic: true, sz: 10, name: 'Lucida Handwriting' },
      };
    }
  });

  // Certification total line - add formula reference
  const certTotalCell = `A${certStartRow + 4}`;
  // We'll set a static placeholder; the actual total is in the Total cell
  // Update it with a concatenation approach isn't easy in xlsx, so we use TEXT formula
  ws[certTotalCell] = {
    t: 's',
    v: ` calculated actual cost, totaled to`,
    s: {
      font: { italic: true, sz: 10, name: 'Lucida Handwriting' },
    },
  };

  // Signature name styling
  const sigRow = certStartRow + 7;
  const sigCell = `A${sigRow}`;
  if (ws[sigCell]) {
    ws[sigCell].s = {
      font: { bold: true, sz: 14, name: 'Lucida Handwriting', underline: true },
    };
  }

  // Title/role
  const titleCell = `A${sigRow + 1}`;
  if (ws[titleCell]) {
    ws[titleCell].s = { font: { sz: 10 } };
  }

  // Email with hyperlink
  const emailCell = `A${sigRow + 2}`;
  if (ws[emailCell]) {
    ws[emailCell].s = { font: { color: { rgb: '0000FF' }, underline: true, sz: 10 } };
    ws[emailCell].l = { Target: 'mailto:cgreen@meridianinventory.com' };
  }

  // Update worksheet range
  const lastRow = sigRow + 2;
  ws['!ref'] = `A1:B${lastRow}`;

  return ws;
}
