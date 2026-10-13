import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import { purchaseConfirmed } from "../lib/checkout";
import { API, testBilling, testUser } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import PaymentReturn from "./PaymentReturn";

const payment = (over = {}) => ({
  id: 9,
  date: "2026-06-01T12:00:00+00:00",
  planName: "Professional",
  amountCents: 4900,
  currency: "usd",
  amountDisplay: "49.00 USD",
  status: "succeeded",
  isMock: false,
  accessWindow: { start: "2026-06-01T12:00:00+00:00", end: "2026-07-01T12:00:00+00:00" },
  receiptNumber: "R-00000009",
  receiptAvailable: true,
  ...over,
});
const pending = payment({ status: "pending", receiptNumber: null, receiptAvailable: false, accessWindow: null });
const paid = payment();
const pro = { ...testBilling, plan: { key: "professional", name: "Professional", priceCents: 4900 }, status: "active" };

/** The server's answers to "what is the newest payment?", one per ask; the last one repeats. */
function ledgerSequence(...answers) {
  const calls = { n: 0, limits: [] };
  server.use(
    http.get(`${API}/api/billing/me`, () => HttpResponse.json(pro)),
    http.get(`${API}/api/billing/payments`, ({ request }) => {
      calls.limits.push(new URL(request.url).searchParams.get("limit"));
      const answer = answers[Math.min(calls.n, answers.length - 1)];
      calls.n += 1;
      if (answer === "error") return HttpResponse.error();
      return HttpResponse.json({ results: answer ? [answer] : [], nextCursor: null });
    })
  );
  return calls;
}

function App(props) {
  return (
    <Routes>
      <Route
        path="/billing/success"
        element={
          <ProtectedRoute>
            <PaymentReturn outcome="success" intervalMs={20} maxAttempts={4} {...props} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/cancel"
        element={
          <ProtectedRoute>
            <PaymentReturn outcome="cancel" />
          </ProtectedRoute>
        }
      />
      <Route path="/billing" element={<p>plans page</p>} />
      <Route path="/dashboard" element={<p>dashboard page</p>} />
    </Routes>
  );
}
const render = (route, props) => renderWithProviders(<App {...props} />, { route, providers: ["router", "toast", "auth"] });

describe("the success page", () => {
  it("confirms only after the SERVER's ledger shows the newest payment as paid, polling until it does", async () => {
    const calls = ledgerSequence(pending, pending, pending, paid);
    render("/billing/success");
    expect(await screen.findByText("Confirming your payment…")).toBeInTheDocument();
    expect(screen.queryByText("You're all set")).not.toBeInTheDocument();
    expect(await screen.findByText("You're all set")).toBeInTheDocument();
    expect(screen.getByText(/now on Professional/)).toBeInTheDocument();
    expect(calls.n).toBeGreaterThanOrEqual(4); // it kept asking until the server agreed
    expect([...new Set(calls.limits)]).toEqual(["1"]); // and only ever asks for the newest payment
    await userEvent.click(screen.getByRole("link", { name: "Continue to the app" }));
    expect(await screen.findByText("dashboard page")).toBeInTheDocument();
  });

  it("works the same for someone who bought the plan they are already on: it watches the payment, not the plan", async () => {
    ledgerSequence(pending, paid); // the billing status says Professional the whole time
    render("/billing/success");
    expect(await screen.findByText("You're all set")).toBeInTheDocument();
  });

  it("never trusts a success flag in the URL: the ledger still shows the payment waiting, so nothing is confirmed", async () => {
    ledgerSequence(pending);
    render("/billing/success?checkout=success&success=true&status=paid&session_id=cs_test_123");
    expect(await screen.findByText("We haven't received confirmation yet")).toBeInTheDocument();
    expect(screen.queryByText("You're all set")).not.toBeInTheDocument();
    expect(screen.queryByText(/payment is confirmed/)).not.toBeInTheDocument();
  });

  it("opening the success URL by hand, with no payment at all, confirms nothing", async () => {
    ledgerSequence(null);
    render("/billing/success");
    expect(await screen.findByText("We haven't received confirmation yet")).toBeInTheDocument();
  });

  it("a failed payment is not 'confirmed'", async () => {
    ledgerSequence(payment({ status: "failed" }));
    render("/billing/success");
    expect(await screen.findByText("We haven't received confirmation yet")).toBeInTheDocument();
  });

  it("when time runs out it says so, tells the customer not to pay again, and can check again", async () => {
    const calls = ledgerSequence(pending, pending, pending, pending, pending, paid);
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
    ledgerSequence("error");
    render("/billing/success");
    expect(await screen.findByText(/couldn't reach the server/)).toBeInTheDocument();
    expect(screen.queryByText("You're all set")).not.toBeInTheDocument();
  });

  it("stops polling when the page is left", async () => {
    const calls = ledgerSequence(pending);
    const { unmount } = render("/billing/success", { intervalMs: 30, maxAttempts: 50 });
    await waitFor(() => expect(calls.n).toBeGreaterThanOrEqual(2));
    unmount();
    const seen = calls.n;
    await new Promise((r) => setTimeout(r, 200));
    expect(calls.n).toBeLessThanOrEqual(seen + 1);
  });

  it("is reachable by an account whose access has ended: it is not bounced to the subscribe page", async () => {
    server.use(http.get(`${API}/api/auth/me`, () => HttpResponse.json({ user: { ...testUser, subscriptionActive: false } })));
    ledgerSequence(paid);
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
    ledgerSequence(pending);
    render("/billing/cancel?checkout=success");
    expect(await screen.findByText("Checkout cancelled")).toBeInTheDocument();
    expect(await screen.findByText(/you're on Professional/)).toBeInTheDocument();
    expect(screen.queryByText("You're all set")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Back to plans" }));
    expect(await screen.findByText("plans page")).toBeInTheDocument();
  });
});

describe("purchaseConfirmed", () => {
  it.each([
    [paid, true],
    [pending, false],
    [payment({ status: "failed" }), false],
    [payment({ status: "expired" }), false],
    [payment({ status: "refunded" }), false],
    [payment({ isMock: true }), false], // a demo purchase moved no money
    [null, false],
    [undefined, false],
  ])("%j -> %s", (newest, expected) => {
    expect(purchaseConfirmed(newest)).toBe(expected);
  });
});
