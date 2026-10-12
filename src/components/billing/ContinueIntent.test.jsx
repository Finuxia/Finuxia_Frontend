import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API, testBilling } from "../../test/handlers";
import { server } from "../../test/server";
import { renderWithProviders, screen, userEvent, waitFor, within } from "../../test/utils";
import AccessCard from "./AccessCard";
import AccessBanner from "./AccessBanner";

const END = new Date(2026, 11, 15, 15, 30).toISOString(); // 15 December 2026, 3:30 PM wherever the test runs
const access = (over) => ({ status: "valid", warning: "none", endsAt: END, daysLeft: 60, valid: true, warnDays: 14, ...over });
let billing;
let calls;

/** A server that holds the billing status, and changes it only through PUT /intent, the way the real one does. */
function serve(over = {}, { failWith } = {}) {
  billing = { ...testBilling, plan: { key: "professional", name: "Professional" }, access: access(), notContinuingSince: null, ...over };
  calls = [];
  server.use(
    http.get(`${API}/api/billing/me`, () => HttpResponse.json(billing)),
    http.put(`${API}/api/billing/intent`, async ({ request }) => {
      const body = await request.json();
      calls.push(body);
      await delay(20);
      if (failWith) return HttpResponse.json({ error: failWith }, { status: 500 });
      billing = { ...billing, notContinuingSince: body.willContinue ? null : "2026-10-01T10:00:00Z" };
      return HttpResponse.json(billing);
    })
  );
}
const show = (ui = <AccessCard />) => renderWithProviders(ui, { providers: ["router", "toast", "auth"] });
const open = async () => userEvent.click(await screen.findByRole("button", { name: "I don't plan to continue" }));
const notNow = () => new Promise((r) => setTimeout(r, 60));

describe("offering it", () => {
  it("is offered while access is running and has an end", async () => {
    serve();
    show();
    expect(await screen.findByRole("button", { name: "I don't plan to continue" })).toBeInTheDocument();
  });

  it("is offered in the closing days too", async () => {
    serve({ access: access({ status: "lapsing", warning: "soon", daysLeft: 5 }) });
    show();
    expect(await screen.findByRole("button", { name: "I don't plan to continue" })).toBeInTheDocument();
  });

  it.each([
    ["an account whose access does not end", { access: access({ status: "unlimited", endsAt: null, daysLeft: null }) }],
    ["an account whose access has ended", { access: access({ status: "lapsed", warning: "ended", valid: false, daysLeft: 0 }) }],
    ["an account with no plan", { plan: null }],
    ["no summary from the server", { access: null }],
  ])("is not offered for %s", async (_name, over) => {
    serve(over);
    show();
    await screen.findByRole("region", { name: "Your access" }).catch(() => notNow());
    await notNow();
    expect(screen.queryByRole("button", { name: "I don't plan to continue" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("not-continuing")).not.toBeInTheDocument();
  });
});

describe("the confirmation", () => {
  it("says when access ends, that nothing more is charged, that the data is kept, and that it can be undone", async () => {
    serve();
    show();
    await open();
    const dialog = await screen.findByRole("dialog", { name: "You don't plan to continue?" });
    expect(dialog).toHaveTextContent(/Your access continues until December 15, 2026 at 3:30\s*PM/);
    expect(dialog).toHaveTextContent("Nothing further will be charged");
    expect(dialog).toHaveTextContent("Everything you've added is kept");
    expect(dialog).toHaveTextContent("change your mind any time before then, at no cost");
  });

  it("does not suggest that money is coming back", async () => {
    serve();
    show();
    await open();
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).not.toMatch(/refund|money back|reimburse/i);
  });

  it("sends nothing until it is confirmed: Not now and Escape both leave things as they were", async () => {
    serve();
    show();
    await open();
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Not now" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await open();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await notNow();
    expect(calls).toEqual([]);
    expect(screen.getByRole("button", { name: "I don't plan to continue" })).toBeInTheDocument();
  });

  it("confirming sends willContinue: false once, then shows the statement with the end date unchanged", async () => {
    serve();
    show();
    await open();
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm" }));
    const statement = await screen.findByTestId("not-continuing");
    expect(calls).toEqual([{ willContinue: false }]);
    expect(statement).toHaveTextContent("On October 1, 2026 you told us you don't plan to continue.");
    expect(statement).toHaveTextContent(/Your access still runs until December 15, 2026 at 3:30\s*PM/);
    expect(statement).toHaveTextContent("nothing more will be charged");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Your access" })).getByRole("status")).toHaveTextContent("You have access until December 15, 2026.");
    expect(screen.queryByRole("button", { name: "I don't plan to continue" })).not.toBeInTheDocument();
  });

  it("a second click while it is saving sends nothing more", async () => {
    serve();
    show();
    await open();
    const confirm = within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm" });
    await userEvent.dblClick(confirm);
    await screen.findByTestId("not-continuing");
    expect(calls).toHaveLength(1);
  });

  it("a failure is explained, nothing is claimed, and the dialog stays so it can be tried again", async () => {
    serve({}, { failWith: "Could not save right now" });
    show();
    await open();
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("Could not save right now")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByTestId("not-continuing")).not.toBeInTheDocument();
  });
});

