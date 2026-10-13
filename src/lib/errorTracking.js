/**
 * Error tracking for the web app (OPS-01).
 *
 * Plugs into the `setErrorReporter` seam that FE-01 left in `src/lib/errorReporting.js`, so the
 * error boundaries do not import an SDK and do not know which service is behind them.
 *
 * LOADED ON DEMAND, AND ONLY WITH A DSN
 *
 * `@sentry/react` is imported dynamically. Two reasons, and the first is the binding one: the
 * first-load budget enforced by `scripts/check-bundle.mjs` is 90 kB gzip and the app currently uses
 * 79 kB, so a static import of the SDK would fail the build. Dynamically imported, it becomes its
 * own chunk that is fetched only when `VITE_SENTRY_DSN` is set — which means a build with no DSN
 * carries none of its weight at all.
 *
 * The cost of that choice is a short window during start-up where the reporter is not yet installed.
 * `errorReporting.js` buffers reports made in that window and flushes them once a reporter arrives,
 * so an error thrown during the very first render is not lost.
 *
 * WHAT MUST NEVER LEAVE THE BROWSER
 *
 * The URL is the sharp edge here, not the request body. `/reset-password?uid=...&token=...` carries
 * a live password-reset token in the query string, and `/verify-email` is the same shape. A
 * breadcrumb recording "navigated to /reset-password?token=abc" would hand a third party a working
 * credential for somebody's account. So every URL this module lets through is cut at the `?`:
 * in the event itself, in each breadcrumb, and in the breadcrumb hook that runs before either.
 *
 * Beyond that: no request bodies, the user reduced to an internal id, and a key denylist over the
 * data we attach ourselves. `scrubEvent` is a plain function over a plain object so that the part
 * which has to be right is tested without the SDK, a network or a Sentry account.
 */
import { setErrorReporter } from "./errorReporting";
import { lastRequestId } from "./api";

const DSN = import.meta.env.VITE_SENTRY_DSN || "";
const ENVIRONMENT =
  import.meta.env.VITE_SENTRY_ENVIRONMENT || (import.meta.env.DEV ? "development" : "production");
// The commit the bundle was built from, so a regression maps to a deploy rather than to a date.
// Nothing sets this yet; empty is better than wrong, because Sentry then groups the event with no
// release instead of blaming whichever build happened to be last.
const RELEASE = import.meta.env.VITE_SENTRY_RELEASE || "";
const TRACES_SAMPLE_RATE = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0) || 0;

export const REDACTED = "[redacted]";
export const DROPPED_BODY = "[dropped: request bodies are never sent]";

const SENSITIVE_KEY_FRAGMENTS = [
  "password", "passwd", "secret", "token", "authorization", "auth", "cookie", "csrf", "signature",
  "api_key", "apikey", "private", "credential",
  "card", "cvc", "cvv", "iban", "account_number", "routing",
  "ssn", "social_insurance", "insurance_number", "passport", "licence", "license",
  "email", "phone", "mobile", "address", "postal", "dob", "birth",
  "first_name", "last_name", "full_name", "client_name", "given_name", "surname",
];

const MAX_DEPTH = 6;

