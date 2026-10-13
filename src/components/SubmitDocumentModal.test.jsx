import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor, within } from "../test/utils";
import SubmitDocumentModal from "./SubmitDocumentModal";

const usage = (over = {}) => ({
  aiIncluded: true,
  mode: "allowance",
  period: { start: "2026-10-01T12:00:00Z", end: "2026-11-04T12:00:00Z" },
  credits: { included: 100, extra: 0, total: 100, used: 96, inFlight: 0, remaining: 4 },
  percentUsed: 96,
  warning: "critical",
  blocked: null,
  byFeature: [],
  wallet: { balanceCents: 300 },
  recentUsage: [],
  ...over,
});

const open = async () => {
  renderWithProviders(<SubmitDocumentModal onClose={vi.fn()} onSubmitted={vi.fn()} />, { providers: ["router", "toast"] });
  const file = new File(["%PDF-1.4"], "policy.pdf", { type: "application/pdf" });
  await userEvent.upload(document.querySelector('input[type="file"]'), file);
  return screen.getByRole("button", { name: /suggest topic/i });
};

describe("the document suggestion and the AI allowance", () => {
  it("shows the 95% warning above the suggest button", async () => {
    server.use(http.get(`${API}/api/billing/ai-usage`, () => HttpResponse.json(usage())));
    await open();
    expect(await screen.findByRole("status")).toHaveTextContent(/96%.*4 credits left/);
  });

  it("shows no warning when nothing needs saying", async () => {
    server.use(http.get(`${API}/api/billing/ai-usage`, () => HttpResponse.json(usage({ warning: null, percentUsed: 10 }))));
    await open();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("a suggestion the account cannot pay for names the limit and offers the way out, not a toast", async () => {
    const message = "You've used all of the 100 AI credits included in your plan for this period, and your wallet balance ($0.00) is too low.";
    server.use(
      http.get(`${API}/api/billing/ai-usage`, () => HttpResponse.json(usage({ warning: null }))),
      http.post(`${API}/api/documents/suggest`, () => HttpResponse.json({ error: message, code: "ai_credit_exhausted", actions: ["top_up", "upgrade"] }, { status: 402 }))
    );
    await userEvent.click(await open());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(within(alert).getByRole("link", { name: /add credit/i })).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: /see plans/i })).toBeInTheDocument();
    await userEvent.click(within(alert).getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("trying again clears the earlier refusal", async () => {
    let allowed = false;
    server.use(
      http.get(`${API}/api/billing/ai-usage`, () => HttpResponse.json(usage({ warning: null }))),
      http.post(`${API}/api/documents/suggest`, () =>
        allowed ? HttpResponse.json({ topic: "T", summary: "S", keywords: ["k"] }) : HttpResponse.json({ error: "Out of credit.", actions: ["top_up"] }, { status: 402 })
      )
    );
    const button = await open();
    await userEvent.click(button);
    await screen.findByRole("alert");
    allowed = true;
    await userEvent.click(button);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("another failure stays a toast", async () => {
    server.use(http.post(`${API}/api/documents/suggest`, () => HttpResponse.json({ error: "Provider error" }, { status: 502 })));
    await userEvent.click(await open());
    expect(await screen.findByText("Provider error")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("asks for the usage again after a suggestion", async () => {
    let asked = 0;
    server.use(
      http.get(`${API}/api/billing/ai-usage`, () => {
        asked += 1;
        return HttpResponse.json(usage());
      }),
      http.post(`${API}/api/documents/suggest`, () => HttpResponse.json({ topic: "T", summary: "S", keywords: ["k"] }))
    );
    const button = await open();
    await screen.findByRole("status");
    const before = asked;
    await userEvent.click(button);
    await waitFor(() => expect(asked).toBeGreaterThan(before));
  });
});