describe("taking it back", () => {
  it("is one click, with no dialog, and sends willContinue: true", async () => {
    serve({ notContinuingSince: "2026-10-01T10:00:00Z" });
    show();
    await userEvent.click(await screen.findByRole("button", { name: "I've changed my mind" }));
    expect(await screen.findByRole("button", { name: "I don't plan to continue" })).toBeInTheDocument();
    expect(calls).toEqual([{ willContinue: true }]);
    expect(screen.queryByTestId("not-continuing")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a second click while it is saving sends nothing more", async () => {
    serve({ notContinuingSince: "2026-10-01T10:00:00Z" });
    show();
    await userEvent.dblClick(await screen.findByRole("button", { name: "I've changed my mind" }));
    await screen.findByRole("button", { name: "I don't plan to continue" });
    expect(calls).toHaveLength(1);
  });

  it("a failure leaves the statement in place and says why", async () => {
    serve({ notContinuingSince: "2026-10-01T10:00:00Z" }, { failWith: "Could not save right now" });
    show();
    await userEvent.click(await screen.findByRole("button", { name: "I've changed my mind" }));
    expect(await screen.findByText("Could not save right now")).toBeInTheDocument();
    expect(screen.getByTestId("not-continuing")).toBeInTheDocument();
  });
});

describe("the reminders", () => {
  it("stop once they have said so (the closing days are not a warning to them)", async () => {
    serve({ access: access({ status: "lapsing", warning: "urgent", daysLeft: 2 }), notContinuingSince: "2026-10-01T10:00:00Z" });
    show(<AccessBanner />);
    await notNow();
    expect(screen.queryByTestId("access-banner")).not.toBeInTheDocument();
  });

  it("go on for anyone who has not", async () => {
    serve({ access: access({ status: "lapsing", warning: "urgent", daysLeft: 2 }) });
    show(<AccessBanner />);
    expect(await screen.findByTestId("access-banner")).toHaveTextContent("Your access ends in 2 days");
  });

  it("the card still says exactly when access ends, but no longer urges them to buy", async () => {
    serve({ access: access({ status: "lapsing", warning: "soon", daysLeft: 5 }), notContinuingSince: "2026-10-01T10:00:00Z" });
    show();
    expect(await screen.findByText(/Your access ends in 5 days, on December 15, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/You've told us you don't plan to continue\. Nothing more will be charged/)).toBeInTheDocument();
    expect(screen.queryByText(/Buy a plan before then/)).not.toBeInTheDocument();
  });

  it("once access has ended the banner is a statement and still shows", async () => {
    serve({ access: access({ status: "lapsed", warning: "ended", valid: false, daysLeft: 0 }), notContinuingSince: "2026-10-01T10:00:00Z" });
    show(<AccessBanner />);
    expect(await screen.findByTestId("access-banner")).toHaveTextContent("Your access ended on December 15, 2026.");
  });
});
