// Every event this app creates carries this private tag. Editing is limited
// to these events, while deletion can also be requested for other events on
// the connected primary calendar.
const APP_SOURCE = "advisorpilot";

export function isAppEvent(event) {
  return event?.extendedProperties?.private?.source === APP_SOURCE;
}

/** Start/end instant of an event, tolerating all-day events (`date` not `dateTime`). */
export function eventStart(event) {
  const raw = event?.start?.dateTime || event?.start?.date;
  return raw ? new Date(raw) : null;
}

export function isAllDay(event) {
  return Boolean(event?.start?.date && !event?.start?.dateTime);
}

export function isOnDate(event, day = new Date()) {
  const start = eventStart(event);
  if (!start || Number.isNaN(start.getTime())) return false;
  return start.getFullYear() === day.getFullYear() && start.getMonth() === day.getMonth() && start.getDate() === day.getDate();
}
