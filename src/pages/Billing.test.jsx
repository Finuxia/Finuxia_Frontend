import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API, testBilling } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor, within } from "../test/utils";
import Billing from "./Billing";

const dur = (kind, over = {}) => ({ kind, days: null, months: null, years: null, until: null, ...over });
const plans = [
  {
    id: 1,
    key: "professional",
    name: "Professional",
    description: "For advisors",
    descriptionHtml: "<p>Everything you need, <strong>every month</strong>.</p>",
    logoUrl: "/api/billing/plans/professional/logo?v=abc123",
    priceCents: 4900,
    currency: "usd",
    interval: "month",
    accessDuration: dur("months", { months: 1 }),
    modules: [{ key: "documents", name: "Document Library" }],
    includes: [{ key: "ai_credits", label: "AI allowance", summary: "1,500 per month" }],
  },
  {
    id: 2,
    key: "elite",
    name: "Elite",
    description: "Everything",
    priceCents: 49900,
    currency: "usd",
    interval: "year",
    accessDuration: dur("years", { years: 1 }),
    modules: [],
    includes: [],
  },
  {
    id: 3,
    key: "starter",
    name: "Starter",
    description: "To try it out",
    priceCents: 0,
    currency: "usd",
    interval: "month",
    accessDuration: dur("days", { days: 30 }),
    modules: [],
    includes: [],
  },
];
const access = (over = {}) => ({
  status: "valid",
  warning: "none",
  endsAt: "2026-12-15T12:00:00",
  daysLeft: 60,
  valid: true,
  warnDays: 14,
  ...over,
});
const me = (over = {}) => http.get(`${API}/api/billing/me`, () => HttpResponse.json({ ...testBilling, access: access(), ...over }));
const catalogue = (over = {}) =>
  http.get(`${API}/api/billing/plans`, () => HttpResponse.json({ plans, stripeConfigured: true, purchasesOpen: true, ...over }));
const payment = (over = {}) => ({
  id: 21,
  date: new Date(2026, 5, 1, 12).toISOString(),
  planName: "Professional",
  amountCents: 4999,
  currency: "usd",
  amountDisplay: "49.99 USD",
  status: "succeeded",
  isMock: false,
  accessWindow: { start: new Date(2026, 5, 1, 12).toISOString(), end: new Date(2026, 6, 1, 12).toISOString() },
  receiptNumber: "R-00000021",
  receiptAvailable: true,
  ...over,
});
const history = (results, nextCursor = null) => http.get(`${API}/api/billing/payments`, () => HttpResponse.json({ results, nextCursor }));

const realLocation = window.location;
const show = () => renderWithProviders(<Billing />, { providers: ["router", "toast", "auth"] });

beforeEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...realLocation, origin: realLocation.origin, href: "http://localhost/billing" },
  });
});
afterEach(() => Object.defineProperty(window, "location", { configurable: true, value: realLocation }));

describe("when access ends", () => {
  it("says exactly when, and that nothing renews by itself", async () => {
    server.use(catalogue(), me());
    show();
    const card = await screen.findByRole("region", { name: "Your access" });
    expect(within(card).getByText("You have access until December 15, 2026.")).toBeInTheDocument();
    expect(within(card).getByText("60 days left.")).toBeInTheDocument();
    expect(within(card).getByText(/Nothing renews automatically and no card is kept on file/)).toBeInTheDocument();
    expect(within(card).getByText(/keep whichever end date is later/)).toBeInTheDocument();
  });

  it("warns when the end is close", async () => {
    server.use(catalogue(), me({ access: access({ status: "lapsing", warning: "urgent", daysLeft: 2 }) }));
    show();
    expect(await screen.findByText(/Your access ends in 2 days, on December 15, 2026\./)).toBeInTheDocument();
    expect(screen.getByText(/Buy a plan before then/)).toBeInTheDocument();
  });

  it("explains an access that has ended, and that nothing was deleted", async () => {
    server.use(catalogue(), me({ access: access({ status: "lapsed", warning: "ended", daysLeft: 0, valid: false }) }));
    show();
    expect(await screen.findByText("Your access ended on December 15, 2026.")).toBeInTheDocument();
    expect(screen.getByText(/Nothing you added has been deleted/)).toBeInTheDocument();
  });

  it("says when access has no end", async () => {
    server.use(catalogue(), me({ access: access({ status: "unlimited", endsAt: null, daysLeft: null }) }));
    show();
    expect(await screen.findByText("Your access does not end.")).toBeInTheDocument();
  });

  it("shows no access card, and does not fail, when there is no plan yet", async () => {
    server.use(catalogue(), me({ plan: null }));
    show();
    await screen.findByRole("heading", { name: "Professional" });
    expect(screen.queryByRole("region", { name: "Your access" })).not.toBeInTheDocument();
  });

  it("shows no access card from a server that sent no summary", async () => {
    server.use(catalogue(), me({ access: undefined }));
    show();
    await screen.findByRole("heading", { name: "Professional" });
    expect(screen.queryByRole("region", { name: "Your access" })).not.toBeInTheDocument();
  });
});

