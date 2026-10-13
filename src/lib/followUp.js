/** Parse a value into a Date, treating bare YYYY-MM-DD strings as LOCAL dates
 *  (not UTC) so a day never drifts to the previous/next one. */
function parseLocal(value) {
  if (value instanceof Date) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

function startOfDay(date) {
  const d = parseLocal(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** LOCAL calendar date as YYYY-MM-DD (never UTC — avoids off-by-one at day edges). */
export function localISO(date = new Date()) {
  const d = date instanceof Date ? date : parseLocal(date);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Buckets a date string into the My Day follow-up labels.
 * "This week" is exclusive of today and inclusive of the next 7 days.
 */
export function calcNextFollowUp(dateStr) {
  if (!dateStr) return "TBD";

  const target = startOfDay(dateStr);
  if (Number.isNaN(target.getTime())) return "TBD";

  const today = startOfDay(new Date());
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Today";
  if (diffDays <= 7) return "This week";
  return "Next month";
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = parseLocal(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function todayLong(dateStr) {
  const d = dateStr ? parseLocal(dateStr) : new Date();
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function todayISO() {
  return localISO(new Date());
}

export function addDays(dateStr, days) {
  const base = dateStr ? parseLocal(dateStr) : new Date();
  base.setDate(base.getDate() + days);
  return localISO(base);
}

/** Whole days from today until dateStr (negative if in the past). */
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = startOfDay(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const today = startOfDay(new Date());
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export function daysAgoLabel(dateStr) {
  if (!dateStr) return "Never contacted";
  const target = startOfDay(dateStr);
  if (Number.isNaN(target.getTime())) return "Never contacted";
  const today = startOfDay(new Date());
  const diffDays = Math.round((today - target) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

/**
 * Normalizes any spreadsheet date value into a LOCAL YYYY-MM-DD string.
 * Handles JS Date objects (from cellDates), Excel serial numbers, and
 * assorted string formats. Empty/invalid input returns "" (never discarded
 * silently into a wrong date).
 */
export function toISODate(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : localISO(value);
  }
  if (typeof value === "number") {
    // Excel serial date (days since 1899-12-30). Read as UTC then re-anchor local.
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return "";
    return localISO(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = String(value).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); // already ISO-ish
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : localISO(d);
}

/** Local day boundaries as UTC instants — for Google Calendar timeMin/timeMax. */
export function localDayRange(dateStr) {
  const [y, m, d] = (dateStr || todayISO()).split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}
