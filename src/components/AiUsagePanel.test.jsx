import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor, within } from "../test/utils";
import AiUsagePanel from "./AiUsagePanel";

const allowance = (over = {}) => ({
  aiIncluded: true,
  mode: "allowance",
  period: { start: "2026-10-01T12:00:00Z", end: "2026-11-04T12:00:00Z" },
  credits: { included: 1000, extra: 200, total: 1200, used: 300, inFlight: 5, remaining: 895 },
  percentUsed: 25,
  warning: null,
  blocked: null,
  byFeature: [
    { feature: "reason_why_letter", label: "Reason Why Letter draft", calls: 4, credits: 20, fromAllowance: 20 },
    { feature: "followup_draft", label: "Follow-up email draft", calls: 1, credits: 2, fromAllowance: 2 },
  ],
  wallet: { balanceCents: 1250 },
  recentUsage: [
    {
      feature: "reason_why_letter",
      label: "Reason Why Letter draft",
      costCents: 5,
      credits: 5,
      pending: false,
      createdAt: "2026-10-12T10:00:00Z",
    },
    {
      feature: "followup_draft",
      label: "Follow-up email draft",
      costCents: 2,
      credits: 2,
      pending: true,
      createdAt: "2026-10-12T11:00:00Z",
    },
  ],
  ...over,
});

const serve = (body) => server.use(http.get(`${API}/api/billing/ai-usage`, () => HttpResponse.json(body)));
const render = (route = "/profile?tab=ai-usage") => renderWithProviders(<AiUsagePanel />, { route, providers: ["router", "toast"] });

