/**
 * TEST-06 journey 5: use an AI feature until the money for it runs out, see the blocked state, add credit, and carry on.
 *
 * The feature is the document suggestion (Documents → Submit Document → "Suggest topic, summary & keywords with AI"). Everything under it is real:
 * the plan's AI grant, the hold taken on the wallet before the call, the call, settling it, the 402 when the wallet cannot cover the next one,
 * the notice the page shows instead of an error, and the top-up that unblocks it. Only the provider is a stand-in: the local `e2e-api` points
 * AI_BASE_URL at `e2e-ai-stub` (Finuxia_Backend/scripts/e2e_ai_stub.py), so no real key, call or cost is involved.
 *
 * No plan includes an allowance of AI credits today, so AI is paid from the wallet, which every account starts with $10 in. `e2e-api` prices a
 * call at roughly $1.50-$1.80 (AI_CHARGE_MARKUP_PERCENT), so the wallet runs out after five or six calls rather than thousands.
 *
 * LOCAL ONLY. Against any other target this would spend real AI money and need a real card, so it is skipped there.
 */
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { apiCall } from "./support/api.js";
import { registerConfirmed, uniqueEmail } from "./support/actions.js";
import { mailReadable, waitForLink } from "./support/mail.js";
import { resolveBaseUrl, targetIsLocal } from "./support/target.js";

const ADVISOR = "Ari Aitester";
const PDF = fileURLToPath(new URL("./fixtures/client-guide.pdf", import.meta.url));
const SUGGESTED_TOPIC = "Retirement planning guide"; // what the stand-in provider answers
const MAX_CALLS = 10; // under the 20-an-hour AI rate limit, with room for the calls after the top-up

async function openSuggestion(page) {
  await page.goto("/documents");
  await page.getByRole("button", { name: "Submit Document" }).click();
  await page.locator('input[type="file"]').setInputFiles(PDF);
  return {
    suggest: page.getByRole("button", { name: "Suggest topic, summary & keywords with AI" }),
    topic: page.getByLabel("Topic"),
    blocked: page.getByRole("alert").filter({ hasText: /wallet balance/i }),
  };
}

/** One suggestion: true if it filled the topic, false if the page showed the blocked notice instead. */
async function suggestOnce({ suggest, topic, blocked }) {
  await topic.fill("");
  await suggest.click();
  let outcome;
  await expect(async () => {
    if ((await topic.inputValue()) === SUGGESTED_TOPIC) outcome = true;
    else if (await blocked.isVisible()) outcome = false;
    expect(outcome, "neither a suggestion nor the blocked notice").not.toBeUndefined();
  }).toPass({ timeout: 20000 });
  return outcome;
}

async function walletCents(page) {
  const usage = await apiCall(page, "GET", "/api/billing/ai-usage");
  return usage.wallet.balanceCents;
}

test.describe("AI credit running out", () => {
  test.skip(!targetIsLocal(resolveBaseUrl()), "local only: anywhere else this spends real AI money");
  test.skip(!mailReadable(), "needs E2E_MAIL_DIR: the account has to be confirmed by email first");

  test("an advisor uses the document suggestion until the wallet is empty, adds credit, and can use it again", async ({ page }) => {
    await test.step("an advisor on a plan with AI (a test purchase: billing is in demo mode)", async () => {
      await registerConfirmed(page, { name: ADVISOR, email: uniqueEmail("ai-quota"), waitForLink });
      const { plans } = await apiCall(page, "GET", "/api/billing/plans");
      const professional = plans.find((p) => p.key === "professional");
      expect(professional, "the seeded Professional plan, which grants AI").toBeTruthy();
      // The trial is running, so moving to another plan is a plan change: preview it, then confirm what was shown, as the dialog does.
      const preview = await apiCall(page, "GET", `/api/billing/plan-change/preview?planId=${professional.id}`);
      await apiCall(page, "POST", "/api/billing/plan-change", {
        planId: professional.id,
        expectedAmountCents: preview.amountDueCents,
        expectedCurrency: preview.currency,
      });
    });

    let succeeded = 0;
    await test.step("the suggestion works until the wallet cannot pay for another, and then the page says so", async () => {
      const start = await walletCents(page);
      expect(start, "a new account's starting wallet").toBeGreaterThan(0);
      const modal = await openSuggestion(page);
      let blocked = false;
      for (let call = 0; call < MAX_CALLS - 2 && !blocked; call += 1) {
        if (await suggestOnce(modal)) succeeded += 1;
        else blocked = true;
      }
      expect(succeeded, "the starting wallet paid for at least one suggestion").toBeGreaterThan(0);
      expect(blocked, `still not blocked after ${succeeded} suggestions`).toBe(true);
      // Charged for what it used, and never into the red: each call is held before it runs.
      const left = await walletCents(page);
      expect(left).toBeLessThan(start);
      expect(left).toBeGreaterThanOrEqual(0);
      await expect(modal.blocked.getByRole("link", { name: "Add credit" })).toBeVisible();
    });

    await test.step("the notice's way out: adding credit", async () => {
      await page.getByRole("link", { name: "Add credit" }).click();
      await expect(page).toHaveURL(/\/profile\?tab=ai-usage/);
      await page.getByRole("button", { name: "Add $5.00" }).click();
      await expect(page.getByText(/Added \$5\.00 to your AI wallet/)).toBeVisible({ timeout: 15000 });
    });

    await test.step("and the suggestion works again", async () => {
      expect(await suggestOnce(await openSuggestion(page))).toBe(true);
    });
  });
});
