import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { useClients } from "../context/ClientsContext";
import { PIPELINE_STAGES } from "../lib/pipeline";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import Clients from "./Clients";

const row = (n) => ({
  id: `c_${n}`,
  first: `Client${n}`,
  last: "Test",
  phone: "",
  email: "",
  telegram: "",
  color: "av-blue",
  priority: "Medium",
  currentStage: PIPELINE_STAGES[0].id,
  nextFollowUp: "TBD",
  version: 1,
  stages: {},
  notes: [],
  files: [],
  interests: [],
  meeting: null,
});

/** A server holding the advisor's clients: the list reads them, creating one adds it. Counts the list reads. */
function serve(initial) {
  const state = { all: initial, reads: 0 };
  server.use(
    http.get(`${API}/api/clients`, () => {
      state.reads += 1;
      return HttpResponse.json({ results: state.all, nextCursor: null });
    }),
    http.post(`${API}/api/clients`, async ({ request }) => {
      const body = await request.json();
      const created = { ...row(state.all.length + 1), first: body.first, last: body.last };
      state.all = [created, ...state.all];
      return HttpResponse.json(created, { status: 201 });
    })
  );
  return state;
}

/** Stands in for the Add Client button in the layout: it calls the context, as the real one does. */
function AddButton() {
  const { addClient } = useClients();
  return (
    <button type="button" onClick={() => addClient({ first: "Nadia", last: "New" })}>
      Add test client
    </button>
  );
}

describe("the clients list after a client is added", () => {
  it("shows the new client without a page reload", async () => {
    serve([row(1)]);
    renderWithProviders(
      <>
        <AddButton />
        <Clients />
      </>,
      { route: "/clients" }
    );
    expect(await screen.findByText(/Client1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add test client" }));
    expect(await screen.findByText(/Nadia/)).toBeInTheDocument();
  });

  it("does not ask the server again while nothing has changed", async () => {
    const state = serve([row(1), row(2)]);
    renderWithProviders(<Clients />, { route: "/clients" });
    expect(await screen.findByText(/Client1/)).toBeInTheDocument();
    await waitFor(() => expect(state.reads).toBeGreaterThan(0));
    const settled = state.reads;
    await new Promise((r) => setTimeout(r, 200));
    expect(state.reads).toBe(settled);
  });
});
