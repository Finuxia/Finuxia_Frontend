/**
 * TEST-06 journey 2: forgot password, reset, sign in with the new password.
 *
 * Worth its own journey because it is the one flow where a link in an email is a CREDENTIAL. The
 * things that can go wrong are not cosmetic: a token that works twice, a reset that does not
 * actually change the password, or an old password that keeps working afterwards. Each of those is
 * an account-takeover path, and each would pass a unit test of the form that submits it.
 */
import { expect, test } from "@playwright/test";
import { PASSWORD, expectEmailGate, expectSignedIn, register, signIn, uniqueEmail } from "./support/actions.js";
import { mailReadable, waitForLink } from "./support/mail.js";

const NAME = "Reset Testwell";
const NEW_PASSWORD = "e2e-Changed-Passw0rd-2026";

test.describe("resetting a forgotten password", () => {
  test.skip(!mailReadable(), "needs E2E_MAIL_DIR: the reset link only arrives by email");

  test("the emailed link sets a new password, the old one stops working, and the link cannot be reused", async ({ page }) => {
    const email = uniqueEmail("reset");

    await test.step("an account exists and its address is confirmed", async () => {
      await register(page, { name: NAME, email });
      await expectEmailGate(page);
      await page.goto(await waitForLink(email, "/verify-email"));
      await expect(page.getByText(/email confirmed/i)).toBeVisible();
      await page.context().clearCookies();
    });

    let link;
    await test.step("asking for a reset sends a link", async () => {
      await page.goto("/forgot-password");
      await page.getByLabel(/email/i).fill(email);
      await page
        .getByRole("button", { name: /send|reset/i })
        .first()
        .click();
      link = await waitForLink(email, "/reset-password");
    });

    await test.step("the link sets a new password", async () => {
      await page.goto(link);
      // Both fields, in order: the second is the confirmation.
      const fields = page.locator('input[type="password"]');
      await expect(fields.first()).toBeVisible({ timeout: 15000 });
      await fields.nth(0).fill(NEW_PASSWORD);
      if ((await fields.count()) > 1) await fields.nth(1).fill(NEW_PASSWORD);
      await page
        .getByRole("button", { name: /reset|set|save|change/i })
        .first()
        .click();
      await expect(page.getByText(/password|sign in|log in/i).first()).toBeVisible({ timeout: 15000 });
    });

    await test.step("the OLD password no longer works", async () => {
      await page.context().clearCookies();
      await signIn(page, { identifier: email, password: PASSWORD });
      // Still on the login page: a reset that leaves the old password working is the whole bug.
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
      await expect(page.getByRole("navigation")).toHaveCount(0);
    });

    await test.step("the NEW password works", async () => {
      await signIn(page, { identifier: email, password: NEW_PASSWORD });
      await expectSignedIn(page);
    });

    await test.step("the reset link cannot be used a second time", async () => {
      await page.context().clearCookies();
      await page.goto(link);
      // Either the form refuses it outright or submitting fails; what must NOT happen is a second
      // successful password change from one emailed token.
      const fields = page.locator('input[type="password"]');
      if (await fields.count()) {
        await fields.nth(0).fill("e2e-Third-Passw0rd-2026");
        if ((await fields.count()) > 1) await fields.nth(1).fill("e2e-Third-Passw0rd-2026");
        await page
          .getByRole("button", { name: /reset|set|save|change/i })
          .first()
          .click();
      }
      await page.context().clearCookies();
      await signIn(page, { identifier: email, password: "e2e-Third-Passw0rd-2026" });
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

      // And the password set by the first, legitimate use is still the live one.
      await signIn(page, { identifier: email, password: NEW_PASSWORD });
      await expectSignedIn(page);
    });
  });
});
