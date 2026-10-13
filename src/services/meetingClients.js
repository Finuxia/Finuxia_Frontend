/**
 * Links Google Calendar events to Finuxia clients.
 *
 * Two match strategies, in priority order:
 *  1. Exact — the event carries `extendedProperties.private.advisorpilotClientId`
 *     (set when the meeting was created from within the app). Zero ambiguity.
 *  2. Fuzzy — the event summary contains a known client's full name. Used for
 *     meetings created directly in Google Calendar.
 *
 * We match automatically but never *create* clients silently: a calendar full
 * of personal events would otherwise spam the pipeline. Unmatched events are
 * flagged so the UI can offer a one-click "Add as client" instead.
 */
function normalize(str) {
  return (str || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function matchClientForEvent(event, clients) {
  const taggedId = event?.extendedProperties?.private?.advisorpilotClientId;
  if (taggedId != null) {
    const byId = clients.find((c) => String(c.id) === String(taggedId));
    if (byId) return byId;
  }

  const summary = normalize(event?.summary);
  if (!summary) return null;

  // Longest names first so "Mary Anne Smith" wins over "Mary".
  const byName = [...clients]
    .sort((a, b) => `${b.first} ${b.last}`.length - `${a.first} ${a.last}`.length)
    .find((c) => {
      const full = normalize(`${c.first} ${c.last}`);
      return full.length > 2 && summary.includes(full);
    });

  return byName || null;
}

/** Pull a plausible client name out of an unmatched event's summary. */
export function guessClientNameFromEvent(event) {
  const summary = (event?.summary || "").trim();
  if (!summary) return null;
  // Common patterns: "FC1 — Jane Doe", "Meeting with Jane Doe", "Jane Doe call".
  const dash = summary
    .split(/[—-]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const candidate = dash.length > 1 ? dash[dash.length - 1] : summary;
  const cleaned = candidate.replace(/\b(meeting|call|with|fc\d|cp|strategy|closing)\b/gi, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 1) return null;
  return { first: parts[0], last: parts.slice(1).join(" ") || "" };
}

/** Decorates each event with its matched client (or null) for rendering. */
export function annotateEventsWithClients(events, clients) {
  return events.map((event) => ({ event, client: matchClientForEvent(event, clients) }));
}
