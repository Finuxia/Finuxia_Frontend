import { PIPELINE_STAGES } from "./pipeline";
import { eventStart } from "../services/googleCalendarApi";

/**
 * A tiny composable data pipeline (a strategy pipeline) for charts and reports.
 *
 * `runPipeline(data, [stageA, stageB, ...])` threads the data through an
 * ordered list of pure transform strategies. Each stage is
 * `(data, ctx) => nextData`, so filters, groupers, and reducers compose freely
 * and every chart/report is expressed as data + a stage list — no bespoke
 * loops scattered across components.
 */
export function runPipeline(data, stages, ctx = {}) {
  return stages.filter(Boolean).reduce((acc, stage) => stage(acc, ctx), data);
}

/* ----------------------------- month helpers ----------------------------- */

export function monthKeyOf(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // "2026-08"
}

export function currentMonthKey() {
  return monthKeyOf(new Date());
}

export function monthLabel(key) {
  if (!key) return "";
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function monthShortLabel(key) {
  if (!key) return "";
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/** Recent months, newest first, as { key, label } — for filter dropdowns. */
export function listRecentMonths(count = 12, from = new Date()) {
  const out = [];
  const base = new Date(from.getFullYear(), from.getMonth(), 1);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const key = monthKeyOf(d);
    out.push({ key, label: monthLabel(key) });
  }
  return out;
}

/** ISO start/end instants for a month key — for Google Calendar timeMin/timeMax. */
export function monthRange(key) {
  const [y, m] = key.split("-").map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

/* ----------------------- accessors (date extractors) --------------------- */

// A client's "activity date" for monthly bucketing: its next follow-up if set,
// otherwise when it joined.
export const clientActivityDate = (client) => client.followUpDate || client.joined;

/* ------------------------------ strategies ------------------------------- */

/** Keep only items whose date (via accessor) falls in `monthKey`. */
export function filterByMonth(monthKey, accessor) {
  return (data) => {
    if (!monthKey) return data;
    return data.filter((item) => monthKeyOf(accessor(item)) === monthKey);
  };
}

/** Keep only items within an inclusive [startISO, endISO] instant window. */
export function filterByDateRange(startISO, endISO, accessor) {
  return (data) => {
    const start = startISO ? new Date(startISO).getTime() : -Infinity;
    const end = endISO ? new Date(endISO).getTime() : Infinity;
    return data.filter((item) => {
      const t = new Date(accessor(item)).getTime();
      return !Number.isNaN(t) && t >= start && t <= end;
    });
  };
}

/** Clients → [{ stage, count }] over every pipeline stage (zeros included). */
export function groupByStage() {
  return (clients) =>
    PIPELINE_STAGES.map((stage) => ({
      stage,
      count: clients.filter((c) => c.currentStage === stage.id).length,
    }));
}

/** Generic count-by: data → [{ key, count }] sorted desc. */
export function countBy(keyFn) {
  return (data) => {
    const map = new Map();
    data.forEach((item) => {
      const key = keyFn(item);
      if (key == null) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  };
}

/* --------------------- calendar-event classification --------------------- */

// Buckets an event by a coarse "meeting type" parsed from its title — CP, FC1…,
// Strategy, Closing, else "Other". Drives the Reports "meetings per type" chart.
const TYPE_PATTERNS = [
  { type: "CP", re: /\bcp\b/i },
  { type: "FC1", re: /\bfc\s?1\b/i },
  { type: "FC2", re: /\bfc\s?2\b/i },
  { type: "FC3", re: /\bfc\s?3\b/i },
  { type: "Strategy", re: /\bstrategy\b/i },
  { type: "Closing", re: /\bclosing\b/i },
  { type: "Policy Delivery", re: /\bpolicy\b/i },
];

export function classifyEventType(event) {
  const summary = event?.summary || "";
  const hit = TYPE_PATTERNS.find((p) => p.re.test(summary));
  return hit ? hit.type : "Other";
}

export const eventDate = (event) => eventStart(event) || new Date(NaN);
