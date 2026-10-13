/**
 * TEST-06 — the end-to-end smoke suite (SCRUM-58).
 *
 * The journeys are in `e2e/`. Where they run is decided by `e2e/support/target.js`, which refuses
 * to point this suite at anything serving real users; that check runs here, at config load, so a
 * bad target fails before a browser starts rather than after it has registered an account.
 *
 * TWO CHOICES WORTH DEFENDING, both from this story's own acceptance criteria:
 *
 * `retries: 0`. The criterion is "flaky tests are fixed or deleted, never retried until they pass",
 * and retries are how that rule gets quietly broken — a suite that passes on the second attempt
 * reports green while telling you nothing. If something here is flaky it is a bug in the test or in
 * the application, and both are worth knowing about. This already came up elsewhere in the project:
 * a fixed `sleep` in the AI concurrency tests failed once under load and cost three full suite runs
 * to prove it was the sleep and not a real defect. Browser suites are far worse for this, so every
 * wait in here waits for a condition and never for a duration.
 *
 * `fullyParallel`. The criterion is "completes in under five minutes". Each journey registers its
 * own account with a unique address and touches only its own data, so they do not interfere, and
 * running them one after another would spend the budget on page loads.
 */
import { defineConfig, devices } from "@playwright/test";
import { resolveBaseUrl, targetIsLocal } from "./e2e/support/target.js";

const baseURL = resolveBaseUrl();
const local = targetIsLocal(baseURL);

export default defineConfig({
  testDir: "./e2e",
  // The whole suite, not one test: the five-minute criterion is about the suite, and a run that
  // hangs should fail the build rather than occupy CI.
  globalTimeout: 5 * 60 * 1000,
  timeout: 60 * 1000,
  expect: { timeout: 10 * 1000 },
  fullyParallel: true,
  retries: 0,
  // One worker locally keeps the output readable while there are few journeys; raise it when there
  // are enough for the wall-clock time to matter.
  workers: process.env.CI ? 4 : 2,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  // Fail a CI run that contains a stray `test.only`, which would silently skip everything else.
  forbidOnly: Boolean(process.env.CI),

  use: {
    baseURL,
    // Artefacts only for failures: a passing suite should not fill the disk, and a failing one
    // should tell you what happened without a second run to reproduce it.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Only start a server when running against this machine. Against a deployed environment the
  // application is already there, and starting a second one would quietly test the wrong thing.
  webServer: local
    ? {
        command: "npm run dev -- --port 5173 --strictPort",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60 * 1000,
        stdout: "ignore",
        stderr: "pipe",
      }
    : undefined,
});
