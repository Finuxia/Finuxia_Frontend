import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { API, testBilling, testUser } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, waitFor } from "../test/utils";
import Layout from "./Layout";

const inDays = (n) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + n).toISOString();
};
const show = (billingOver = {}, userOver = {}) => {
  server.use(
    http.get(`${API}/api/auth/me`, () => HttpResponse.json({ user: { ...testUser, subscriptionUntil: inDays(3), ...userOver } })),
    http.get(`${API}/api/billing/me`, () => HttpResponse.json({ ...testBilling, ...billingOver }))
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

describe("the trial countdown in the layout", () => {
  it("shows in the last week of the trial", async () => {
    show();
    expect(await screen.findByTestId("trial-banner")).toHaveTextContent("Your free trial ends in 3 days.");
  });

  it("stops once the customer has said they do not intend to continue", async () => {
    show({ notContinuingSince: "2026-10-01T10:00:00Z" });
    expect(await screen.findByText("the page")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("trial-banner")).not.toBeInTheDocument());
  });
});
