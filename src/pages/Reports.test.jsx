import { within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { monthKeyOf, monthShortLabel } from "../lib/chartPipeline";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import Reports from "./Reports";

const calendar = { isConfigured: true, status: "connected", connect: vi.fn(), fetchEventsInRange: vi.fn() };
vi.mock("../context/GoogleCalendarContext", async (importOriginal) => ({
  ...(await importOriginal()),
  useGoogleCalendar: () => calendar,
}));

const now = new Date();
const thisMonth = new Date(now.getFullYear(), now.getMonth(), 2, 10);
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15, 10);
const event = (summary, when) => ({ summary, start: { dateTime: when.toISOString() } });
const label = (d) => monthShortLabel(monthKeyOf(d));

beforeEach(() => {
  calendar.status = "connected";
  calendar.fetchEventsInRange = vi
    .fn()
    .mockResolvedValue([
      event("CP - Dana", lastMonth),
      event("CP - Lee", lastMonth),
      event("FC1 - Dana", lastMonth),
      event("CP - Sam", thisMonth),
      event("CP - Kim", thisMonth),
      event("CP - Ray", thisMonth),
      event("FC2 - Dana", thisMonth),
    ]);
});

const open = async () => {
  renderWithProviders(<Reports />, { route: "/reports" });
  return screen.findByRole("heading", { name: "Meeting Growth Over Month" });
};

describe("Reports: what was taken out", () => {
  it("no longer has Clients Active or CPs per Client, and the Meetings card no longer says 'by type'", async () => {
    await open();
    for (const gone of [/clients active/i, /by type/i, /cps run per client/i, /per client/i]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
  });

  it("keeps the Meetings card, with every type in the order a client moves through them and the counts for the range", async () => {
    await open();
    const card = (await screen.findByRole("heading", { name: "Meetings" })).closest("section");
    await waitFor(() => expect(within(card).getByText("3")).toBeInTheDocument()); // this month's CPs
    const labels = [...card.querySelectorAll("span.truncate")].map((n) => n.textContent);
    expect(labels).toEqual(["CP", "FC1", "FC2", "FC3", "Strategy", "Closing", "Policy Delivery", "Other"]);
    const counts = [...card.querySelectorAll("span.text-right")].map((n) => n.textContent);
    expect(counts).toEqual(["3", "0", "1", "0", "0", "0", "0", "0"]);
  });

  it("writes the headings with a capital on every word", async () => {
    await open();
    expect(screen.getByRole("heading", { name: "Pipeline Stage Breakdown" })).toBeInTheDocument();
    expect(screen.getByText("Meetings Held")).toBeInTheDocument();
    expect(screen.getByText("CP Meetings")).toBeInTheDocument();
  });
});

describe("Reports: meeting growth over month", () => {
  it("offers every meeting type in the order a client moves through them, with CP and FC1 chosen to begin with", async () => {
    await open();
    const group = screen.getByRole("group", { name: "Meeting types" });
    const chips = within(group).getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual(["CP", "FC1", "FC2", "FC3", "Strategy", "Closing", "Policy Delivery", "Other"]);
    expect(chips.map((c) => c.getAttribute("aria-pressed"))).toEqual([
      "true",
      "true",
      "false",
      "false",
      "false",
      "false",
      "false",
      "false",
    ]);
  });

  it("starts on the first and last day of the current month, not on the first of the next", async () => {
    await open();
    expect(screen.getByLabelText("From")).toHaveValue(`${monthKeyOf(thisMonth)}-01`);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    expect(screen.getByLabelText("To")).toHaveValue(`${monthKeyOf(last)}-${String(last.getDate()).padStart(2, "0")}`);
  });

  it("compares this month with last month for each chosen type, with the change", async () => {
    await open();
    expect(await screen.findByText(`CP: 2 in ${label(lastMonth)}, 3 in ${label(thisMonth)} (+50%)`)).toBeInTheDocument();
    expect(screen.getByText(`FC1: 1 in ${label(lastMonth)}, 0 in ${label(thisMonth)} (-100%)`)).toBeInTheDocument();
  });

  it("draws the chart, and gives the same numbers as a table", async () => {
    await open();
    expect(await screen.findByRole("img", { name: "Meetings per month for CP, FC1" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Meetings per month" });
    const rows = [...table.querySelectorAll("tr")].map((r) => [...r.querySelectorAll("th,td")].map((c) => c.textContent));
    expect(rows).toEqual([
      ["Month", "CP", "FC1"],
      [label(lastMonth), "2", "1"],
      [label(thisMonth), "3", "0"],
    ]);
  });

  it("adds a type when it is chosen and takes it away when it is chosen again", async () => {
    await open();
    await screen.findByText(/^CP: 2/);
    await userEvent.click(screen.getByRole("button", { name: "FC2" }));
    expect(await screen.findByText(`FC2: 0 in ${label(lastMonth)}, 1 in ${label(thisMonth)} (new)`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "CP" }));
    expect(screen.queryByText(/^CP: /)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Meetings per month for FC1, FC2" })).toBeInTheDocument();
  });

  it("asks for at least one type when none is chosen", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "CP" }));
    await userEvent.click(screen.getByRole("button", { name: "FC1" }));
    expect(screen.getByText("Pick at least one meeting type.")).toBeInTheDocument();
  });

  it("always asks for the month before the range, so this month has last month to compare with", async () => {
    await open();
    await waitFor(() => expect(calendar.fetchEventsInRange).toHaveBeenCalled());
    const [from] = calendar.fetchEventsInRange.mock.calls.at(-1);
    expect(monthKeyOf(new Date(from))).toBe(monthKeyOf(lastMonth));
    expect(new Date(from).getDate()).toBe(1);
  });

  it("works for a longer range: more months on the chart, still the month before the first", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Last 3 months" }));
    await waitFor(() => {
      const table = screen.getByRole("table", { name: "Meetings per month" });
      // the 3 months of the range, and the month before them
      expect(within(table).getAllByRole("row")).toHaveLength(1 + 4);
    });
  });

  it("says to connect Google Calendar when it is not connected", async () => {
    calendar.status = "disconnected";
    await open();
    expect(screen.getByText("Connect Google Calendar to see how your meetings grow.")).toBeInTheDocument();
  });
});