describe("the plans", () => {
  it("shows each plan's real term, price from whole cents, what it includes and its logo", async () => {
    server.use(catalogue(), me());
    show();
    const pro = (await screen.findByRole("heading", { name: "Professional" })).closest("div[class*=rounded-2xl]");
    expect(within(pro).getByText("$49.00 for 1 month")).toBeInTheDocument();
    expect(within(pro).getByText(/Access for 1 month; it does not renew by itself/)).toBeInTheDocument();
    expect(within(pro).getByText("Document Library")).toBeInTheDocument();
    expect(within(pro).getByText("1,500 per month")).toBeInTheDocument();
    const logo = pro.querySelector("img");
    expect(logo.getAttribute("src")).toMatch(/\/api\/billing\/plans\/professional\/logo\?v=abc123$/);
    expect(logo).toHaveAttribute("alt", "");
    const elite = screen.getByRole("heading", { name: "Elite" }).closest("div[class*=rounded-2xl]");
    expect(within(elite).getByText("$499.00 for 1 year")).toBeInTheDocument();
    const starter = screen.getByRole("heading", { name: "Starter" }).closest("div[class*=rounded-2xl]");
    expect(within(starter).getByText("Free")).toBeInTheDocument();
    expect(within(starter).queryByText(/does not renew/)).not.toBeInTheDocument();
  });

  it("shows the formatted description, and a hostile one runs nothing", async () => {
    const evil = {
      ...plans[1],
      descriptionHtml:
        '<p>Nice</p><script>window.__pwned = 1</script><img src=x onerror="window.__pwned = 2"><a href="javascript:window.__pwned = 3" onclick="window.__pwned = 4">link</a>',
    };
    server.use(catalogue({ plans: [plans[0], evil] }), me());
    show();
    const rich = await screen.findAllByTestId("plan-description");
    expect(rich[0]).toHaveTextContent("Everything you need, every month.");
    expect(rich[0].querySelector("strong")).toHaveTextContent("every month");
    expect(rich[1]).toHaveTextContent("Nicelink");
    expect(rich[1].querySelector("script, img, [onclick], a[href^='javascript']")).toBeNull();
    expect(window.__pwned).toBeUndefined();
  });

  it("a plan with no logo shows no picture", async () => {
    server.use(catalogue(), me());
    show();
    const elite = (await screen.findByRole("heading", { name: "Elite" })).closest("div[class*=rounded-2xl]");
    expect(elite.querySelector("img")).toBeNull();
  });

  it("falls back to the one plain line when there is no formatted description", async () => {
    server.use(catalogue(), me());
    show();
    expect(await screen.findByText("Everything")).toBeInTheDocument(); // Elite has only the plain description
    expect(screen.getAllByTestId("plan-description")).toHaveLength(1);
  });

  it("the plan you are on is marked, and buying it again is offered as such", async () => {
    server.use(catalogue(), me({ plan: { key: "professional", name: "Professional", priceCents: 4900 } }));
    show();
    expect(await screen.findByText("Current plan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose" })).toBeInTheDocument(); // the free plan
  });

  it("offers nothing to cancel, change or manage at the provider: plans are one-time purchases", async () => {
    server.use(catalogue(), me({ plan: { key: "professional", name: "Professional", priceCents: 4900 } }), history([payment()]));
    show();
    await screen.findByRole("heading", { name: "Professional" });
    for (const gone of [/cancel/i, /upgrade/i, /downgrade/i, /manage payment/i, /update card/i, /reactivate/i, /renews on/i, /invoice/i]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
  });
});

