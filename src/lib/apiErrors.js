/**
 * Turns a refused request into something a person can act on. Pure functions: no React, no network.
 *
 * The server's own sentence is preferred whenever it sent one (its messages name the actual limit and the way out:
 * "your AI wallet balance is too low for this, top up in Profile"). Only when it sent none is a fallback used, so
 * nobody sees "Request failed (402)". The one deliberate exception is a 429: its wait comes from the structured
 * `Retry-After` header, so the sentence says exactly how long, in plain units, instead of the framework's default text.
 */

/** Seconds from a Retry-After header, which is either a number of seconds or an HTTP date. Null if absent or unusable. */
export function parseRetryAfter(value, now = Date.now()) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Math.min(parseInt(text, 10), 24 * 3600);
  const when = Date.parse(text);
  if (Number.isNaN(when)) return null;
  return Math.max(0, Math.min(Math.ceil((when - now) / 1000), 24 * 3600));
}

/** "45 seconds", "1 minute", "3 minutes", "2 hours": rounded UP so we never tell someone to retry too early. */
export function formatWait(seconds) {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const minutes = Math.ceil(s / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

const LOGIN_PATHS = ["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password", "/api/auth/reset-password"];

// What the framework says when it throttles, which is not worth showing as it is.
const DEFAULT_THROTTLE_TEXT = /^request was throttled/i;

const FALLBACKS = {
  400: "That didn't look right. Please check it and try again.",
  401: "Please sign in again.",
  402: "This needs credit or a plan upgrade.",
  403: "You don't have access to this.",
  404: "We couldn't find that.",
  409: "This record changed elsewhere.",
};

/** The message for a failed request: the server's sentence if it sent one, else a sensible one for the status. */
export function messageForStatus(status, serverMessage, { retryAfter = null, path = "" } = {}) {
  const sent = typeof serverMessage === "string" ? serverMessage.trim() : "";
  if (status === 429) {
    const login = LOGIN_PATHS.some((p) => path.startsWith(p));
    if (sent && !DEFAULT_THROTTLE_TEXT.test(sent)) return sent;
    const wait = retryAfter ? ` Try again in ${formatWait(retryAfter)}.` : " Please wait a moment and try again.";
    return login ? `Too many attempts.${wait}` : `Too many requests.${wait}`;
  }
  if (sent) return sent;
  if (FALLBACKS[status]) return FALLBACKS[status];
  if (status >= 500) return "Something went wrong on our side. Please try again in a moment.";
  return `Something went wrong (${status}).`;
}

/**
 * What a refusal means for the screen. `kind` decides which inline state to show:
 *   rate_limited  too many requests: wait `retryAfter` seconds
 *   login_locked  too many sign-in attempts: a lockout message, with the wait
 *   quota         out of AI credit / wallet balance: offer to add credit (inline, not a toast)
 *   plan_gate     the plan doesn't include this: the upgrade prompt
 *   trial_ended   the free trial is over: the way to subscribe
 *   conflict      the record changed elsewhere: offer to refresh
 *   network       the server could not be reached
 *   other         anything else: the message
 */
export function describeError(error) {
  const status = error?.status ?? 0;
  const code = error?.code || error?.data?.code || "";
  const message = error?.message || messageForStatus(status, "");
  const retryAfter = error?.retryAfter ?? null;
  const path = error?.path || "";

  if (status === 0) return { kind: "network", message, retryAfter: null };
  if (status === 429) {
    const login = LOGIN_PATHS.some((p) => path.startsWith(p));
    return { kind: login ? "login_locked" : "rate_limited", message, retryAfter };
  }
  if (status === 402 || code === "ai_credit_exhausted") return { kind: "quota", message, retryAfter: null };
  if (status === 403) {
    if (code === "ai_not_in_plan" || /plan (doesn't|does not) include|isn't included in your/i.test(message)) return { kind: "plan_gate", message, retryAfter: null };
    if (/free trial has ended/i.test(message)) return { kind: "trial_ended", message, retryAfter: null };
  }
  if (status === 409) return { kind: "conflict", message, retryAfter: null };
  return { kind: "other", message, retryAfter: null };
}
