import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import MyDay from "./MyDay";

// The calendar day as the app sees it (local time; the suite runs in America/Edmonton), not the UTC day: for seven hours of every UTC day they differ.
const localDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const now = new Date();
const today = localDay(now);
const tomorrow = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
const reminder = (id, over = {}) => ({
  id,
  title: `Task ${id}`,
  note: "",
  dueDate: "2020-01-01",
  dueTime: null,
  status: "pending",
  kind: "reminder",
  repeat: "none",
  clientRef: null,
  ...over,
});

let confirm;
beforeEach(() => {
  confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => confirm.mockRestore());

/** Serves reminders from a list that completing updates, and records what was called. */
function serve(initial) {
  const state = { list: initial, completed: [], dueCalls: [] };
  server.use(
    http.get(`${API}/api/reminders`, () => HttpResponse.json({ results: state.list, nextCursor: null })),
    http.post(`${API}/api/reminders/complete-due`, async ({ request }) => {
      const { date } = await request.json();
      state.dueCalls.push(date);
      const due = state.list.filter((r) => r.status === "pending" && r.dueDate <= date);
      state.list = state.list.map((r) => (due.includes(r) ? { ...r, status: "completed" } : r));
      return HttpResponse.json({ completed: due.length });
    }),
    http.post(`${API}/api/reminders/:id/status`, async ({ params, request }) => {
      const { status } = await request.json();
      state.completed.push(Number(params.id));
      state.list = state.list.map((r) => (r.id === Number(params.id) ? { ...r, status } : r));
      return HttpResponse.json(state.list.find((r) => r.id === Number(params.id)));
    })
  );
  return state;
}

describe("My Day: complete every reminder at once", () => {
  it("asks once, then has the server complete everything due today or earlier in one request", async () => {
    const state = serve([
      reminder(1),
      reminder(2),
      reminder(3, { dueDate: today }),
      reminder(4, { status: "completed" }),
      reminder(5, { dueDate: tomorrow }),
    ]);
    renderWithProviders(<MyDay />);
    await userEvent.click(await screen.findByRole("button", { name: "Complete all (3)" }));
    expect(confirm).toHaveBeenCalledWith("Mark 3 reminders as done?");
    expect(await screen.findByText("3 reminders marked done.")).toBeInTheDocument();
    expect(state.dueCalls).toEqual([today]);
    expect(state.completed).toEqual([]); // not one request per reminder
    await waitFor(() => expect(screen.queryByRole("button", { name: /complete all/i })).not.toBeInTheDocument());
  });

  it("does nothing when the person says no", async () => {
    const state = serve([reminder(1), reminder(2)]);
    confirm.mockReturnValueOnce(false);
    renderWithProviders(<MyDay />);
    await userEvent.click(await screen.findByRole("button", { name: "Complete all (2)" }));
    expect(state.dueCalls).toEqual([]);
    expect(screen.getByRole("button", { name: "Complete all (2)" })).toBeInTheDocument();
  });

  it("is not offered for a single reminder", async () => {
    serve([reminder(1)]);
    renderWithProviders(<MyDay />);
    await screen.findByText("Task 1");
    expect(screen.queryByRole("button", { name: /complete all/i })).not.toBeInTheDocument();
  });

  it("says so, and changes nothing, when the server refuses", async () => {
    serve([reminder(1), reminder(2)]);
    server.use(http.post(`${API}/api/reminders/complete-due`, () => HttpResponse.json({ error: "Not today's date." }, { status: 400 })));
    renderWithProviders(<MyDay />);
    await userEvent.click(await screen.findByRole("button", { name: "Complete all (2)" }));
    expect(await screen.findByText("Not today's date.")).toBeInTheDocument();
    expect(screen.queryByText(/marked done/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete all (2)" })).toBeInTheDocument();
  });

  it("on another day, completes that day's reminders one at a time and carries on past one that fails", async () => {
    const state = serve([reminder(1, { dueDate: tomorrow }), reminder(2, { dueDate: tomorrow }), reminder(3, { dueDate: tomorrow })]);
    server.use(http.post(`${API}/api/reminders/2/status`, () => HttpResponse.json({ error: "broken" }, { status: 500 })));
    renderWithProviders(<MyDay />);
    await userEvent.click(await screen.findByRole("button", { name: "Next day" }));
    await userEvent.click(await screen.findByRole("button", { name: "Complete all (3)" }));
    expect(await screen.findByText("2 done; 1 could not be updated.")).toBeInTheDocument();
    expect(state.completed).toEqual([1, 3]);
    expect(state.dueCalls).toEqual([]); // the whole-list endpoint is for today only
  });
});
