import { delay, http, HttpResponse } from "msw";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { API, testBilling, testUser } from "../test/handlers";
import { server } from "../test/server";
import { act, renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import Subscribe from "./Subscribe";

const inDays = (n) => new Date(Date.now() + n * 86400000 - 3600000).toISOString(); // a little under n days, so it counts as n
const plans = [
  {
    id: 0,
    key: "starter",
    name: "Starter",
    description: "Free",
    priceCents: 0,
    currency: "usd",
    interval: "month",
    modules: [{ key: "clients", name: "Client Pipeline" }],
  },
  {
    id: 1,
    key: "professional",
    name: "Professional",
    description: "For advisors",
    priceCents: 4900,
    currency: "usd",
    interval: "month",
    modules: [{ key: "documents", name: "Document Library" }],
  },
  {
    id: 2,
    key: "elite",
    name: "Elite",
    description: "Everything",
    priceCents: 9900,
    currency: "usd",
    interval: "month",
    modules: [{ key: "strategy_prep", name: "Strategy Prep" }],
  },
];
const accessEnding = (days) => ({
  status: "valid",
  warning: "none",
  endsAt: inDays(days),
  daysLeft: days,
  valid: true,
  warnDays: 14,
});
const starterBilling = (access) => ({
  ...testBilling,
  plan: { key: "starter", name: "Starter", priceCents: 0 },
  ...(access ? { access } : {}),
});
const catalogue = (over = {}) => ({ plans, stripeConfigured: true, purchasesOpen: true, supportEmail: "", ...over });
const realLocation = window.location;
let me;
let purchases;
let meReads;
let loggedOut;

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}
const show = () =>
  renderWithProviders(
    <Routes>
      <Route
        path="/subscribe"
        element={
          <>
            <Subscribe />
            <Where />
          </>
        }
      />
      <Route path="/dashboard" element={<Where />} />
      <Route path="/login" element={<Where />} />
    </Routes>,
    { route: "/subscribe", providers: ["router", "toast", "auth"] }
  );

function serve({
  user = {},
  catalog = catalogue(),
  billing = { ...testBilling, plan: { key: "starter", name: "Starter", priceCents: 0 } },
} = {}) {
  me = { ...testUser, ...user };
  purchases = [];
  meReads = 0;
  loggedOut = 0;
  server.use(
    http.get(`${API}/api/auth/me`, () => {
      meReads += 1;
      return HttpResponse.json({ user: me });
    }),
    http.get(`${API}/api/billing/me`, () => HttpResponse.json(billing)),
    http.get(`${API}/api/billing/plans`, () =>
      catalog === "error" ? HttpResponse.json({ error: "Could not load plans" }, { status: 500 }) : HttpResponse.json(catalog)
    ),
    http.post(`${API}/api/billing/purchase`, async ({ request }) => {
      purchases.push(await request.json());
      return HttpResponse.json({ checkoutUrl: "https://checkout.stripe.com/c/pay/abc" });
    })
  );
}

beforeEach(() => {
  sessionStorage.clear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...realLocation, origin: realLocation.origin, href: "http://localhost/subscribe" },
  });
});
afterEach(() => Object.defineProperty(window, "location", { configurable: true, value: realLocation }));

