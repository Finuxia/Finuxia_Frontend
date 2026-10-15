// Every event this app creates carries this private tag. Editing is limited
// to these events, while deletion can also be requested for other events on
// the connected primary calendar.
const APP_SOURCE = "advisorpilot";

export function isAppEvent(event) {
  return event?.extendedProperties?.private?.source === APP_SOURCE;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Start instant of an event, tolerating all-day events (`date` not `dateTime`).
 *
 * An all-day event carries a bare calendar date, and the language parses "2026-04-02" as midnight
 * UTC. Comparing that against a local date (as isOnDate does) puts the event on the PREVIOUS day for
 * anyone behind UTC — which is every advisor in Canada. So a date-only value is built as local
 * midnight: an all-day event belongs to that day where the person reading it is.
 */
export function eventStart(event) {
  const raw = event?.start?.dateTime || event?.start?.date;
  if (!raw) return null;
  const dateOnly = DATE_ONLY.exec(raw);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  return new Date(raw);
}

export function isAllDay(event) {
  return Boolean(event?.start?.date && !event?.start?.dateTime);
}

export function isOnDate(event, day = new Date()) {
  const start = eventStart(event);
  if (!start || Number.isNaN(start.getTime())) return false;
  return start.getFullYear() === day.getFullYear() && start.getMonth() === day.getMonth() && start.getDate() === day.getDate();
}
