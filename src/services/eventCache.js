/**
 * Offline cache for Google Calendar events, keyed per Finuxia user.
 *
 * We deliberately cache only the *event data* (titles, times, tags) — never
 * the OAuth access token, which stays memory-only for security and because
 * Google short-lived tokens can't be legitimately persisted. Caching events
 * means My Day/Dashboard can render the last-known meetings instantly on a
 * fresh session, before (or even without) a live reconnect.
 *
 * Implemented on localStorage for simplicity — the surface (read/write/clear)
 * is intentionally tiny so it can be swapped for IndexedDB (via idb-keyval)
 * with no caller changes if event volume ever outgrows localStorage's ~5MB.
 */
const PREFIX = "advisorpilot.calendarCache";
const VERSION = 1;

function keyFor(userEmail) {
  return `${PREFIX}.${userEmail || "anonymous"}`;
}

export function readCachedEvents(userEmail) {
  try {
    const raw = localStorage.getItem(keyFor(userEmail));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== VERSION || !Array.isArray(parsed.events)) return null;
    return { events: parsed.events, cachedAt: parsed.cachedAt };
  } catch {
    return null;
  }
}

export function writeCachedEvents(userEmail, events) {
  try {
    localStorage.setItem(
      keyFor(userEmail),
      JSON.stringify({ version: VERSION, cachedAt: Date.now(), events })
    );
  } catch {
    // Quota or serialization failure is non-fatal — the live list still works.
  }
}

export function clearCachedEvents(userEmail) {
  try {
    localStorage.removeItem(keyFor(userEmail));
  } catch {
    // ignore
  }
}
