/** What the footer reports about this build.
 *
 * TWO DIFFERENT THINGS, FOR TWO DIFFERENT AUDIENCES.
 *
 * The product version — v1.0.0 — is what a person means by "which version are we on". It comes
 * from package.json via vite.config.js, so there is one place to change it, and `npm version minor`
 * bumps it and tags the commit in one step. It is injected rather than read from a .env file
 * because it is not configuration: nobody should be able to deploy a build claiming a version that
 * disagrees with package.json.
 *
 * The commit is what an engineer means. It stays available in the footer's tooltip and is what
 * Sentry groups releases by, so an error report names an exact build rather than a release that
 * might cover a fortnight of commits. Showing it as the headline was the wrong call — it answers a
 * question almost nobody is asking.
 *
 * WHY THIS EXISTS AT ALL. Until now the only way to answer "what is actually live?" was reading the
 * Cloud Run revision with gcloud — which means having gcloud, having access, and knowing to look.
 * During the finuxia.com cutover a stale cached bundle was served twice, and both times the first
 * question was "is this the new build or an old one?", unanswerable from the page itself.
 */

/** Shortens a commit SHA for the tooltip, leaving anything that is not one alone.
 *
 * Seven characters because that is what git itself abbreviates to, so it can be pasted straight
 * into `git show`. A value that is not a hex SHA — a tag, something hand-set — is truncated only
 * enough to stay readable, because mangling it would make it unsearchable, which is the one thing
 * a version string has to be.
 */
export function shortCommit(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  return /^[0-9a-f]{7,40}$/i.test(value) ? value.slice(0, 7) : value.slice(0, 16);
}

/** The product version, e.g. "1.0.0". Always set — vite.config.js injects it from package.json. */
export const APP_VERSION = String(import.meta.env.VITE_APP_VERSION ?? "").trim();

/** The commit the bundle was built from. Empty on a local dev build, which has no commit to report.
 * Empty rather than "unknown" or "dev" on purpose: a blank is honest, a placeholder is a value
 * somebody might believe. Same reasoning as errorTracking.js and the backend's SENTRY_RELEASE. */
export const BUILD_COMMIT = String(import.meta.env.VITE_SENTRY_RELEASE ?? "").trim();

/** What the footer shows: "v1.0.0". */
export const VERSION_LABEL = APP_VERSION ? `v${APP_VERSION}` : "";

/** The tooltip: the version, plus the exact commit when there is one. */
export const VERSION_TITLE = BUILD_COMMIT ? `Version ${APP_VERSION} · build ${shortCommit(BUILD_COMMIT)}` : `Version ${APP_VERSION}`;
