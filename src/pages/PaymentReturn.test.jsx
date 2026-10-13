import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import ProtectedRoute from "../components/ProtectedRoute";
import { purchaseConfirmed, rememberPlanBeforeCheckout } from "../lib/checkout";
import { API, testBilling, testUser } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import PaymentReturn from "./PaymentReturn";

const starter = { plan: { key: "starter", name: "Starter", priceCents: 0 }, status: "active", moduleKeys: [], currentPeriodEnd: null };
const pro = { ...testBilling, plan: { key: "professional", name: "Professional", priceCents: 4900 }, status: "active" };

function billingSequence(...answers) {
  const calls = { n: 0 };
  server.use(
    http.get(`${API}/api/billing/me`, () => {
      const answer = answers[Math.min(calls.n, answers.length - 1)];
      calls.n += 1;
      return answer === "error" ? HttpResponse.error() : HttpResponse.json(answer);
    })
  );
  return calls;
}

function App(props) {
  return (
    <Routes>
      <Route path="/billing/success" element={<ProtectedRoute><PaymentReturn outcome="success" intervalMs={20} maxAttempts={4} {...props} /></ProtectedRoute>} />
      <Route path="/billing/cancel" element={<ProtectedRoute><PaymentReturn outcome="cancel" /></ProtectedRoute>} />
      <Route path="/billing" element={<p>plans page</p>} />
      <Route path="/dashboard" element={<p>dashboard page</p>} />
    </Routes>
  );
}
const render = (route, props) => renderWithProviders(<App {...props} />, { route, providers: ["router", "toast", "auth"] });

beforeEach(() => sessionStorage.clear());

describe("the success page", () => {
  it("confirms only after the SERVER shows the new paid plan, polling until it does", async () => {
    rememberPlanBeforeCheckout("starter");
    const calls = billingSequence(starter, starter, starter, pro);
    render("/billing/success");
    expect(await screen.findByText("Confirming your payment…")).toBeInTheDocument();
    expect(screen.queryByText("You're all set")).not.toBeInTheDocument();
    expect(await screen.findByText("You're all set")).toBeInTheDocument();
    expect(screen.getByText(/now on Professional/)).toBeInTheDocument();
    expect(calls.n).toBeGreaterThanOrEqual(4); // it kept asking until the server agreed
    await userEvent.click(screen.getByRole("link", { name: "Continue to the app" }));
    expect(await screen.findByText("dashboard page")).toBeInTheDocument();
  });

  it("never trusts a success flag in the URL: the server still says Starter, so nothing is confirmed", async () => {
    rememberPlanBeforeCheckout("starter");
    billingSequence(starter);
    render("/billing/success?checkout=success&success=true&status=paid&session_id=cs_test_123");
    expect(await screen.findByText("We haven't received confirmation yet")).toBeInTheDocument();
    expect(screen.queryByText("You're all set")).not.toBeInTheDocument();
    expect(screen.queryByText(/payment is confirmed/)).not.toBeInTheDocument();
  });

  it("opening the success URL by hand, with no purchase, confirms nothing", async () => {
    billingSequence(starter);
    render("/billing/success");
    expect(await screen.findByText("We haven't received confirmation yet")).toBeInTheDocument();
  });

  it("an account that was already on that paid plan is not 'confirmed' by it", async () => {
    rememberPlanBeforeCheckout("professional");
    billingSequence(pro);
    render("/billing/success");
    expect(await screen.findByText("We haven't received confirmation yet")).toBeInTheDocument();
  });

  it("when time runs out it says so, tells the customer not to pay again, and can check again", async () => {
    rememberPlanBeforeCheckout("starter");
    const calls = billingSequence(starter, starter, starter, starter, starter, pro);
    render("/billing/success");
    expect(await screen.findByText("We haven't received confirmation yet")).toBeInTheDocument();
    expect(screen.getByText(/Please don't pay again/)).toBeInTheDocument();
    const asked = calls.n;
    await new Promise((r) => setTimeout(r, 150));
    expect(calls.n).toBe(asked); // it stopped asking at the limit: no endless polling
    await userEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByText("You're all set")).toBeInTheDocument();
  });

  it("says it could not reach the server, rather than failing or claiming anything", async () => {
    rememberPlanBeforeCheckout("starter");
    billingSequence("error");
    render("/billing/success");
    expect(await screen.findByText(/couldn't reach the server/)).toBeInTheDocument();
    expect(screen.queryByText("You're all set")).not.toBeInTheDocument();
  });

  it("stops polling when the page is left", async () => {
    rememberPlanBeforeCheckout("starter");
    const calls = billingSequence(starter);
    const { unmount } = render("/billing/success", { intervalMs: 30, maxAttempts: 50 });
    await waitFor(() => expect(calls.n).toBeGreaterThanOrEqual(2));
    unmount();
    const seen = calls.n;
    await new Promise((r) => setTimeout(r, 200));
    expect(calls.n).toBeLessThanOrEqual(seen + 1);
  });

  it("is reachable by an account whose trial has ended: it is not bounced to the subscribe page", async () => {
    server.use(http.get(`${API}/api/auth/me`, () => HttpResponse.json({ user: { ...testUser, subscriptionActive: false } })));
    rememberPlanBeforeCheckout("starter");
    billingSequence(pro);
    render("/billing/success");
    expect(await screen.findByText("You're all set")).toBeInTheDocument();
  });

  it("needs a login, like every other page of the account", async () => {
    server.use(
      http.get(`${API}/api/auth/me`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 }))
    );
    render("/billing/success");
    await waitFor(() => expect(screen.queryByText("Confirming your payment…")).not.toBeInTheDocument());
    expect(screen.queryByText("You're all set")).not.toBeInTheDocument();
  });
});

describe("the cancel page", () => {
  it("reports what the server says about the plan, and does not claim a purchase", async () => {
    billingSequence(starter);
    render("/billing/cancel?checkout=success");
    expect(await screen.findByText("Checkout cancelled")).toBeInTheDocument();
    expect(await screen.findByText(/you're on Starter/)).toBeInTheDocument();
    expect(screen.queryByText("You're all set")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Back to plans" }));
    expect(await screen.findByText("plans page")).toBeInTheDocument();
  });
});

describe("purchaseConfirmed", () => {
  it.each([
    [pro, "starter", true],
    [pro, null, true], // opened in another tab: any active paid plan
    [pro, "professional", false],
    [starter, "starter", false],
    [starter, null, false], // a free plan is not a purchase
    [{ ...pro, status: "past_due" }, "starter", false],
    [{ ...pro, status: "canceled" }, "starter", false],
    [null, "starter", false],
    [{ status: "active" }, "starter", false],
  ])("%j before=%s -> %s", (status, before, expected) => {
    expect(purchaseConfirmed(status, before)).toBe(expected);
  });
});
