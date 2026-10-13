import { http, HttpResponse } from "msw";
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API } from "../../test/handlers";
import { server } from "../../test/server";
import { fireEvent, renderWithProviders, screen, userEvent, waitFor } from "../../test/utils";
import PlanChangeDialog from "./PlanChangeDialog";

const plan = (over = {}) => ({ id: 2, key: "elite", name: "Elite", priceCents: 49900, currency: "usd", ...over });
const ref = (p) => ({ id: p.id, key: p.key, name: p.name, priceCents: p.priceCents, currency: p.currency });
const quote = (over = {}) => ({
  kind: "upgrade",
  canChange: true,
  blockers: [],
  fromPlan: ref(plan({ id: 1, key: "professional", name: "Professional", priceCents: 4900 })),
  toPlan: ref(plan()),
  amountDueCents: 49900,
  currency: "usd",
  currentAccessEndsAt: "2026-11-15T12:00:00",
  newAccessEndsAt: "2027-10-13T12:00:00",
  addsTime: true,
  lost: [],
  overLimits: [],
  ...over,
});
const downgrade = (over = {}) =>
  quote({
    kind: "downgrade",
    toPlan: ref(plan({ id: 3, key: "starter", name: "Starter", priceCents: 0 })),
    amountDueCents: 0,
    newAccessEndsAt: "2026-11-15T12:00:00",
    addsTime: false,
    ...over,
  });

const preview = (q) => server.use(http.get(`${API}/api/billing/plan-change/preview`, () => HttpResponse.json(q)));
const posts = [];
const change = (reply) => {
  posts.length = 0;
  server.use(
    http.post(`${API}/api/billing/plan-change`, async ({ request }) => {
      posts.push({ body: await request.json(), key: request.headers.get("Idempotency-Key") });
      return reply(posts.length);
    })
  );
};
const realLocation = window.location;
const show = (p = plan(), onClose = vi.fn()) => {
  renderWithProviders(<PlanChangeDialog plan={p} onClose={onClose} />, { providers: ["router", "toast", "auth"] });
  return onClose;
};
const confirmButton = (name) => screen.findByRole("button", { name });

beforeEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...realLocation, origin: realLocation.origin, href: "http://localhost/billing" },
  });
});
afterEach(() => Object.defineProperty(window, "location", { configurable: true, value: realLocation }));