describe("starting a purchase", () => {
  it("sends only the plan to the server and then leaves for the provider's page", async () => {
    let body;
    server.use(
      catalogue(),
      me(),
      http.post(`${API}/api/billing/purchase`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ mock: false, checkoutUrl: "https://checkout.example/session" });
      })
    );
    show();
    await userEvent.click((await screen.findAllByRole("button", { name: "Buy" }))[0]);
    await waitFor(() => expect(window.location.href).toBe("https://checkout.example/session"));
    expect(body).toEqual({ planId: 2 }); // Elite: the first "Buy" (Professional, the plan the account is on, says "Buy again")
    expect(screen.getByRole("button", { name: "Processing..." })).toBeDisabled();
    screen.getAllByRole("button", { name: /^Buy|Choose/ }).forEach((b) => expect(b).toBeDisabled()); // cannot be clicked twice while leaving
  });

  it("a failure is a message and the plans can be tried again", async () => {
    server.use(
      catalogue(),
      me(),
      http.post(`${API}/api/billing/purchase`, () =>
        HttpResponse.json({ error: "The payment service is not available right now." }, { status: 503 })
      )
    );
    show();
    await userEvent.click((await screen.findAllByRole("button", { name: "Buy" }))[0]);
    await waitFor(() =>
      expect(document.querySelector("[role=status][aria-live]")?.textContent).toMatch(/payment service is not available/)
    );
    expect(window.location.href).toBe("http://localhost/billing");
    expect(screen.getAllByRole("button", { name: "Buy" })[0]).toBeEnabled();
  });

  it("in demo mode a purchase takes effect at once and says it was a test", async () => {
    server.use(
      catalogue({ stripeConfigured: false }),
      me(),
      http.post(`${API}/api/billing/purchase`, () => HttpResponse.json({ mock: true }))
    );
    show();
    await userEvent.click((await screen.findAllByRole("button", { name: "Get this plan (test)" }))[0]);
    await waitFor(() => expect(document.querySelector("[role=status][aria-live]")?.textContent).toMatch(/test purchase/));
  });

  it("when purchases are not open, paid plans say so and cannot be bought", async () => {
    server.use(catalogue({ purchasesOpen: false, stripeConfigured: false }), me());
    show();
    expect(await screen.findByText(/Plan purchases aren't open yet/)).toBeInTheDocument();
    screen.getAllByRole("button", { name: "Not available yet" }).forEach((b) => expect(b).toBeDisabled());
  });

  it("a free plan can still be chosen when paid purchases are not open", async () => {
    server.use(catalogue({ purchasesOpen: false, stripeConfigured: false }), me());
    show();
    expect(await screen.findByRole("button", { name: "Choose" })).toBeEnabled();
  });

  it("the grandfathered plan is explained and nothing is bought over it", async () => {
    server.use(catalogue(), me({ plan: { key: "legacy", name: "Legacy", priceCents: 0 } }));
    show();
    expect(await screen.findByText(/You joined before plans existed/)).toBeInTheDocument();
    screen.getAllByRole("button", { name: /Buy|Choose/ }).forEach((b) => expect(b).toBeDisabled());
  });
});

