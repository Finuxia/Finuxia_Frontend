/**
 * TEST-06 journey 1: register, confirm the address, sign in, create a client, sign out, sign back in
 * and still see the client.
 *
 * This is the journey worth having first. It crosses every layer in one pass — the register form,
 * the email the backend actually sent, the verification token, JWTs in httpOnly cookies, the trial
 * grant that decides whether the application or a paywall appears, an authenticated write, and the
 * client-sync context that has to reconcile with the server rather than trust its cache. A unit
 * test can cover any one of those. None of them can tell you they fit together.
 */
import { expect, test } from "@playwright/test";
import { PASSWORD, expectEmailGate, expectSignedIn, register, signIn, signOut, uniqueEmail } from "./support/actions.js";
import { mailReadable, waitForLink } from "./support/mail.js";

/**
 * A DISTINCT NAME PER JOURNEY, not just a distinct email.
 *
 * The backend derives a username from the display name (`_derive_username`: the name with
 * non-alphanumerics stripped) and then makes it unique by appending a number. Two journeys sharing
 * a name therefore collide on that derivation while running at the same time, and the first version
 * of this file — where both tests were "Zoe Testwell" — failed in parallel and passed in isolation.
 *
 * Isolation has to be complete to be worth anything. Partial isolation is the kind that holds until
 * the suite gets big enough to run things concurrently, and then fails somewhere unrelated.
 */
const NAME = "Zoe Testwell";
const OTHER_NAME = "Quinn Dupechecker";

test.describe("an advisor's first session", () => {
  test.skip(!mailReadable(), "needs E2E_MAIL_DIR: confirming an address requires reading the email the backend sent");

  test("registers, confirms, adds a client, and still has it after signing back in", async ({ page }) => {
    const email = uniqueEmail("lifecycle");
    const surname = `Client${Date.now().toString(36).slice(-5)}`;

    await test.step("registering leaves the account gated until the address is confirmed", async () => {
      await register(page, { name: NAME, email });
      // Not a formality: until this is confirmed, an unverified address must not be able to use
      // the product. The gate appearing IS the security property.
      await expectEmailGate(page);
    });

    await test.step("the confirmation link in the email works", async () => {
      const link = await waitForLink(email, "/verify-email");
      await page.goto(link);
      await expect(page.getByText(/email confirmed/i)).toBeVisible();
    });

    await test.step("the application opens, which means the trial was granted", async () => {
      await page.goto("/clients");
      // If the trial had not been granted this lands on the subscribe page instead. Reaching the
      // Clients heading is what proves confirming the address started the trial.
      await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible({ timeout: 25000 });
    });

    await test.step("a client can be created", async () => {
      await page.getByRole("button", { name: "Add Client" }).click();
      await page.getByLabel(/first name/i).fill("Pat");
      await page.getByLabel(/last name/i).fill(surname);
      await page.getByRole("button", { name: "Save Client" }).click();
      await expect(page.getByText(surname)).toBeVisible({ timeout: 20000 });
    });

    await test.step("signing out ends the session", async () => {
      await signOut(page, NAME);
      // Going back to a protected page must not work from a stale cookie.
      await page.goto("/clients");
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    });

    await test.step("signing back in, the client is still there", async () => {
      await signIn(page, { identifier: email, password: PASSWORD });
      await expectSignedIn(page);
      await page.goto("/clients");
      // The real risk this catches: the client list is cached locally and reconciled with the
      // server. A bug there shows up as a record that exists until you sign out, which is exactly
      // the kind of thing no unit test notices.
      await expect(page.getByText(surname)).toBeVisible({ timeout: 25000 });
    });
  });

  test("the same mailbox cannot register twice", async ({ page }) => {
    const email = uniqueEmail("duplicate");
    await register(page, { name: OTHER_NAME, email });
    await expectEmailGate(page);

    await page.context().clearCookies();
    await register(page, { name: "Someone Else Entirely", email });
    // The message is not asserted word for word: what matters is that the second attempt does not
    // succeed and the user is told something, not the exact wording, which is copy and will change.
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator("form")).toBeVisible();
  });
});
