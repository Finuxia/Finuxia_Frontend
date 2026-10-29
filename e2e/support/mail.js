/**
 * READING THE EMAILS THE BACKEND SENT.
 *
 * Two journeys in TEST-06 need a link that only arrives by email: "register, verify email, sign in"
 * and "forgot password, reset, sign in with the new password". A browser cannot read an inbox, so
 * the suite needs another way to get that link, and the choice matters more than it looks.
 *
 * WHAT THIS DOES NOT DO, and why. The obvious shortcut is a test-only HTTP endpoint that hands back
 * the verification token for an address. That is an endpoint which gives away account-takeover
 * tokens, living in the same codebase as production, protected by a flag — exactly the kind of
 * thing that survives a refactor and ships. Not worth it for a test convenience.
 *
 * WHAT IT DOES INSTEAD. Django's own file-based email backend writes each message to disk. The
 * backend under test runs with:
 *
 *     EMAIL_BACKEND=django.core.mail.backends.filebased.EmailBackend
 *     EMAIL_FILE_PATH=<a directory this suite can read>
 *
 * No application code exists for the benefit of tests, and nothing new is reachable over HTTP.
 * SEC-14 made EMAIL_BACKEND an explicit opt-in that overrides the DEBUG default precisely so a
 * deliberate choice like this one is possible; this is that mechanism being used as intended.
 *
 * It only works when the backend writes somewhere this process can read, which means a local run.
 * Against a remote environment these two journeys are skipped rather than quietly passing.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const MAIL_DIR = process.env.E2E_MAIL_DIR || "";

export class MailUnavailable extends Error {}

/** True when a mail directory is configured and exists, so the link-reading journeys can run. */
export function mailReadable() {
  return Boolean(MAIL_DIR) && existsSync(MAIL_DIR);
}

function messageFiles() {
  if (!mailReadable()) {
    throw new MailUnavailable(
      `No readable mail directory. Set E2E_MAIL_DIR to the same path the backend was given as ` +
        `EMAIL_FILE_PATH, and run the backend with the file-based email backend. See e2e/README.md.`
    );
  }
  return readdirSync(MAIL_DIR)
    .map((name) => join(MAIL_DIR, name))
    .filter((path) => statSync(path).isFile())
    .map((path) => ({ path, at: statSync(path).mtimeMs }))
    .sort((a, b) => b.at - a.at); // newest first
}

/**
 * The decoded body of a message file.
 *
 * Long URLs are the whole point of reading these, and a mail body is allowed to arrive encoded —
 * quoted-printable folds lines with a trailing `=`, base64 encodes the lot. Decoding both is
 * cheaper than debugging a token that is silently truncated at column 76.
 */
function bodyOf(path) {
  const raw = readFileSync(path, "utf8");
  const encoding = (raw.match(/^Content-Transfer-Encoding:\s*(\S+)/im) || [])[1]?.toLowerCase();
  // Headers end at the first blank line; everything after is the body.
  const body = raw
    .split(/\r?\n\r?\n/)
    .slice(1)
    .join("\n\n");
  if (encoding === "base64") return Buffer.from(body, "base64").toString("utf8");
  if (encoding === "quoted-printable") {
    return body
      .replace(/=\r?\n/g, "") // soft line break: the line continues
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  return body;
}

/**
 * The most recent link matching `pathname` sent to `toEmail`.
 *
 * Polls, because the email is written while the HTTP request that triggered it is still finishing —
 * waiting for the file to exist is waiting for a fact. It never sleeps a fixed amount: TEST-06 says
 * flaky tests are fixed or deleted, and a fixed sleep is how they get written.
 */
export async function waitForLink(toEmail, pathname, { timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  const needle = toEmail.toLowerCase();
  let seen = 0;

  while (Date.now() < deadline) {
    const files = messageFiles();
    seen = files.length;
    for (const { path } of files) {
      const text = bodyOf(path) + readFileSync(path, "utf8");
      if (!text.toLowerCase().includes(needle)) continue;
      const link = (bodyOf(path).match(new RegExp(`https?://[^\\s<>"')]*${pathname}[^\\s<>"')]*`)) || [])[0];
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new MailUnavailable(
    `No email to ${toEmail} containing a ${pathname} link appeared in ${MAIL_DIR} within ` +
      `${timeoutMs}ms (${seen} message file(s) present).\n` +
      `If message files exist but none matched, the likely causes are: the backend is not using the ` +
      `file-based email backend, or EMAIL_HOST_USER / EMAIL_HOST_PASSWORD are blank so the sender ` +
      `skipped silently (see src/accounts/infrastructure/email_client.py, which logs a warning and ` +
      `sends nothing when email is not configured).`
  );
}

/**
 * Waits for a message to `toEmail` whose decoded text matches `pattern` (a RegExp), and returns that text. For emails a journey must see sent
 * that carry no link: the advisor's "new booking request", the client's "confirmed".
 */
export async function waitForMessage(toEmail, pattern, { timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  const needle = toEmail.toLowerCase();
  while (Date.now() < deadline) {
    for (const { path } of messageFiles()) {
      const raw = readFileSync(path, "utf8");
      if (!raw.toLowerCase().includes(needle)) continue;
      const text = `${raw}\n${bodyOf(path)}`;
      if (pattern.test(text)) return text;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new MailUnavailable(`No email to ${toEmail} matching ${pattern} appeared in ${MAIL_DIR} within ${timeoutMs}ms.`);
}

/** Empties nothing and deletes nothing: reads the current message count, for assertions about sends. */
export function messageCount() {
  return mailReadable() ? messageFiles().length : 0;
}