describe("what you have paid", () => {
  it("lists each payment with its exact amount, access and status, and a receipt where there is one", async () => {
    server.use(
      catalogue(),
      me(),
      history([
        payment(),
        payment({ id: 22, status: "pending", receiptNumber: null, receiptAvailable: false, accessWindow: null, amountCents: 100 }),
        payment({ id: 23, isMock: true, receiptNumber: null, receiptAvailable: false, planName: null }),
      ])
    );
    show();
    const region = await screen.findByRole("region", { name: "Payments" });
    const rows = within(region).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("$49.99")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/June 1, 2026 to July 1, 2026/)).toBeInTheDocument();
    expect(within(rows[0]).getByText("Paid")).toBeInTheDocument();
    expect(within(rows[0]).getByRole("button", { name: "Download receipt R-00000021" })).toBeInTheDocument();
    expect(within(rows[1]).getByText("$1.00")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Waiting for payment")).toBeInTheDocument();
    expect(within(rows[1]).queryByRole("button")).not.toBeInTheDocument();
    expect(within(rows[2]).getByText(/Test purchase: no money was taken/)).toBeInTheDocument();
    expect(within(rows[2]).getByText("Plan no longer offered")).toBeInTheDocument();
    expect(within(rows[2]).queryByRole("button")).not.toBeInTheDocument();
  });

  it("a purchase with no end says so", async () => {
    server.use(catalogue(), me(), history([payment({ accessWindow: { start: new Date(2026, 5, 1, 12).toISOString(), end: null } })]));
    show();
    expect(await screen.findByText(/June 1, 2026 to no end/)).toBeInTheDocument();
  });

  it("shows nothing at all before the first payment", async () => {
    server.use(catalogue(), me(), history([]));
    show();
    await screen.findByRole("heading", { name: "Professional" });
    expect(screen.queryByRole("region", { name: "Payments" })).not.toBeInTheDocument();
  });

  it("a long history arrives a page at a time", async () => {
    let asked = [];
    server.use(
      catalogue(),
      me(),
      http.get(`${API}/api/billing/payments`, ({ request }) => {
        const url = new URL(request.url);
        asked.push([url.searchParams.get("limit"), url.searchParams.get("cursor")]);
        return url.searchParams.get("cursor")
          ? HttpResponse.json({ results: [payment({ id: 5, receiptNumber: "R-00000005" })], nextCursor: null })
          : HttpResponse.json({ results: [payment({ id: 6, receiptNumber: "R-00000006" })], nextCursor: "next-page" });
      })
    );
    show();
    expect(await screen.findByRole("button", { name: "Download receipt R-00000006" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download receipt R-00000005" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByRole("button", { name: "Download receipt R-00000005" })).toBeInTheDocument();
    expect(asked).toEqual([
      ["20", null],
      ["20", "next-page"],
    ]);
  });

  it("a failure to load the payments is explained in place, with a retry", async () => {
    server.use(
      catalogue(),
      me(),
      http.get(`${API}/api/billing/payments`, () => HttpResponse.json({ error: "boom" }, { status: 500 }))
    );
    show();
    expect(await screen.findByRole("button", { name: /retry|try again/i })).toBeInTheDocument();
  });
});

describe("receipts", () => {
  let created;
  beforeEach(() => {
    created = [];
    URL.createObjectURL = vi.fn((blob) => {
      created.push(blob);
      return "blob:receipt";
    });
    URL.revokeObjectURL = vi.fn();
  });

  it("fetches the PDF with the session, and saves it under the receipt's number", async () => {
    let asked = 0;
    server.use(
      catalogue(),
      me(),
      history([payment()]),
      http.get(`${API}/api/billing/payments/21/receipt`, () => {
        asked += 1;
        return new HttpResponse("%PDF-1.4 receipt", {
          headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="receipt-R-00000021.pdf"' },
        });
      })
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Download receipt R-00000021" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(asked).toBe(1);
    expect(created[0].type).toBe("application/pdf");
    click.mockRestore();
  });

  it("a receipt that cannot be had is a message, and the button is usable again", async () => {
    server.use(
      catalogue(),
      me(),
      history([payment()]),
      http.get(`${API}/api/billing/payments/21/receipt`, () => HttpResponse.json({ error: "Payment not found" }, { status: 404 }))
    );
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Download receipt R-00000021" }));
    await waitFor(() => expect(document.querySelector("[role=status][aria-live]")?.textContent).toMatch(/not found/i));
    expect(screen.getByRole("button", { name: "Download receipt R-00000021" })).toBeEnabled();
  });
});
