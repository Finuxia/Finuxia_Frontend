import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import MyDay from "./MyDay";

const today = new Date().toISOString().slice(0, 10);
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

/** Serves reminders from a list that completing one updates, and records the order the completions arrive in. */
function serve(initial) {
  const state = { list: initial, completed: [] };
  server.use(
    http.get(`${API}/api/reminders`, () => HttpResponse.json({ results: state.list, nextCursor: null })),
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
  it("completes every pending reminder after asking, one after another, and says how many", async () => {
    const state = serve([reminder(1), reminder(2), reminder(3, { dueDate: today }), reminder(4, { status: "completed" })]);
    renderWithProviders(<MyDay />);
    await userEvent.click(await screen.findByRole("button", { name: "Complete all (3)" }));
    expect(confirm).toHaveBeenCalledWith("Mark 3 reminders as done?");
    expect(await screen.findByText("3 reminders marked done.")).toBeInTheDocument();
    expect(state.completed).toEqual([1, 2, 3]);
    await waitFor(() => expect(screen.queryByRole("button", { name: /complete all/i })).not.toBeInTheDocument());
  });

  it("does nothing when the person says no", async () => {
    const state = serve([reminder(1), reminder(2)]);
    confirm.mockReturnValueOnce(false);
    renderWithProviders(<MyDay />);
    await userEvent.click(await screen.findByRole("button", { name: "Complete all (2)" }));
    expect(state.completed).toEqual([]);
    expect(screen.getByRole("button", { name: "Complete all (2)" })).toBeInTheDocument();
  });

  it("is not offered for a single reminder", async () => {
    serve([reminder(1)]);
    renderWithProviders(<MyDay />);
    await screen.findByText("Task 1");
    expect(screen.queryByRole("button", { name: /complete all/i })).not.toBeInTheDocument();
  });

  it("carries on past one that fails, and says so", async () => {
    const state = serve([reminder(1), reminder(2), reminder(3)]);
    server.use(http.post(`${API}/api/reminders/2/status`, () => HttpResponse.json({ error: "broken" }, { status: 500 })));
    renderWithProviders(<MyDay />);
    await userEvent.click(await screen.findByRole("button", { name: "Complete all (3)" }));
    expect(await screen.findByText("2 done; 1 could not be updated.")).toBeInTheDocument();
    expect(state.completed).toEqual([1, 3]);
  });
});