describe("a trial that is running", () => {
  it("shows the end date, the days left, and the way back into the app", async () => {
    serve({ user: { subscriptionActive: true, subscriptionUntil: inDays(12) }, billing: starterBilling(accessEnding(12)) });
    show();
    expect(await screen.findByRole("heading", { name: "You're on the free trial" })).toBeInTheDocument();
    expect(screen.getByText(/\(12 days left\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to the app" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/dashboard");
  });

  it("says '1 day' in the singular", async () => {
    serve({ user: { subscriptionActive: true, subscriptionUntil: inDays(1) }, billing: starterBilling(accessEnding(1)) });
    show();
    expect(await screen.findByText(/\(1 day left\)/)).toBeInTheDocument();
  });

  it("does not make up an end date when there is none", async () => {
    serve({ user: { subscriptionActive: true, subscriptionUntil: null } });
    show();
    expect(await screen.findByText(/Your access has no end date/)).toBeInTheDocument();
    expect(screen.queryByText(/days left/)).not.toBeInTheDocument();
  });

  it("offers the plans too, so a customer can subscribe before it ends", async () => {
    serve({ user: { subscriptionActive: true, subscriptionUntil: inDays(5) }, billing: starterBilling(accessEnding(5)) });
    show();
    expect(await screen.findAllByRole("button", { name: "Buy" })).toHaveLength(2);
  });
});

describe("a trial that has ended", () => {
  const ended = { subscriptionActive: false, subscriptionUntil: new Date(2026, 0, 5, 12).toISOString() };

  it("says what is lost and what subscribing restores, and that nothing was deleted", async () => {
    serve({ user: ended });
    show();
    expect(await screen.findByRole("heading", { name: "Your free trial has ended" })).toBeInTheDocument();
    expect(screen.getByText(/It ended on January 5, 2026/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Access to your clients, meetings, follow-ups and the rest of the app is paused\. Nothing you added has been deleted\./
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/everything switches back on right away/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to the app" })).not.toBeInTheDocument();
  });

  it("an account that has paid before is told its access ended, not that a trial did", async () => {
    serve({
      user: ended,
      billing: {
        ...testBilling,
        plan: { key: "professional", name: "Professional", priceCents: 4900 },
        status: "active",
        access: { status: "lapsed", warning: "ended", endsAt: ended.subscriptionUntil, daysLeft: 0, valid: false, warnDays: 14 },
      },
    });
    show();
    expect(await screen.findByRole("heading", { name: "Your access has ended" })).toBeInTheDocument();
    expect(screen.getByText(/It ended on January 5, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/don't renew by themselves/)).toBeInTheDocument();
  });

  it("shows what the account paid, with a receipt for each payment that went through, even though access has ended", async () => {
    serve({ user: ended });
    server.use(
      http.get(`${API}/api/billing/payments`, () =>
        HttpResponse.json({
          results: [
            {
              id: 11,
              date: new Date(2026, 0, 1, 12).toISOString(),
              planName: "Professional",
              amountCents: 4900,
              currency: "usd",
              amountDisplay: "49.00 USD",
              status: "succeeded",
              isMock: false,
              accessWindow: { start: new Date(2026, 0, 1, 12).toISOString(), end: new Date(2026, 0, 5, 12).toISOString() },
              receiptNumber: "R-00000011",
              receiptAvailable: true,
            },
            {
              id: 12,
              date: new Date(2026, 0, 3, 12).toISOString(),
              planName: "Elite",
              amountCents: 9900,
              currency: "usd",
              amountDisplay: "99.00 USD",
              status: "pending",
              isMock: false,
              accessWindow: null,
              receiptNumber: null,
              receiptAvailable: false,
            },
          ],
          nextCursor: null,
        })
      )
    );
    show();
    expect(await screen.findByRole("region", { name: "Your payments and receipts" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Download receipt R-00000011" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Download receipt/ })).toHaveLength(1); // the unpaid one has none
  });

  it("there is no mailto link to anyone: the way back is the plans", async () => {
    serve({ user: ended });
    show();
    await screen.findByRole("heading", { name: "Your free trial has ended" });
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });
});

describe("the plans and the real checkout", () => {
  it("shows the paid plans only: a free plan would not bring access back", async () => {
    serve({ user: { subscriptionActive: false } });
    show();
    expect(await screen.findByRole("heading", { name: "Professional" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Elite" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Starter" })).not.toBeInTheDocument();
    expect(screen.getByText("Strategy Prep")).toBeInTheDocument();
  });

  it("buying starts checkout with only the plan: no amount and no return address come from the browser", async () => {
    serve({ user: { subscriptionActive: false } });
    show();
    const subscribe = await screen.findAllByRole("button", { name: "Buy" });
    await userEvent.click(subscribe[1]);
    await waitFor(() => expect(window.location.href).toBe("https://checkout.stripe.com/c/pay/abc"));
    expect(purchases).toEqual([{ planId: 2 }]);
  });

  it("the buttons stay busy while the browser leaves, so it cannot be clicked twice", async () => {
    serve({ user: { subscriptionActive: false } });
    show();
    const subscribe = await screen.findAllByRole("button", { name: "Buy" });
    await userEvent.click(subscribe[0]);
    await waitFor(() => expect(window.location.href).toBe("https://checkout.stripe.com/c/pay/abc"));
    expect(screen.getByRole("button", { name: "Processing..." })).toBeDisabled();
    screen.getAllByRole("button", { name: "Buy" }).forEach((b) => expect(b).toBeDisabled());
  });

  describe("a purchase is one attempt, however many times it is sent", () => {
    /** Answers purchases with `statuses` in turn (then with checkout), and records the Idempotency-Key of each request. */
    function answerWith(...statuses) {
      const keys = [];
      server.use(
        http.post(`${API}/api/billing/purchase`, async ({ request }) => {
          keys.push(request.headers.get("idempotency-key"));
          await delay(30);
          const status = statuses.shift();
          if (status) return HttpResponse.json({ error: "No" }, { status });
          return HttpResponse.json({ checkoutUrl: "https://checkout.stripe.com/c/pay/abc" });
        })
      );
      return keys;
    }

    it("every purchase request carries an Idempotency-Key", async () => {
      serve({ user: { subscriptionActive: false } });
      const keys = answerWith();
      show();
      await userEvent.click((await screen.findAllByRole("button", { name: "Buy" }))[0]);
      await waitFor(() => expect(keys).toHaveLength(1));
      expect(keys[0]).toMatch(/^[0-9a-f-]{16,}$/i);
      // Settle the navigation inside this test: the handler answers after a delay, and a stray
      // window.location.href would otherwise be written during whichever test runs next.
      await waitFor(() => expect(window.location.href).toBe("https://checkout.stripe.com/c/pay/abc"));
    });

    it("after an outcome that is not known (a server error) the same purchase is retried with the SAME key", async () => {
      serve({ user: { subscriptionActive: false } });
      const keys = answerWith(503);
      show();
      await userEvent.click((await screen.findAllByRole("button", { name: "Buy" }))[0]);
      await waitFor(() => expect(screen.getAllByRole("button", { name: "Buy" })[0]).toBeEnabled());
      await userEvent.click(screen.getAllByRole("button", { name: "Buy" })[0]);
      await waitFor(() => expect(keys).toHaveLength(2));
      expect(keys[1]).toBe(keys[0]);
      await waitFor(() => expect(window.location.href).toBe("https://checkout.stripe.com/c/pay/abc"));
    });

    it("after a definite refusal the next click is a NEW purchase with a NEW key", async () => {
      serve({ user: { subscriptionActive: false } });
      const keys = answerWith(400);
      show();
      await userEvent.click((await screen.findAllByRole("button", { name: "Buy" }))[0]);
      await waitFor(() => expect(screen.getAllByRole("button", { name: "Buy" })[0]).toBeEnabled());
      await userEvent.click(screen.getAllByRole("button", { name: "Buy" })[0]);
      await waitFor(() => expect(keys).toHaveLength(2));
      expect(keys[1]).not.toBe(keys[0]);
      await waitFor(() => expect(window.location.href).toBe("https://checkout.stripe.com/c/pay/abc"));
    });

    it("a second click that arrives before the first request returns sends nothing", async () => {
      serve({ user: { subscriptionActive: false } });
      const keys = answerWith();
      show();
      const button = (await screen.findAllByRole("button", { name: "Buy" }))[0];
      act(() => {
        button.click(); // both clicks are handled before the page has re-rendered the buttons as disabled
        button.click();
      });
      await waitFor(() => expect(window.location.href).toBe("https://checkout.stripe.com/c/pay/abc"));
      expect(keys).toHaveLength(1);
    });
  });

  it("a failure is a message and the plans can be tried again", async () => {
    serve({ user: { subscriptionActive: false } });
    server.use(
      http.post(`${API}/api/billing/purchase`, () => HttpResponse.json({ error: "Plan purchases aren't open yet." }, { status: 503 }))
    );
    show();
    await userEvent.click((await screen.findAllByRole("button", { name: "Buy" }))[0]);
    await waitFor(() => expect(document.querySelector("[role=status][aria-live]")?.textContent).toMatch(/aren't open yet/));
    expect(window.location.href).toBe("http://localhost/subscribe");
    expect(screen.getAllByRole("button", { name: "Buy" })[0]).toBeEnabled();
  });

  it("in demo mode (payments not connected) a purchase takes effect and goes back to the app", async () => {
    serve({ user: { subscriptionActive: false }, catalog: catalogue({ stripeConfigured: false }) });
    server.use(
      http.post(`${API}/api/billing/purchase`, () => {
        me = { ...me, subscriptionActive: true };
        return HttpResponse.json({ mock: true });
      })
    );
    show();
    await userEvent.click((await screen.findAllByRole("button", { name: "Get this plan (test)" }))[0]);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/dashboard"));
    expect(await screen.findByText(/test purchase/)).toBeInTheDocument(); // the toast the page raised
    expect(meReads).toBeGreaterThanOrEqual(2); // the account was read again, so the app no longer thinks the trial is over
  });

  it("an account already on a paid plan sees it marked as current", async () => {
    serve({
      user: { subscriptionActive: true, subscriptionUntil: inDays(3) },
      billing: { ...testBilling, status: "active", plan: { key: "professional", name: "Professional", priceCents: 4900 } },
    });
    show();
    expect(await screen.findByText("Current plan")).toBeInTheDocument();
  });
});

describe("when plans cannot be bought online yet", () => {
  it("says so, and points at the support address from configuration", async () => {
    serve({
      user: { subscriptionActive: false },
      catalog: catalogue({ purchasesOpen: false, stripeConfigured: false, supportEmail: "help@finuxia.example" }),
    });
    show();
    expect(await screen.findByText("Plans can't be bought online yet.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "help@finuxia.example" });
    expect(link.getAttribute("href")).toMatch(/^mailto:help@finuxia\.example\?subject=/);
    screen.getAllByRole("button", { name: "Not available yet" }).forEach((b) => expect(b).toBeDisabled());
  });

  it("with no address configured it points at the support page, and invents no address", async () => {
    serve({ user: { subscriptionActive: false }, catalog: catalogue({ purchasesOpen: false, supportEmail: "" }) });
    show();
    const link = await screen.findByRole("link", { name: "contact support" });
    expect(link).toHaveAttribute("href", "/support");
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it("the wording follows whether the trial is still running", async () => {
    serve({
      user: { subscriptionActive: true, subscriptionUntil: inDays(4) },
      catalog: catalogue({ purchasesOpen: false, supportEmail: "help@finuxia.example" }),
    });
    show();
    expect(await screen.findByText(/To subscribe, contact us at/)).toBeInTheDocument();
  });
});

describe("the rest of the page", () => {
  it("a failure to load the plans is explained in place, with a retry", async () => {
    serve({ user: { subscriptionActive: false }, catalog: "error" });
    show();
    expect(await screen.findByText(/Could not load plans/)).toBeInTheDocument();
    server.use(http.get(`${API}/api/billing/plans`, () => HttpResponse.json(catalogue())));
    await userEvent.click(screen.getByRole("button", { name: /retry|try again/i }));
    expect(await screen.findByRole("heading", { name: "Professional" })).toBeInTheDocument();
  });

  it("says it is loading the plans, then shows them", async () => {
    serve({ user: { subscriptionActive: false } });
    server.use(
      http.get(`${API}/api/billing/plans`, async () => {
        await delay(150);
        return HttpResponse.json(catalogue());
      })
    );
    show();
    expect(await screen.findByText("Loading plans...")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Professional" })).toBeInTheDocument();
    expect(screen.queryByText("Loading plans...")).not.toBeInTheDocument();
  });

  it("logging out goes to the login page", async () => {
    serve({ user: { subscriptionActive: false } });
    server.use(
      http.post(`${API}/api/auth/logout`, () => {
        loggedOut += 1;
        return HttpResponse.json({});
      })
    );
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Log out" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/login"));
    expect(loggedOut).toBe(1); // the session is really ended at the server, not just left
  });
});