describe("AI usage panel", () => {
  it("shows the credits left of the total, the date they start again, used and included, in credits", async () => {
    serve(allowance());
    render();
    expect(await screen.findByText(/895/)).toBeInTheDocument();
    expect(screen.getByText(/of 1,200 credits left/)).toBeInTheDocument();
    expect(screen.getByText(/Start again November 4, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/300 used · 5 in progress/)).toBeInTheDocument();
    expect(screen.getByText(/1,000 included \+ 200 extra/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /ai credits used/i })).toHaveAttribute("aria-valuenow", "25");
  });

  it("lists what each feature used this period and the recent calls, in credits", async () => {
    serve(allowance());
    render();
    await screen.findByText(/895/);
    expect(screen.getByText(/4 uses · 20 credits/)).toBeInTheDocument();
    expect(screen.getByText(/1 use · 2 credits/)).toBeInTheDocument();
    const recent = screen.getByText("Recent AI use").closest("section");
    expect(within(recent).getByText("5 credits")).toBeInTheDocument();
    expect(within(recent).getByText("in progress")).toBeInTheDocument();
    expect(within(recent).getAllByText(/October 12, 2026/)).toHaveLength(2);
  });

  it("shows the wallet balance from whole cents", async () => {
    serve(allowance());
    render();
    expect(await screen.findByText("$12.50")).toBeInTheDocument();
  });

  it("never shows tokens, a model or what a call cost us", async () => {
    serve(allowance());
    render();
    await screen.findByText(/895/);
    const text = document.body.textContent.toLowerCase();
    for (const word of ["token", "gpt", "model", "micro"]) expect(text, word).not.toContain(word);
  });

  it("the progress bar never goes past full or below empty, however far over the period is", async () => {
    serve(
      allowance({
        percentUsed: 130,
        warning: "exhausted",
        credits: { included: 1000, extra: 0, total: 1000, used: 1300, inFlight: 0, remaining: 0 },
      })
    );
    const { unmount } = render();
    expect(await screen.findByRole("progressbar", { name: /ai credits used/i })).toHaveAttribute("aria-valuenow", "100");
    unmount();
    serve(allowance({ percentUsed: -5 }));
    render();
    expect(await screen.findByRole("progressbar", { name: /ai credits used/i })).toHaveAttribute("aria-valuenow", "0");
  });

  it("warns at 80% and says how much is left", async () => {
    serve(
      allowance({
        percentUsed: 82,
        warning: "warning",
        credits: { included: 1000, extra: 0, total: 1000, used: 820, inFlight: 0, remaining: 180 },
      })
    );
    render();
    expect(await screen.findByRole("status")).toHaveTextContent(/82%.*180 credits left/);
  });

  it("warns urgently at 95%", async () => {
    serve(
      allowance({
        percentUsed: 96,
        warning: "critical",
        credits: { included: 1000, extra: 0, total: 1000, used: 960, inFlight: 0, remaining: 40 },
      })
    );
    render();
    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent(/96%/);
    expect(warning.className).toContain("av-red");
  });

  it("shows no warning below 80%", async () => {
    serve(allowance());
    render();
    await screen.findByText(/895/);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("when used up but the wallet can still pay, says the wallet is paying and does not call it blocked", async () => {
    serve(
      allowance({
        percentUsed: 100,
        warning: "exhausted",
        credits: { included: 1000, extra: 0, total: 1000, used: 1000, inFlight: 0, remaining: 0 },
      })
    );
    render();
    expect(await screen.findByRole("status")).toHaveTextContent(/paid from your wallet \(\$12\.50\)/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("when blocked, shows the server's sentence naming the limit and offers to see plans (the add-credit buttons are on the page)", async () => {
    serve(
      allowance({
        percentUsed: 100,
        warning: "exhausted",
        wallet: { balanceCents: 0 },
        blocked: {
          message: "You've used all of the 1,000 AI credits included in your plan for this period.",
          actions: ["top_up", "upgrade"],
        },
      })
    );
    render();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You've used all of the 1,000 AI credits included in your plan");
    expect(within(alert).getByRole("link", { name: /see plans/i })).toHaveAttribute("href", "/billing");
    expect(within(alert).queryByRole("link", { name: /add credit/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add $5.00" })).toBeInTheDocument();
  });

  it("an unlimited plan says there is nothing to run out of, and shows what was used", async () => {
    serve(
      allowance({
        mode: "unlimited",
        credits: { included: null, extra: 0, total: null, used: 7, inFlight: 0, remaining: null },
        percentUsed: null,
      })
    );
    render();
    expect(await screen.findByText(/unlimited AI/)).toHaveTextContent("You've used 7 credits this period");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("a plan with AI but no allowance says the wallet pays for everything", async () => {
    serve(allowance({ mode: "wallet", period: null, credits: null, percentUsed: null, byFeature: [] }));
    render();
    expect(await screen.findByText(/paid from your wallet below/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add $5.00" })).toBeInTheDocument();
  });

  it("a plan without AI says so and links to the plans, with no wallet", async () => {
    serve({
      aiIncluded: false,
      mode: "none",
      period: null,
      credits: null,
      percentUsed: null,
      warning: null,
      blocked: null,
      byFeature: [],
      wallet: { balanceCents: 0 },
      recentUsage: [],
    });
    render();
    expect(await screen.findByText(/doesn't include the AI features/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see plans/i })).toHaveAttribute("href", "/billing");
    expect(screen.queryByText("AI wallet")).not.toBeInTheDocument();
  });

  it("a failure to load is said plainly instead of leaving the tab empty", async () => {
    server.use(http.get(`${API}/api/billing/ai-usage`, () => HttpResponse.json({ error: "x" }, { status: 500 })));
    render();
    expect(await screen.findByText(/isn't available right now/)).toBeInTheDocument();
  });
});

describe("AI wallet top-up", () => {
  const topUps = [];
  const serveTopUp = (reply) => {
    topUps.length = 0;
    server.use(
      http.post(`${API}/api/billing/wallet/topup`, async ({ request }) => {
        topUps.push({ body: await request.json(), key: request.headers.get("Idempotency-Key") });
        return reply();
      })
    );
  };

  it("sends the chosen amount in whole cents with an idempotency key and our own return pages", async () => {
    serve(allowance());
    serveTopUp(() => HttpResponse.json({ mock: true }));
    render();
    await userEvent.click(await screen.findByRole("button", { name: "Add $10.00" }));
    await waitFor(() => expect(topUps).toHaveLength(1));
    expect(topUps[0].body.amountCents).toBe(1000);
    expect(topUps[0].body.successUrl).toMatch(/\/profile\?tab=ai-usage&topup=success$/);
    expect(topUps[0].body.cancelUrl).toMatch(/\/profile\?tab=ai-usage&topup=canceled$/);
    expect(topUps[0].key).toBeTruthy();
  });

  it("a test top-up (no payment provider) says so and refreshes the balance", async () => {
    let balance = 1250;
    server.use(http.get(`${API}/api/billing/ai-usage`, () => HttpResponse.json(allowance({ wallet: { balanceCents: balance } }))));
    serveTopUp(() => {
      balance += 500;
      return HttpResponse.json({ mock: true });
    });
    render();
    await userEvent.click(await screen.findByRole("button", { name: "Add $5.00" }));
    expect(await screen.findByText("$17.50")).toBeInTheDocument();
    expect(screen.getByText(/test top-up, no real charge/)).toBeInTheDocument();
  });

  it("when the plans answer does not say, purchases are taken to be open", async () => {
    serve(allowance());
    server.use(http.get(`${API}/api/billing/plans`, () => HttpResponse.json({ plans: [] })));
    render();
    expect(await screen.findByRole("button", { name: "Add $5.00" })).toBeInTheDocument();
  });

  it("a finished top-up is a finished attempt: the next one is a new request with its own key", async () => {
    serve(allowance());
    serveTopUp(() => HttpResponse.json({ mock: true }));
    render();
    await userEvent.click(await screen.findByRole("button", { name: "Add $5.00" }));
    await waitFor(() => expect(topUps).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add $5.00" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Add $5.00" }));
    await waitFor(() => expect(topUps).toHaveLength(2));
    expect(topUps[1].key).not.toBe(topUps[0].key);
  });

  it("after a failure that may not have reached the server, trying again is the same request (same key)", async () => {
    serve(allowance());
    let n = 0;
    serveTopUp(() =>
      ++n === 1 ? HttpResponse.json({ error: "Something went wrong" }, { status: 500 }) : HttpResponse.json({ mock: true })
    );
    render();
    await userEvent.click(await screen.findByRole("button", { name: "Add $5.00" }));
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add $5.00" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Add $5.00" }));
    await waitFor(() => expect(topUps).toHaveLength(2));
    expect(topUps[1].key).toBe(topUps[0].key);
  });

  it("only one top-up goes out at a time", async () => {
    serve(allowance());
    serveTopUp(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return HttpResponse.json({ mock: true });
    });
    render();
    const button = await screen.findByRole("button", { name: "Add $5.00" });
    await userEvent.click(button);
    await userEvent.click(screen.getByRole("button", { name: "Add $10.00" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add $10.00" })).not.toBeDisabled());
    expect(topUps).toHaveLength(1);
  });

  it("a refused top-up says why", async () => {
    serve(allowance());
    serveTopUp(() => HttpResponse.json({ error: "Adding credit isn't open yet." }, { status: 400 }));
    render();
    await userEvent.click(await screen.findByRole("button", { name: "Add $5.00" }));
    expect(await screen.findByText("Adding credit isn't open yet.")).toBeInTheDocument();
  });

  it("when purchases are closed, no add buttons are offered", async () => {
    serve(allowance());
    server.use(http.get(`${API}/api/billing/plans`, () => HttpResponse.json({ plans: [], purchasesOpen: false })));
    render();
    expect(await screen.findByText(/Adding credit isn't open yet\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Add \$/ })).not.toBeInTheDocument();
  });

  it("coming back from a successful payment says the credit arrives once it is confirmed", async () => {
    serve(allowance());
    render("/profile?tab=ai-usage&topup=success");
    expect(await screen.findByText(/added to your wallet as soon as the payment is confirmed/)).toBeInTheDocument();
  });
});
