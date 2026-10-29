/**
 * TEST-06 journey 3: a client opens the advisor's public booking link, picks a slot and asks for it; the advisor approves it.
 *
 * It crosses the public, signed-out side (no account, the link's slug is the only way in, the slots the server works out from the advisor's
 * hours and timezone, the request with its 409 on a taken slot) and the advisor's signed-in queue, and the two emails in between: the advisor is
 * told about the request, and the client is told it is confirmed. No calendar is connected, so the request waits for the advisor rather than
 * confirming itself, which is the path most advisors take.
 *
 * The link and the hours are set up through the API (support/api.js): this journey is about booking, not about the link form.
 */
import { expect, test } from "@playwright/test";
import { apiCall } from "./support/api.js";
import { registerConfirmed, uniqueEmail } from "./support/actions.js";
import { mailReadable, waitForLink, waitForMessage } from "./support/mail.js";

const ADVISOR = "Bea Bookwell";
const CLIENT = "Casey Clientson";
const EVERY_DAY = Object.fromEntries(["0", "1", "2", "3", "4", "5", "6"].map((day) => [day, [{ start: "09:00", end: "17:00" }]]));

test.describe("a public booking", () => {
  test.skip(!mailReadable(), "needs E2E_MAIL_DIR: the advisor's account has to be confirmed by email first");

  test("a client requests a slot from the link, and the advisor approves it", async ({ page, browser }) => {
    const advisorEmail = uniqueEmail("booking-advisor");
    const clientEmail = uniqueEmail("booking-client");
    let slug;

    await test.step("an advisor with working hours and a booking link", async () => {
      await registerConfirmed(page, { name: ADVISOR, email: advisorEmail, waitForLink });
      // Every day 09:00-17:00 UTC, so tomorrow always has bookable slots whatever day and time the suite runs.
      await apiCall(page, "PUT", "/api/booking/availability", { weeklyHours: EVERY_DAY, timezone: "UTC" });
      const link = await apiCall(page, "POST", "/api/booking/links", {
        title: "Intro call",
        durationMinutes: 30,
        locationType: "phone",
        locationValue: "",
      });
      slug = link.slug;
      expect(slug).toBeTruthy();
    });

    // The client is a different person on a different browser: a fresh context with no cookies at all.
    const visitor = await browser.newContext();
    const client = await visitor.newPage();
    try {
      await test.step("the client opens the link without an account and picks a time", async () => {
        await client.goto(`/book/${slug}`);
        await expect(client.getByRole("heading", { name: "Intro call" })).toBeVisible();
        await expect(client.getByText(`with ${ADVISOR}`)).toBeVisible();
        await client.getByRole("button", { name: "Next day" }).click();
        // A slot button is enabled only when the server says it is available; a disabled one is shown crossed out.
        const slot = client
          .locator("button:not([disabled])")
          .filter({ hasText: /\d{1,2}:\d{2}\s?(am|pm)/i })
          .first();
        await expect(slot).toBeVisible({ timeout: 15000 });
        await slot.click();
      });

      await test.step("and asks for it", async () => {
        await client.getByLabel("Your name").fill(CLIENT);
        await client.getByLabel("Email", { exact: true }).fill(clientEmail);
        await client.getByRole("button", { name: /^Request / }).click();
        await expect(client.getByRole("heading", { name: "Request sent!" })).toBeVisible({ timeout: 15000 });
        await expect(client.getByText(`${ADVISOR} will confirm this time shortly.`)).toBeVisible();
      });
    } finally {
      await visitor.close();
    }

    await test.step("the advisor is told by email", async () => {
      await waitForMessage(advisorEmail, new RegExp(CLIENT));
    });

    await test.step("the request waits in the advisor's queue, and approving it confirms it", async () => {
      await page.goto("/booking-requests");
      const card = page
        .locator("div")
        .filter({ hasText: CLIENT })
        .filter({ has: page.getByRole("button", { name: "Approve" }) })
        .last();
      await expect(card).toBeVisible({ timeout: 25000 });
      await card.getByRole("button", { name: "Approve" }).click();
      await expect(page.getByText(/^Confirmed/).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    });

    await test.step("and the client is told it is confirmed", async () => {
      await waitForMessage(clientEmail, /confirm/i);
    });
  });
});
