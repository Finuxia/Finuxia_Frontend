// Spreadsheet reading and writing, built on ExcelJS (.xlsx) and a small RFC 4180
// parser (.csv). This replaces SheetJS ("xlsx" / "xlsx-js-style"), which has
// unfixed prototype-pollution and ReDoS advisories and is no longer published to npm.
//
// The reader parses untrusted files, so it is deliberately defensive: size and
// row caps, null-prototype row objects, and header names that could poison an
// object (`__proto__`, `constructor`, `prototype`) are dropped.

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 10000;
const MAX_COLUMNS = 200;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export class SpreadsheetError extends Error {}

async function loadExcelJS() {
  const mod = await import("exceljs");
  return mod.default ?? mod;
}

// ---- reading -------------------------------------------------------------

const pad = (n) => String(n).padStart(2, "0");

/** ExcelJS builds Date cells in UTC, so read the UTC parts to avoid a day of drift. */
function utcDateString(d) {
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Flattens an ExcelJS cell value to a plain value: text stays text, numbers stay
 * numbers (so an Excel serial date in a General-format cell can still be parsed
 * later), dates become "YYYY-MM-DD".
 */
export function normalizeCellValue(value) {
  if (value == null) return "";
  if (value instanceof Date) return utcDateString(value);
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text ?? "").join("");
    if ("result" in value) return normalizeCellValue(value.result); // formula
    if ("text" in value) return normalizeCellValue(value.text); // hyperlink (e.g. a mailto: email)
    if ("error" in value) return "";
  }
  return "";
}

function isBlank(v) {
  return v === "" || v == null;
}

/**
 * Turns a grid (array of arrays) into row objects keyed by the header row.
 * The first non-empty row is the header; blank rows are skipped.
 */
export function rowsFromGrid(grid) {
  const headerIdx = grid.findIndex((r) => r.some((v) => !isBlank(v) && String(v).trim() !== ""));
  if (headerIdx === -1) return [];

  const headers = grid[headerIdx].map((h) => (isBlank(h) ? "" : String(h).trim()));
  if (headers.length > MAX_COLUMNS) throw new SpreadsheetError("This spreadsheet has too many columns.");

  const rows = [];
  for (const cells of grid.slice(headerIdx + 1)) {
    if (cells.every(isBlank)) continue;
    if (rows.length >= MAX_ROWS) throw new SpreadsheetError(`This spreadsheet has more than ${MAX_ROWS} rows.`);
    const row = Object.create(null);
    headers.forEach((header, c) => {
      if (!header || UNSAFE_KEYS.has(header) || header in row) return;
      row[header] = isBlank(cells[c]) ? "" : cells[c];
    });
    rows.push(row);
  }
  return rows;
}

async function readXlsx(buffer) {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new SpreadsheetError("This workbook has no sheets.");

  const grid = [];
  const columnCount = Math.min(sheet.columnCount, MAX_COLUMNS + 1);
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > MAX_ROWS + 1000) throw new SpreadsheetError(`This spreadsheet has more than ${MAX_ROWS} rows.`);
    const cells = [];
    for (let c = 1; c <= columnCount; c++) cells.push(normalizeCellValue(row.getCell(c).value));
    grid[rowNumber - 1] = cells;
  });
  // eachRow skips empty rows, leaving holes in the grid.
  return rowsFromGrid(Array.from(grid, (r) => r ?? []));
}

/** RFC 4180 parser: quoted fields, "" escapes, commas/newlines inside quotes, CRLF/LF/CR. */
export function parseCsv(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Excel in many locales writes ";" (or tab) instead of ","; pick whichever the header line uses most. */
function detectDelimiter(text) {
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0].replace(/"[^"]*"/g, "");
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

function decodeText(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer); // "CSV (comma delimited)" saved by older Excel
  }
}

function readCsv(buffer) {
  const text = decodeText(buffer).replace(/^﻿/, "");
  return rowsFromGrid(parseCsv(text, detectDelimiter(text)));
}

const isZip = (bytes) => bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
const isLegacyXls = (bytes) => bytes.length > 3 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11;

/**
 * Parses an .xlsx or .csv (the format is sniffed from the bytes, not trusted
 * from the file name) into row objects. Throws SpreadsheetError with a message
 * fit to show the user.
 */
export async function parseSpreadsheet(buffer) {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new SpreadsheetError(`This file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  }
  const bytes = new Uint8Array(buffer);
  if (isLegacyXls(bytes)) {
    throw new SpreadsheetError("Old .xls files aren't supported. Open it in Excel and save it as .xlsx or .csv.");
  }
  try {
    return isZip(bytes) ? await readXlsx(buffer) : readCsv(buffer);
  } catch (err) {
    if (err instanceof SpreadsheetError) throw err;
    throw new SpreadsheetError("Could not read this file. Make sure it's a valid .xlsx or .csv export.");
  }
}

export async function readSpreadsheetFile(file) {
  return parseSpreadsheet(await file.arrayBuffer());
}

// ---- writing -------------------------------------------------------------

const solid = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

/** The downloadable import template: bold header, sample row painted red. */
export async function buildTemplateWorkbook(columns, sampleRow) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Clients");
  ws.columns = columns.map((header) => ({ header, key: header, width: 22 }));
  ws.addRow(columns.map((c) => sampleRow[c] ?? ""));

  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
  });
  ws.getRow(2).eachCell((cell) => {
    cell.fill = solid("FFFF0000");
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });
  return wb;
}

/** The funnel checklist: merged navy banner, gold header, one row per client. */
export async function buildFunnelWorkbook({ banner, headerRow, dataRows, columnWidths }) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Funnel");
  ws.addRow([banner]);
  ws.addRow(headerRow);
  dataRows.forEach((r) => ws.addRow(r));
  ws.columns = columnWidths.map((width) => ({ width }));

  const lastCol = headerRow.length;
  ws.mergeCells(1, 1, 1, lastCol);
  for (let c = 1; c <= lastCol; c++) {
    const b = ws.getCell(1, c);
    b.fill = solid("FF0F1C2E");
    b.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 13 };
    b.alignment = { horizontal: "center", vertical: "middle" };
    const h = ws.getCell(2, c);
    h.fill = solid("FFC9A84C");
    h.font = { bold: true, color: { argb: "FF0F1C2E" } };
    h.alignment = { horizontal: "center" };
  }
  return wb;
}

/** Saves a workbook to the user's machine (no network). */
export async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
