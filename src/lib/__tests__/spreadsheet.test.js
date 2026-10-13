import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mapImportRows, TEMPLATE_COLUMNS, TEMPLATE_SAMPLE } from "../clientImport";
import {
  MAX_FILE_BYTES,
  SpreadsheetError,
  buildFunnelWorkbook,
  buildTemplateWorkbook,
  parseCsv,
  parseSpreadsheet,
} from "../spreadsheet";

// Excel dates are UTC-anchored; a zone behind UTC (the advisors' own) is where a
// local-time read would shift every date back a day. Pin it so the suite catches that.
process.env.TZ = "America/Toronto";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const load = (name) => {
  const b = readFileSync(join(FIXTURES, name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const COLORS = ["c1", "c2", "c3"];
const importFixture = async (name) => mapImportRows(await parseSpreadsheet(load(name)), { colors: COLORS });

describe("importing an Excel export (independent writer, Excel-style OOXML)", () => {
  it("reads the first sheet only, skipping blank rows", async () => {
    const rows = await parseSpreadsheet(load("customers-export.xlsx"));
    expect(rows).toHaveLength(5); // sample + nameless + 3 real, blank row dropped, "Notes" sheet ignored
    expect(Object.keys(rows[0])).toEqual(TEMPLATE_COLUMNS);
  });

  it("keeps per-row success/failure reporting and silently skips the sample row", async () => {
    const { created, failedRows, successCount } = await importFixture("customers-export.xlsx");
    expect(successCount).toBe(3);
    expect(created.map((c) => `${c.first} ${c.last}`)).toEqual(["Jane Doe", "John Smith Jr", "Mary O'Neil-Brown"]);
    // rows: 1 Jane, 2 SAMPLE, 3 nameless (blank row is not counted), 4 John, 5 Mary
    expect(failedRows).toEqual([{ row: 3, error: "Missing Name" }]);
  });

  it("parses date-styled cells, General-format serial numbers and formula results to local ISO dates", async () => {
    const { created } = await importFixture("customers-export.xlsx");
    const [jane, john, mary] = created;
    expect(jane.lastContactDate).toBe("2026-08-01"); // date-styled cell
    expect(jane.followUpDate).toBe("2026-08-20"); // plain number 46254, General format
    expect(john.lastContactDate).toBe("2026-08-15"); // text date
    expect(john.followUpDate).toBe("2026-09-01"); // formula with cached result
    expect(mary.lastContactDate).toBe("2026-12-31"); // year edge
    expect(mary.followUpDate).toBe("2027-01-01");
  });

  it("sends strings to the API even when Excel stored numbers (phone) or hyperlinks (email)", async () => {
    const { created } = await importFixture("customers-export.xlsx");
    expect(created[0].phone).toBe("5551234567");
    expect(created[0].email).toBe("jane.doe@email.com");
    expect(created[1].name).toBeUndefined();
    for (const c of created) for (const k of ["phone", "email", "telegram", "referredBy"]) expect(typeof c[k]).toBe("string");
  });

  it("matches stages by label/id and falls back to the first stage", async () => {
    const { created } = await importFixture("customers-export.xlsx");
    expect(created.map((c) => c.currentStage)).toEqual(["cp", "strategy_meeting", "cp"]);
  });

  it("understands the 1904 date system", async () => {
    const { created } = await importFixture("date1904.xlsx");
    expect(created[0].followUpDate).toBe("2026-08-20");
  });
});

describe("importing a CSV", () => {
  it("handles BOM, CRLF, quoted commas, escaped quotes and newlines inside quotes", async () => {
    const rows = await parseSpreadsheet(load("customers-export.csv"));
    expect(rows).toHaveLength(4);
    expect(rows[0]["Referred By"]).toBe("Smith, John");
    expect(rows[2].Name).toBe('O"Hara, Pat');
    expect(rows[3].Phone).toBe("line one\nline two");
    expect(Object.keys(rows[0])[0]).toBe("Name"); // BOM stripped
  });

  it("parses US dates, ISO dates and a serial number written as text", async () => {
    const { created, failedRows } = await importFixture("customers-export.csv");
    expect(failedRows).toEqual([]);
    expect(created.map((c) => c.lastContactDate)).toEqual(["2026-08-01", "", ""]);
    expect(created.map((c) => c.followUpDate)).toEqual(["2026-08-20", "2026-08-21", ""]);
  });

  it("copes with semicolon delimiters and Windows-1252 text", async () => {
    const rows = await parseSpreadsheet(load("semicolon-cp1252.csv"));
    expect(rows).toEqual([{ Name: "Zoë Müller", Phone: "5559990000", Email: "zoe@x.com" }]);
  });

  it("parseCsv is RFC 4180 compliant on edge cases", () => {
    expect(parseCsv('a,"b ""q"" c",\r\n1,2,3')).toEqual([["a", 'b "q" c', ""], ["1", "2", "3"]]);
    expect(parseCsv("a,b\n")).toEqual([["a", "b"]]);
    expect(parseCsv("")).toEqual([]);
  });
});

describe("hostile input", () => {
  it("does not let __proto__ / constructor / prototype headers pollute anything", async () => {
    const rows = await parseSpreadsheet(load("proto-pollution.xlsx"));
    expect(rows).toHaveLength(1);
    expect(Object.getPrototypeOf(rows[0])).toBe(null);
    expect(Object.keys(rows[0])).toEqual(["Name", "Phone"]);
    expect({}.polluted).toBeUndefined();
    expect(Object.prototype.polluted).toBeUndefined();
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });

  it("rejects legacy .xls with a clear message", async () => {
    const xls = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]).buffer;
    await expect(parseSpreadsheet(xls)).rejects.toThrow(/\.xls/);
  });

  it("rejects oversized files and corrupt zips without leaking internals", async () => {
    await expect(parseSpreadsheet(new ArrayBuffer(MAX_FILE_BYTES + 1))).rejects.toBeInstanceOf(SpreadsheetError);
    const corrupt = new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8]).buffer;
    await expect(parseSpreadsheet(corrupt)).rejects.toThrow(/valid \.xlsx or \.csv/);
  });
});

