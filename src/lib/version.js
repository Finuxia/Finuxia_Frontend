/** The commit this bundle was built from, for display.
 *
 * WHY THIS EXISTS. Until now the only way to answer "what is actually live?" was to read the Cloud
 * Run revision with gcloud, which means having gcloud, having access, and knowing to look. During
 * the finuxia.com cutover a stale cached bundle was served twice, and both times the first question
 * was "is this the new build or an old one?" — unanswerable from the page itself.
 *
 * It reuses VITE_SENTRY_RELEASE rather than adding a parallel variable. That one is already
 * documented in .env.example as "the commit the bundle was built from", already read by
 * src/lib/errorTracking.js, and already carried the note "Nothing sets this yet". One value, set
 * once at build time, now feeds both the footer and Sentry's release grouping — so a version shown
 * on screen and a release named in an error report cannot disagree.
 *
 * EMPTY MEANS EMPTY. A local `npm run dev` has no commit to report, and the footer then shows
 * nothing rather than "unknown" or "dev". Same reasoning as errorTracking.js and the backend's
 * SENTRY_RELEASE: a blank is honest, whereas a placeholder is a value somebody might believe.
 */

/** Shortens a commit SHA for display, leaving anything that is not one alone.
 *
 * Seven characters because that is what git itself abbreviates to, so it can be pasted straight
 * into `git show`. A value that is not a hex SHA — a tag, a version string, something hand-set — is
 * truncated only enough to keep the footer from wrapping, because mangling it would make it
 * unsearchable, which is the one thing a version string has to be.
 */
export function shortCommit(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  return /^[0-9a-f]{7,40}$/i.test(value) ? value.slice(0, 7) : value.slice(0, 16);
}

/** The full value, for a title attribute — so the whole SHA is still copyable. */
export const BUILD_COMMIT = String(import.meta.env.VITE_SENTRY_RELEASE ?? "").trim();

/** What the footer renders. Empty string when there is nothing to report. */
export const BUILD_LABEL = shortCommit(BUILD_COMMIT);
