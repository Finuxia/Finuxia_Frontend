import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API, testBilling } from "../../test/handlers";
import { server } from "../../test/server";
import { renderWithProviders, screen, waitFor } from "../../test/utils";
import AccessBanner from "./AccessBanner";

const access = (over) => ({
  status: "valid",
  warning: "none",
  endsAt: "2026-12-15T12:00:00",
  daysLeft: 60,
  valid: true,
  warnDays: 14,
  ...over,
});
const show = (summary) => {
  server.use(http.get(`${API}/api/billing/me`, () => HttpResponse.json({ ...testBilling, access: summary })));
  return renderWithProviders(<AccessBanner />, { providers: ["router", "toast", "auth"] });
};

describe("the access banner", () => {
  it("is not there while access is comfortably valid", async () => {
    show(access());
    await waitFor(() => expect(document.body).toBeTruthy());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("access-banner")).not.toBeInTheDocument();
  });

  it("is not there when access has no end, or the server sent no summary", async () => {
    show(access({ status: "unlimited", endsAt: null, daysLeft: null }));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("access-banner")).not.toBeInTheDocument();
  });

  it("warns with the date and a way to buy when the end is near", async () => {
    show(access({ status: "lapsing", warning: "soon", daysLeft: 9 }));
    const banner = await screen.findByTestId("access-banner");
    expect(banner).toHaveTextContent("Your access ends in 9 days, on December 15, 2026.");
    expect(screen.getByRole("link", { name: "Buy a plan" })).toHaveAttribute("href", "/billing");
  });

  it("is louder when it is urgent", async () => {
    show(access({ status: "lapsing", warning: "urgent", daysLeft: 1 }));
    const banner = await screen.findByTestId("access-banner");
    expect(banner.className).toMatch(/text-av-red/);
    expect(banner).toHaveTextContent("Your access ends in 1 day");
  });

  it("says so when access has ended (for an account that still gets in, such as staff)", async () => {
    show(access({ status: "lapsed", warning: "ended", daysLeft: 0 }));
    expect(await screen.findByTestId("access-banner")).toHaveTextContent("Your access ended on December 15, 2026.");
  });
});
