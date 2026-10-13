/**
 * WHERE THIS SUITE IS ALLOWED TO RUN.
 *
 * These journeys REGISTER ACCOUNTS AND WRITE DATA. Pointed at a live system they would create junk
 * advisors and junk clients in among real ones, and the only thing standing between that and a
 * mistyped environment variable is this file.
 *
 * TEST-06 asks for "deliberately not run against production". A convention does not deliver that —
 * a convention is a thing someone forgets at 6pm. So there are two gates, and they fail differently
 * on purpose:
 *
 *   1. An ALLOWLIST. Local addresses are allowed. Anything else must be named in E2E_ALLOWED_HOSTS,
 *      which makes running against a remote environment a deliberate act.
 *   2. A DENYLIST that the allowlist cannot override. The known live hostnames are refused even if
 *      someone adds them to E2E_ALLOWED_HOSTS, because the realistic mistake is not inventing a
 *      hostname — it is copying one from a runbook into the wrong variable.
 *
 * The second gate is the one that matters. The first can be opted out of, which is what it is for.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1", "host.docker.internal"]);

/**
 * Hostnames that serve, or will serve, real users. Never runnable, whatever the configuration says.
 * Add to this list when an environment starts holding real data — that is cheaper than explaining
 * where the junk accounts came from.
 */
const NEVER = ["finuxia.ca", "api.finuxia.ca", "finuxia.com", "api.finuxia.com", "advisorpilot-api", "advisorpilot-web"];

export class UnsafeTarget extends Error {}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    throw new UnsafeTarget(`E2E_BASE_URL is not a valid URL: ${JSON.stringify(url)}`);
  }
}

/** Every host in `E2E_ALLOWED_HOSTS` (comma-separated), lower-cased. */
function allowedHosts() {
  return (process.env.E2E_ALLOWED_HOSTS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The base URL to run against, or throws. Called from the Playwright config, so a refusal happens
 * before a single browser starts rather than halfway through a run.
 */
export function resolveBaseUrl() {
  const url = process.env.E2E_BASE_URL || "http://localhost:5173";
  const host = hostOf(url);

  // Gate 2 first: it cannot be opted out of, so it should also not be reachable by argument order.
  const forbidden = NEVER.find((name) => host === name || host.endsWith(`.${name}`));
  if (forbidden) {
    throw new UnsafeTarget(
      `Refusing to run the end-to-end suite against ${host}.\n` +
        `It matches "${forbidden}", which serves real users. These journeys register accounts and ` +
        `write client records; running them here would put test data in among real data.\n` +
        `This refusal is deliberate and E2E_ALLOWED_HOSTS does not override it. If an environment ` +
        `on this hostname genuinely holds no real data, remove it from NEVER in ` +
        `e2e/support/target.js, in a commit, with a reason.`
    );
  }

  if (LOCAL_HOSTS.has(host) || allowedHosts().includes(host)) return url;

  throw new UnsafeTarget(
    `Refusing to run the end-to-end suite against ${host}: it is not a local address and is not ` +
      `listed in E2E_ALLOWED_HOSTS.\n` +
      `These journeys register accounts and write data, so running against an unknown environment ` +
      `is never the safe default. To allow it:\n` +
      `    E2E_ALLOWED_HOSTS=${host} E2E_BASE_URL=${url} npm run test:e2e`
  );
}

/** True when the target is on this machine — the only case where reading the mail directory works. */
export function targetIsLocal(url) {
  return LOCAL_HOSTS.has(hostOf(url));
}