describe("what the customer sees before confirming", () => {
  it("an upgrade: the new plan, the amount now due, the new access end", async () => {
    preview(quote());
    show();
    expect(await screen.findByRole("heading", { name: "Upgrade to Elite" })).toBeInTheDocument();
    expect(screen.getByText("$499.00")).toBeInTheDocument();
    expect(screen.getByText("Your access will end on October 13, 2027.")).toBeInTheDocument();
    expect(await confirmButton("Pay $499.00 and upgrade")).toBeEnabled();
  });

  it("an upgrade that adds no time says so, instead of promising an end date it will not give", async () => {
    preview(quote({ addsTime: false, newAccessEndsAt: "2026-11-15T12:00:00" }));
    show();
    expect(await screen.findByText(/Your access still ends on November 15, 2026.*features, not extra time/)).toBeInTheDocument();
  });

  it("a downgrade: nothing to pay, what is lost, the access end unchanged, no refund", async () => {
    preview(
      downgrade({
        lost: [
          { kind: "module", key: "documents", label: "Document Library", was: "", becomes: "" },
          { kind: "entitlement", key: "ai_credits", label: "AI allowance", was: "1,500", becomes: "Not included" },
        ],
      })
    );
    show(plan({ id: 3, key: "starter", name: "Starter", priceCents: 0 }));
    expect(await screen.findByRole("heading", { name: "Switch to Starter" })).toBeInTheDocument();
    expect(screen.getByText("Nothing to pay")).toBeInTheDocument();
    expect(screen.getByText(/still ends on November 15, 2026. Nothing is refunded and nothing is charged/)).toBeInTheDocument();
    expect(screen.getByText("Document Library")).toBeInTheDocument();
    expect(screen.getByText("AI allowance: 1,500 → Not included")).toBeInTheDocument();
    expect(screen.getByText(/keep Professional until your access ends, simply close this/)).toBeInTheDocument();
  });

  it("limits the account is over are named, with the promise that nothing is deleted", async () => {
    preview(downgrade({ overLimits: [{ key: "clients_max", label: "Clients", limit: 100, used: 300 }] }));
    show(plan({ id: 3, key: "starter", name: "Starter", priceCents: 0 }));
    expect(await screen.findByText("You have 300 clients; this plan allows 100.")).toBeInTheDocument();
    expect(screen.getByText(/Nothing is deleted/)).toBeInTheDocument();
  });

  it("a change the server will not allow shows why and cannot be confirmed", async () => {
    preview(quote({ canChange: false, blockers: [{ code: "access_ended", message: "Your access has ended. Buy a plan instead." }] }));
    show();
    expect(await screen.findByText("Your access has ended. Buy a plan instead.")).toBeInTheDocument();
    expect(await confirmButton("Pay $499.00 and upgrade")).toBeDisabled();
  });

  it("while it is being worked out, and if that fails, nothing can be confirmed", async () => {
    server.use(http.get(`${API}/api/billing/plan-change/preview`, () => HttpResponse.json({ error: "Plan not found" }, { status: 404 })));
    show();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Plan not found");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });
});

describe("confirming", () => {
  it("sends the amount and currency that were shown, with an idempotency key", async () => {
    preview(quote());
    change(() => HttpResponse.json({ kind: "upgrade", changed: false, checkoutUrl: "https://pay.example/c/1" }));
    show();
    await userEvent.click(await confirmButton("Pay $499.00 and upgrade"));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].body).toEqual({ planId: 2, expectedAmountCents: 49900, expectedCurrency: "usd" });
    expect(posts[0].key).toBeTruthy();
  });

  it("an upgrade with a real checkout sends the customer to pay", async () => {
    preview(quote());
    change(() => HttpResponse.json({ kind: "upgrade", changed: false, checkoutUrl: "https://pay.example/c/1" }));
    show();
    await userEvent.click(await confirmButton("Pay $499.00 and upgrade"));
    await waitFor(() => expect(window.location.href).toBe("https://pay.example/c/1"));
  });

  it("a demo upgrade is activated at once and says no money moved", async () => {
    preview(quote());
    change(() => HttpResponse.json({ kind: "upgrade", changed: true, mock: true }));
    const onClose = show();
    await userEvent.click(await confirmButton("Pay $499.00 and upgrade"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await screen.findByText(/You're now on the Elite plan \(test purchase/)).toBeInTheDocument();
  });

  it("a downgrade happens at once, says nothing was deleted, and closes", async () => {
    preview(downgrade());
    change(() => HttpResponse.json({ kind: "downgrade", changed: true }));
    const onClose = show(plan({ id: 3, key: "starter", name: "Starter", priceCents: 0 }));
    await userEvent.click(await confirmButton("Switch to Starter now"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posts[0].body.expectedAmountCents).toBe(0);
    expect(
      await screen.findByText(/You're now on the Starter plan. Your access end is unchanged and nothing was deleted/)
    ).toBeInTheDocument();
  });

  it("two clicks at once make one request", async () => {
    preview(quote());
    change(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return HttpResponse.json({ kind: "upgrade", changed: true, mock: true });
    });
    show();
    const button = await confirmButton("Pay $499.00 and upgrade");
    await userEvent.dblClick(button);
    await waitFor(() => expect(posts.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 120));
    expect(posts).toHaveLength(1);
  });

  it("two clicks in the same instant, before the screen has updated, make one request", async () => {
    preview(quote());
    change(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return HttpResponse.json({ kind: "upgrade", changed: true, mock: true });
    });
    show();
    const button = await confirmButton("Pay $499.00 and upgrade");
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    await waitFor(() => expect(posts.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 120));
    expect(posts).toHaveLength(1);
  });

  it("after a change the account's billing is read again, so the page shows the new plan", async () => {
    let reads = 0;
    server.use(
      http.get(`${API}/api/billing/me`, () => {
        reads += 1;
        return HttpResponse.json({
          plan: { key: "elite", name: "Elite" },
          status: "active",
          moduleKeys: [],
          access: { status: "valid", warning: "none", endsAt: null, daysLeft: null, valid: true, warnDays: 14 },
        });
      })
    );
    preview(downgrade());
    change(() => HttpResponse.json({ kind: "downgrade", changed: true }));
    const onClose = show(plan({ id: 3, key: "starter", name: "Starter", priceCents: 0 }));
    await waitFor(() => expect(reads).toBeGreaterThan(0));
    const before = reads;
    await userEvent.click(await confirmButton("Switch to Starter now"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(reads).toBeGreaterThan(before);
  });

  it("an upgrade with nothing to pay does not say Pay", async () => {
    preview(quote({ amountDueCents: 0 }));
    show();
    expect(await confirmButton("Switch to Elite")).toBeEnabled();
    expect(screen.getByText("Nothing to pay")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pay/ })).not.toBeInTheDocument();
  });

  it("a price that moved is shown again to confirm, and nothing is charged until they do", async () => {
    preview(quote());
    change((n) =>
      n === 1
        ? HttpResponse.json(
            { error: "The price changed since you looked.", code: "quote_changed", quote: quote({ amountDueCents: 54900 }) },
            { status: 409 }
          )
        : HttpResponse.json({ kind: "upgrade", changed: true, mock: true })
    );
    const onClose = show();
    await userEvent.click(await confirmButton("Pay $499.00 and upgrade"));
    expect(await screen.findByText(/The price changed since you looked/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(await confirmButton("Pay $549.00 and upgrade"));
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1].body.expectedAmountCents).toBe(54900);
    expect(posts[1].key).not.toBe(posts[0].key); // a different request is a different attempt
  });

  it("a change refused as not allowed shows the reasons and disables confirm", async () => {
    preview(quote());
    change(() =>
      HttpResponse.json(
        { error: "x", code: "not_allowed", blockers: [{ code: "same_plan", message: "You are already on this plan." }] },
        { status: 409 }
      )
    );
    show();
    await userEvent.click(await confirmButton("Pay $499.00 and upgrade"));
    expect(await screen.findByText("You are already on this plan.")).toBeInTheDocument();
    expect(await confirmButton("Pay $499.00 and upgrade")).toBeDisabled();
  });

  it("an unknown outcome keeps the same key, so trying again is the same change and not a second one", async () => {
    preview(quote());
    change((n) =>
      n === 1
        ? HttpResponse.json({ error: "Something went wrong" }, { status: 500 })
        : HttpResponse.json({ kind: "upgrade", changed: true, mock: true })
    );
    show();
    await userEvent.click(await confirmButton("Pay $499.00 and upgrade"));
    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
    await userEvent.click(await confirmButton("Pay $499.00 and upgrade"));
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1].key).toBe(posts[0].key);
  });

  it("Cancel closes without sending anything", async () => {
    preview(quote());
    change(() => HttpResponse.json({}));
    const onClose = show();
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(posts).toHaveLength(0);
  });
});
