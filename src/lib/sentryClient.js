/**
 * The only module that imports the Sentry SDK (OPS-01).
 *
 * It exists for one reason: tree shaking. `errorTracking.js` reaches this file with a dynamic
 * `import("./sentryClient")`, and this file uses STATIC NAMED imports from `@sentry/react`. That
 * distinction is what lets the bundler drop the SDK's unused parts.
 *
 * Doing the dynamic import directly on the package — `await import("@sentry/react")` — yields the
 * whole module namespace object, so every export has to be kept and nothing can be shaken out.
 *
 * Measured, not assumed: that shape produced a 117 kB gzip chunk, and naming the integrations
 * explicitly made no difference to it whatsoever — the chunk came out byte-identical, because the
 * namespace import was what held everything in. Moving the SDK behind this module's static named
 * imports took the same chunk to 24 kB gzip. It stays outside the first-load bundle either way,
 * but it is still a download on every page load once a DSN is set.
 *
 * Nothing here decides policy. The scrubbing, the sampling and the DSN all come from
 * errorTracking.js, so the rules live in one place and are tested without this file or the SDK.
 */
import {
  breadcrumbsIntegration,
  captureException,
  dedupeIntegration,
  globalHandlersIntegration,
  inboundFiltersIntegration,
  init,
  linkedErrorsIntegration,
  withScope,
} from "@sentry/react";

export function startSentry({ dsn, environment, release, tracesSampleRate, beforeSend, beforeBreadcrumb }) {
  init({
    dsn,
    environment: environment || undefined,
    release: release || undefined,
    // Tracing is the expensive part of the bill and this app has 14 users. Off unless turned up
    // deliberately for a specific question.
    tracesSampleRate,
    // Session Replay would record the screen, which for this product means recording clients'
    // identity documents. Not enabled, and not a close call.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend,
    beforeBreadcrumb,
    // An explicit list, not the defaults. The default breadcrumb integration records DOM
    // interactions — the text of whatever was clicked, which in this app is a client's name in a
    // list. Switching that off here means it is never collected, which is better than collecting
    // it and relying on a scrubber to catch it afterwards.
    defaultIntegrations: false,
    integrations: [
      // window.onerror and unhandledrejection. Worth more than it looks: an unhandled promise
      // rejection is NOT caught by a React error boundary, so without this a background request
      // that throws is invisible.
      globalHandlersIntegration(),
      // Drops known browser noise, e.g. the "ResizeObserver loop completed" non-error.
      inboundFiltersIntegration(),
      // Collapses the same error reported twice.
      dedupeIntegration(),
      // Follows `error.cause`, so the underlying failure is attached and not just the wrapper.
      linkedErrorsIntegration(),
      breadcrumbsIntegration({
        console: false, // replays whatever was logged, which in a UI is often a whole client
        dom: false, // records the text of what was clicked: client names, document titles
        fetch: true, // which request preceded the error; the URL is cut at the "?" by the scrubber
        history: true, // which page the user came from, same cut
        xhr: true,
        sentry: true,
      }),
    ],
  });
}

/** Sends one caught error. `tags` and `contexts` are already safe to attach: see errorTracking.js. */
export function reportToSentry(error, { tags = {}, contexts = {} } = {}) {
  withScope((scope) => {
    for (const [key, value] of Object.entries(tags)) scope.setTag(key, value);
    for (const [key, value] of Object.entries(contexts)) scope.setContext(key, value);
    captureException(error);
  });
}