describe("writing styled workbooks", () => {
  it("the template round-trips and keeps the sample row styled red and skipped on import", async () => {
    const wb = await buildTemplateWorkbook(TEMPLATE_COLUMNS, TEMPLATE_SAMPLE);
    const ws = wb.worksheets[0];
    expect(ws.name).toBe("Clients");
    expect(ws.getRow(1).values.slice(1)).toEqual(TEMPLATE_COLUMNS);
    expect(ws.getCell("A1").font.bold).toBe(true);
    expect(ws.getCell("A2").fill.fgColor.argb).toBe("FFFF0000");
    expect(ws.getCell("A2").font.color.argb).toBe("FFFFFFFF");
    expect(ws.getColumn(1).width).toBe(22);

    const bytes = await wb.xlsx.writeBuffer();
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const rows = await parseSpreadsheet(buf);
    expect(rows).toHaveLength(1);
    const { created, failedRows } = mapImportRows(rows, { colors: COLORS });
    expect(created).toEqual([]);
    expect(failedRows).toEqual([]); // the sample row is neither imported nor a failure
  });

  it("the funnel workbook has a merged navy banner, gold header and boolean stage cells", async () => {
    const wb = await buildFunnelWorkbook({
      banner: "Finuxia Funnel — 1 clients — a to b",
      headerRow: ["#", "Name", "Priority", "CP", "FC1"],
      dataRows: [[1, "Jane Doe", "High", true, false]],
      columnWidths: [5, 24, 10, 12, 12],
    });
    const ws = wb.worksheets[0];
    expect(ws.name).toBe("Funnel");
    expect(ws.getCell("A1").isMerged).toBe(true);
    expect(ws.getCell("A1").fill.fgColor.argb).toBe("FF0F1C2E");
    expect(ws.getCell("A1").font.size).toBe(13);
    expect(ws.getCell("B2").fill.fgColor.argb).toBe("FFC9A84C");
    expect(ws.getCell("D3").value).toBe(true);
    expect(ws.getCell("E3").value).toBe(false);
  });
});
