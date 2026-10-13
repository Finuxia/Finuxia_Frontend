/**
 * One place that caught errors are reported from. The error boundaries call `reportError`; they do
 * not know which service is behind it. `src/lib/errorTracking.js` (OPS-01) installs the real
 * reporter at start-up with `setErrorReporter`; until then errors go to the console.
 *
 * WHY THERE IS A BUFFER
 *
 * The Sentry SDK is imported dynamically, because a static import would blow the first-load size
 * budget (see errorTracking.js). That leaves a short window during start-up with no reporter
 * installed — and an error thrown during the very first render lands exactly in that window, which
 * is the error you least want to lose. So reports made before a reporter arrives are held and
 * flushed when it does.
 *
 * The buffer is small and bounded. An app failing in a loop should not grow an array until the tab
 * dies; after the cap the oldest are dropped, since the first few are the ones that explain it.
 *
 * `reportError` never throws: it is called from inside error boundaries, where a second failure
 * would be the one thing worse than the first.
 */
const MAX_BUFFERED = 10;

let reporter = null;
let buffered = [];

const consoleReporter = (error, context) => {
  console.error("Unhandled UI error", context.errorId, error, context.componentStack || "");
};

export function setErrorReporter(fn) {
  reporter = typeof fn === "function" ? fn : null;
  if (!reporter) return;

  const pending = buffered;
  buffered = [];
  for (const [error, context] of pending) {
    try {
      reporter(error, context);
    } catch {
      // Flushing must not throw either.
    }
  }
}

export function newErrorId() {
  return Math.random().toString(36).slice(2, 10);
}

/** `context`: { errorId, componentStack, boundary: "app" | "route", route }. */
export function reportError(error, context = {}) {
  const full = { errorId: newErrorId(), ...context };
  try {
    if (reporter) {
      reporter(error, full);
      return;
    }
    // No reporter yet. Log it so a developer still sees it, and hold it for the real one.
    consoleReporter(error, full);
    buffered.push([error, full]);
    if (buffered.length > MAX_BUFFERED) buffered.shift();
  } catch {
    // Reporting must never be what breaks the recovery screen.
  }
}

/** Testing seam: forget any installed reporter and anything held for it. */
export function resetErrorReporting() {
  reporter = null;
  buffered = [];
}