function isSensitive(key) {
  if (typeof key !== "string") return false;
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

/** Cuts a URL at the query string. See the note above about reset tokens. */
export function stripQuery(url) {
  if (typeof url !== "string") return url;
  return url.split("?")[0].split("#")[0];
}

function redact(value, depth = 0) {
  if (depth >= MAX_DEPTH) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = isSensitive(key) ? REDACTED : redact(item, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * `beforeBreadcrumb`. A navigation breadcrumb holds `from` and `to`; a fetch or xhr breadcrumb holds
 * `url`. All three are URLs in this app and all three can carry a reset token.
 */
export function scrubBreadcrumb(crumb) {
  if (!crumb || typeof crumb !== "object") return crumb;
  if (crumb.data && typeof crumb.data === "object") {
    const data = { ...crumb.data };
    for (const field of ["url", "from", "to"]) {
      if (typeof data[field] === "string") data[field] = stripQuery(data[field]);
    }
    crumb.data = redact(data);
  }
  // A console breadcrumb replays whatever was logged, which in a UI is frequently a whole object
  // holding a client. The level and the fact it happened are useful; the arguments are not worth
  // the risk.
  if (crumb.category === "console") {
    crumb.message = typeof crumb.message === "string" ? crumb.message.slice(0, 200) : undefined;
    if (crumb.data) crumb.data = undefined;
  }
  return crumb;
}

/** `beforeSend`. Returns the event to send, or null to drop it. Never throws. */
export function scrubEvent(event) {
  try {
    if (!event || typeof event !== "object") return null;

    if (event.request && typeof event.request === "object") {
      const request = {};
      if (event.request.method) request.method = event.request.method;
      if (typeof event.request.url === "string") request.url = stripQuery(event.request.url);
      if (event.request.data !== undefined && event.request.data !== null) {
        request.data = DROPPED_BODY;
      }
      // headers, cookies and query_string are simply not carried over.
      event.request = request;
    }

    if (event.user && typeof event.user === "object") {
      event.user = event.user.id === undefined || event.user.id === null ? {} : { id: event.user.id };
    }

    for (const key of ["extra", "contexts", "tags"]) {
      if (event[key] !== undefined) event[key] = redact(event[key]);
    }

    if (Array.isArray(event.breadcrumbs)) {
      event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
    } else if (event.breadcrumbs && Array.isArray(event.breadcrumbs.values)) {
      event.breadcrumbs.values = event.breadcrumbs.values.map(scrubBreadcrumb);
    }

    // The URL of the page the error happened on lives here too.
    if (event.contexts && event.contexts.page && typeof event.contexts.page === "object") {
      if (typeof event.contexts.page.url === "string") {
        event.contexts.page.url = stripQuery(event.contexts.page.url);
      }
    }

    // Tie the event to the server side. `X-Request-ID` from the most recent API response is the
    // same id that is on every backend log line for that request, so one lookup gets both halves
    // of the story (OPS-02, and the second half of OPS-08).
    const requestId = lastRequestId();
    if (requestId) {
      event.tags = { ...(event.tags && typeof event.tags === "object" ? event.tags : {}), request_id: requestId };
    }

    return event;
  } catch {
    // Dropping one report is recoverable; sending an unscrubbed one is not.
    return null;
  }
}

/**
 * Turns the context an error boundary gives us into tags and contexts that are safe to send.
 *
 * Separate from the sending so it can be tested without the SDK. `errorId` becomes a tag because it
 * is the short reference the recovery screen shows the customer: a support call quoting it should
 * find the event directly.
 */
export function reportPayload(context = {}) {
  const tags = {};
  if (context.errorId) tags.error_id = context.errorId;
  if (context.boundary) tags.boundary = context.boundary;
  if (context.route) tags.route = stripQuery(context.route);

  const contexts = {};
  if (context.componentStack) {
    contexts.react = { componentStack: String(context.componentStack).slice(0, 4000) };
  }
  return { tags, contexts };
}

/** The reporter installed into the `errorReporting` seam. `send` is `reportToSentry`. */
export function makeReporter(send) {
  return (error, context = {}) => send(error, reportPayload(context));
}

/**
 * Starts error tracking. Resolves to true when it was actually started.
 *
 * Returns false and does nothing at all without a DSN, which is how development, tests and any
 * build made before a Sentry project exists all run. Every failure is swallowed: error tracking
 * must never be the reason the app will not start.
 */
export async function initErrorTracking() {
  if (!DSN) return false;

  try {
    // `./sentryClient`, not `@sentry/react`. That module holds the only static imports of the SDK,
    // which is what makes the SDK's unused parts shakeable; importing the package directly here
    // would pull in its whole namespace. See the comment at the top of sentryClient.js.
    const { startSentry, reportToSentry } = await import("./sentryClient");

    startSentry({
      dsn: DSN,
      environment: ENVIRONMENT,
      release: RELEASE,
      tracesSampleRate: TRACES_SAMPLE_RATE,
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });

    setErrorReporter(makeReporter(reportToSentry));
    return true;
  } catch {
    // A blocked or failed chunk fetch must not take the app down with it.
    return false;
  }
}
