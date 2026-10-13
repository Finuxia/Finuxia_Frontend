import { calcNextFollowUp, todayISO, toISODate } from "./followUp";
import { PIPELINE_STAGES, FIRST_STAGE_ID } from "./pipeline";

// The columns the importer understands. Kept in one place so the downloadable
// template always matches what the parser expects.
export const TEMPLATE_COLUMNS = [
  "Name",
  "Phone",
  "Email",
  "Telegram",
  "Referred By",
  "Stage",
  "Last Contact",
  "Next Follow-up",
];

// Sample row — its Name carries a clear "delete" marker; the importer skips
// any row whose name says SAMPLE + delete, so it can never become a real client.
export const TEMPLATE_SAMPLE = {
  Name: "SAMPLE — delete this row before importing",
  Phone: "(555) 123-4567",
  Email: "jane.doe@email.com",
  Telegram: "@janedoe",
  "Referred By": "John Smith",
  Stage: "CP",
  "Last Contact": "2026-08-01",
  "Next Follow-up": "2026-08-20",
};

/** Cell → trimmed text. Spreadsheets hand back numbers for phone-like cells, and the API wants strings. */
const text = (v) => (v == null ? "" : String(v).trim());

/**
 * CSV cells are always text, so an Excel serial date ("46255") arrives as a
 * string. Five-digit whole/decimal numbers are read as serials (1927–2173);
 * anything else goes through the normal date parsing.
 */
function dateValue(v) {
  if (typeof v === "string" && /^\d{5}(\.\d+)?$/.test(v.trim())) return Number(v);
  return v;
}

/**
 * Maps parsed spreadsheet rows to client objects.
 *
 * Returns { created, failedRows, successCount }. Rows with no name are reported
 * as failures; the template's sample row is skipped silently (neither a success
 * nor a failure). `row` in a failure is the 1-based position in `rows`.
 */
export function mapImportRows(rows, { colors, colorOffset = 0 }) {
  const failedRows = [];
  const created = [];

  rows.forEach((row, idx) => {
    const name = text(row.name || row.Name);
    if (!name) {
      failedRows.push({ row: idx + 1, error: "Missing Name" });
      return;
    }
    // Skip the template's sample row so it never becomes a real client.
    if (/sample/i.test(name) && /delete/i.test(name)) return;

    const parts = name.split(/\s+/);
    const first = parts[0];
    const last = parts.slice(1).join(" ");

    // Dates: Excel serials / Dates / strings → local ISO.
    const followUpDate = toISODate(dateValue(row.nextFollowUp ?? row["Next Follow-up"]));
    const lastContactDate = toISODate(dateValue(row.lastContact ?? row["Last Contact"]));

    const rawStage = text(row.stage || row.Stage).toLowerCase();
    const matchedStage =
      PIPELINE_STAGES.find((s) => s.label.toLowerCase() === rawStage || s.id === rawStage)?.id || FIRST_STAGE_ID;

    created.push({
      first,
      last,
      phone: text(row.phone || row.Phone),
      email: text(row.email || row.Email),
      telegram: text(row.telegram || row.Telegram),
      referredBy: text(row.referredBy || row["Referred By"]),
      preferredContact: "phone",
      priority: "Medium",
      color: colors[(colorOffset + idx) % colors.length],
      joined: todayISO(),
      followUpDate,
      nextFollowUp: followUpDate ? calcNextFollowUp(followUpDate) : "TBD",
      lastContactDate,
      lastContact: lastContactDate ? `Last contact — ${lastContactDate}` : "Not yet contacted",
      interests: [],
      currentStage: matchedStage,
      stages: { [matchedStage]: { status: "pending", data: {}, files: [] } },
      meeting: null,
      files: [],
      notes: [],
    });
  });

  return { created, failedRows, successCount: created.length };
}
