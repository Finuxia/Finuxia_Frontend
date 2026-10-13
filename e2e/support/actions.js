/**
 * The handful of things every journey does. Kept here so a change to the sign-in form is one edit
 * rather than six, and so each spec reads as the journey it is testing rather than as form-filling.
 *
 * Selectors are by LABEL and by ROLE, never by CSS class. The classes in this app are Tailwind
 * utility strings that change whenever the design does; a test pinned to them fails on a restyle
 * and teaches people that the suite cries wolf. A label changing is a real change to what the user
 * sees, and a test noticing that is the test working.
 */
import { expect } from "@playwright/test";

/**
 * A fresh address per run, so a re-run never collides with the account the last one created.
 *
 * NOTE THE ABSENCE OF A `+`. The obvious way to write this is `e2e+<stamp>@example.com`, and it is
 * wrong here: the backend canonicalises a mailbox by lower-casing it and **stripping `+tag`** (and
 * Gmail dots) before deciding whether it has already had a free trial — see
 * `canonical_mailbox` in `src/accounts/domain/email_policy.py`, and DATA-07, which hashes that
 * canonical form so one inbox cannot take two trials.
 *
 * So every `e2e+anything@example.com` is ONE mailbox as far as the trial is concerned. With a `+`
 * here, the first ever run of this suite would pass and every run after it would register an
 * account that gets no trial, land on the subscribe gate instead of the application, and fail
 * somewhere that looks nothing like the cause. The stamp goes in the local part instead.
 */
export function uniqueEmail(prefix = "e2e") {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return `${prefix}-${stamp}@example.com`;
}

/** At least 12 characters: the register form enforces that client-side before it submits. */
export const PASSWORD = "e2e-Passw0rd-2026";

export async function register(page, { name, email, password = PASSWORD }) {
  await page.goto("/register");
  await page.getByLabel("Full Name").fill(name);
  await page.getByLabel("Email").fill(email);
  // Exact, or this also matches "Confirm Password".
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
}

export async function signIn(page, { identifier, password = PASSWORD }) {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
}

/**
 * Waits for the signed-in shell rather than for a URL, because the app lands on /dashboard before
 * it knows anything about the account — including whether the address is confirmed, which decides
 * whether the application or a gate is shown. Asserting on something the user can actually see is
 * what makes the next step reliable without a sleep.
 */
export async function expectSignedIn(page) {
  await expect(page.getByRole("navigation")).toBeVisible({ timeout: 25000 });
}

export async function expectSignedOut(page) {
  await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
}

/**
 * The gate an account sees before it has confirmed its address. Worth asserting rather than
 * stepping over: it is the only thing stopping an unverified address from using the product.
 */
export async function expectEmailGate(page) {
  await expect(page.getByRole("heading", { name: /confirm your email/i })).toBeVisible({ timeout: 25000 });
}

/**
 * Signs out through the avatar menu.
 *
 * The avatar is found by the account's own name: the button carries `title={user.name}`, which is
 * its accessible name. Its visible text is only the first initial, and the menu is rendered through
 * a portal outside the `<nav>` landmark, so neither the text nor the navigation is a reliable way in.
 * (FE-05, SCRUM-48, adds accessible menu primitives; when that lands this can get a real label.)
 */
export async function signOut(page, name) {
  await page.getByTitle(name, { exact: true }).click();
  await page.getByRole("button", { name: /log ?out/i }).click();
  await expectSignedOut(page);
}
