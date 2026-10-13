import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { API, testBilling, testUser } from "../../test/handlers";
import { server } from "../../test/server";
import { renderWithProviders, screen, waitFor } from "../../test/utils";
import Layout from "./Layout";

const inDays = (n) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + n).toISOString();
};

const access = (over) => ({ status: "lapsing", warning: "soon", endsAt: inDays(3), daysLeft: 3, valid: true, warnDays: 14, ...over });

const show = (billingOver = {}) => {
  server.use(
    http.get(`${API}/api/auth/me`, () => HttpResponse.json({ user: testUser })),
    http.get(`${API}/api/billing/me`, () => HttpResponse.json({ ...testBilling, access: access(), ...billingOver }))
  );
  return renderWithProviders(
    <Routes>
      <Route element={<Layout />}>
        <Route path="/page" element={<p>the page</p>} />
      </Route>
    </Routes>,
    { route: "/page" }
  );
};

/**
 * The warning line across the top of every signed-in page. This replaced a trial-only countdown that worked out the days
 * in the browser from the account's end date; the banner now shows whatever the server says needs saying, so it covers
 * access running out on a paid plan too, not just a trial ending.
 */
describe("the access warning in the layout", () => {
  it("shows when the server says access is close to its end", async () => {
    show();
    expect(await screen.findByTestId("access-banner")).toHaveTextContent("Your access ends in 3 days");
  });

  it("says nothing while there is nothing to warn about", async () => {
    show({ access: access({ status: "valid", warning: "none", daysLeft: 200, endsAt: inDays(200) }) });
    expect(await screen.findByText("the page")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("access-banner")).not.toBeInTheDocument());
  });

  it("stops once the customer has said they do not intend to continue", async () => {
    show({ notContinuingSince: "2026-10-01T10:00:00Z" });
    expect(await screen.findByText("the page")).toBeInTheDocument();
    // Carried over from the banner this replaces: someone who has told us they are not continuing is not
    // waiting to be reminded, so the countdown would be nagging rather than helping.
    await waitFor(() => expect(screen.queryByTestId("access-banner")).not.toBeInTheDocument());
  });
});
