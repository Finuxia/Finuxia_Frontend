export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const MIN_BIRTH_DATE = "1900-01-01";

// Empty string = fine (or not filled in yet); otherwise a message. A browser
// date input will happily accept a 6-digit year typed by hand ("146753"), so
// the value itself has to be checked, not just the input's min/max.
export function birthDateError(value) {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Enter a valid date with a 4-digit year.";
  // Compare the calendar fields in LOCAL time: toISOString() is UTC, so for anyone east of UTC local midnight is still the
  // previous day there and every valid date would have been rejected.
  const parsed = new Date(`${value}T00:00:00`);
  const [y, m, d] = value.split("-").map(Number);
  if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== y || parsed.getMonth() + 1 !== m || parsed.getDate() !== d) {
    return "That isn't a real calendar date.";
  }
  if (value < MIN_BIRTH_DATE) return "Date of birth can't be before 1900.";
  if (value > todayISO()) return "Date of birth can't be in the future.";
  return "";
}

/**
 * An instant (an ISO string from the server) as a date a person reads, in their own time zone: "January 15, 2026".
 * Empty for a missing or invalid value, so a caller can show nothing instead of "Invalid Date".
 * @param {string | null | undefined} iso
 */
export function formatLongDate(iso) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Whole days left until an instant (an ISO string from the server), counting a part day as a day: 0 once it has passed. Null if there is no
 * valid date, so a caller can show nothing instead of "NaN days".
 * @param {string | null | undefined} iso
 * @param {Date} [now]
 */
export function daysLeft(iso, now = new Date()) {
  const end = iso ? new Date(iso) : null;
  if (!end || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
}
