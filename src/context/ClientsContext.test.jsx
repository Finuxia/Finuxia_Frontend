import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { clearLocalData } from "../lib/api";
import { act, cleanup, renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import { useAuth } from "./AuthContext";
import { useClients } from "./ClientsContext";

const CACHE_KEY = "advisorpilot.clients.advisor@example.com";

function serverClient(over = {}) {
  return {
    id: "c_1",
    first: "Ada",
    last: "Lovelace",
    phone: "",
    email: "",
    version: 1,
    stages: {},
    notes: [],
    files: [],
    interests: [],
    meeting: null,
    ...over,
  };
}

let api; // the contexts under test, for the current render
function Probe() {
  const clients = useClients();
  const auth = useAuth();
  api = { ...clients, logout: auth.logout };
  return (
    <div>
      <p>{clients.loading ? "loading" : "loaded"}</p>
      <ul>
        {clients.clients.map((c) => (
          <li key={c.id}>{`${c.first}|${c.phone}`}</li>
        ))}
      </ul>
    </div>
  );
}

const render = () => renderWithProviders(<Probe />, { providers: ["router", "toast", "auth", "clients"] });
const serve = (clients) => server.use(http.get(`${API}/api/clients`, () => HttpResponse.json(clients)));
const loaded = () => screen.findByText("loaded");
const slow = { timeout: 4000 };

describe("client sync", () => {
  describe("cache, then reconcile with the server", () => {
    it("paints from the cache at once, then replaces it with the server's state", async () => {
      localStorage.setItem(CACHE_KEY, JSON.stringify([serverClient({ first: "Cached" })]));
      server.use(
        http.get(`${API}/api/clients`, async () => {
          await new Promise((r) => setTimeout(r, 150));
          return HttpResponse.json([serverClient({ first: "Server", version: 4 }), serverClient({ id: "c_2", first: "Newer" })]);
        })
      );
      render();
      expect(await screen.findByText("Cached|")).toBeInTheDocument(); // before the server has answered
      expect(screen.getByText("loading")).toBeInTheDocument();
      expect(await screen.findByText("Server|")).toBeInTheDocument();
      expect(screen.queryByText("Cached|")).not.toBeInTheDocument();
      expect(screen.getByText("Newer|")).toBeInTheDocument();
      await waitFor(() => expect(JSON.parse(localStorage.getItem(CACHE_KEY)).map((c) => c.first)).toEqual(["Server", "Newer"]));
    });

    it("keeps showing the cache, and an error state, when the server cannot be reached", async () => {
      localStorage.setItem(CACHE_KEY, JSON.stringify([serverClient({ first: "Cached" })]));
      server.use(http.get(`${API}/api/clients`, () => HttpResponse.error()));
      render();
      await waitFor(() => expect(api?.syncError).toBeTruthy(), slow); // the load has failed
      expect(screen.getByText("Cached|")).toBeInTheDocument();
      expect(api.loading).toBe(false);
    });

    it("never writes cached clients back to the server (nothing is confirmed, so nothing is PATCHed)", async () => {
      localStorage.setItem(CACHE_KEY, JSON.stringify([serverClient({ first: "Cached" })]));
      server.use(http.get(`${API}/api/clients`, () => HttpResponse.error()));
      let patches = 0;
      server.use(http.patch(`${API}/api/clients/c_1`, () => ++patches && HttpResponse.json(serverClient())));
      render();
      await waitFor(() => expect(api?.syncError).toBeTruthy(), slow); // the load has failed: nothing is confirmed
      act(() => api.updateClient("c_1", { phone: "555" }));
      await new Promise((r) => setTimeout(r, 1000)); // longer than the sync debounce
      expect(patches).toBe(0);
    });
  });

  describe("creating a client", () => {
    it("sends the idempotency token, and a replayed create returns the same record, not a duplicate", async () => {
      serve([]);
      const bodies = [];
      const created = new Map();
      server.use(
        http.post(`${API}/api/clients`, async ({ request }) => {
          const body = await request.json();
          bodies.push(body);
          if (!created.has(body.clientToken))
            created.set(body.clientToken, serverClient({ id: `c_${created.size + 10}`, first: body.first, version: 1 }));
          return HttpResponse.json(created.get(body.clientToken), { status: created.size === 1 && bodies.length === 1 ? 201 : 200 });
        })
      );
      render();
      await loaded();
      const form = { first: "Grace", last: "Hopper" };
      let first, replay;
      await act(async () => {
        first = await api.addClient(form, { clientToken: "tok-1" });
      });
      await act(async () => {
        replay = await api.addClient(form, { clientToken: "tok-1" }); // a double click, or a retry after a lost response
      });
      expect(bodies.map((b) => b.clientToken)).toEqual(["tok-1", "tok-1"]);
      expect(replay.id).toBe(first.id);
      expect(screen.getAllByText("Grace|")).toHaveLength(1);
      await act(async () => {
        await api.addClient({ first: "Alan", last: "Turing" }, { clientToken: "tok-2" });
      });
      expect(screen.getByText("Alan|")).toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("a failed create adds nothing locally", async () => {
      serve([]);
      server.use(http.post(`${API}/api/clients`, () => HttpResponse.json({ error: "Too many clients" }, { status: 402 })));
      render();
      await loaded();
      await act(async () => {
        await expect(api.addClient({ first: "X", last: "Y" }, { clientToken: "t" })).rejects.toThrow("Too many clients");
      });
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    });
  });

  describe("editing", () => {
    it("a stale version is a conflict: the UI adopts the server's copy instead of overwriting it", async () => {
      serve([serverClient()]);
      const patches = [];
      server.use(
        http.patch(`${API}/api/clients/c_1`, async ({ request }) => {
          patches.push(await request.json());
          return HttpResponse.json(
            { error: "Changed elsewhere", client: serverClient({ first: "Ada (edited elsewhere)", phone: "999", version: 3 }) },
            { status: 409 }
          );
        })
      );
      render();
      await screen.findByText("Ada|");
      act(() => api.updateClient("c_1", { phone: "555" }));
      expect(await screen.findByText("Ada (edited elsewhere)|999", {}, slow)).toBeInTheDocument();
      expect(await screen.findByText(/was changed elsewhere/)).toBeInTheDocument();
      expect(patches).toHaveLength(1); // not retried with our stale copy, not looped
      expect(patches[0].version).toBe(1);
      await new Promise((r) => setTimeout(r, 900));
      expect(patches).toHaveLength(1); // and the adopted copy is not echoed back as an edit
    });

    it("after a conflict the next edit is sent against the server's newer version", async () => {
      serve([serverClient()]);
      const versions = [];
      server.use(
        http.patch(`${API}/api/clients/c_1`, async ({ request }) => {
          const body = await request.json();
          versions.push(body.version);
          return versions.length === 1
            ? HttpResponse.json({ client: serverClient({ first: "Ada", phone: "999", version: 3 }) }, { status: 409 })
            : HttpResponse.json(serverClient({ ...body, version: 4 }));
        })
      );
      render();
      await screen.findByText("Ada|");
      act(() => api.updateClient("c_1", { phone: "555" }));
      await screen.findByText("Ada|999", {}, slow);
      act(() => api.updateClient("c_1", { phone: "777" }));
      await waitFor(() => expect(versions).toEqual([1, 3]), slow);
    });

    it("two rapid edits to the same client are sent together, so the first is not lost", async () => {
      serve([serverClient()]);
      const patches = [];
      server.use(
        http.patch(`${API}/api/clients/c_1`, async ({ request }) => {
          const body = await request.json();
          patches.push(body);
          return HttpResponse.json(serverClient({ ...body, version: 2 }));
        })
      );
      render();
      await screen.findByText("Ada|");
      act(() => api.updateClient("c_1", { first: "Augusta" }));
      act(() => api.updateClient("c_1", { phone: "555" }));
      await waitFor(() => expect(patches).toHaveLength(1), slow);
      expect(patches[0]).toMatchObject({ first: "Augusta", phone: "555", version: 1 });
    });

    it("an edit made while the previous save is in flight is saved after it, with both changes", async () => {
      serve([serverClient()]);
      const patches = [];
      let release;
      const gate = new Promise((r) => (release = r));
      server.use(
        http.patch(`${API}/api/clients/c_1`, async ({ request }) => {
          const body = await request.json();
          patches.push(body);
          if (patches.length === 1) await gate; // hold the first save open
          return HttpResponse.json(serverClient({ ...body, version: body.version + 1 }));
        })
      );
      render();
      await screen.findByText("Ada|");
      act(() => api.updateClient("c_1", { first: "Augusta" }));
      await waitFor(() => expect(patches).toHaveLength(1), slow); // first save is now in flight
      act(() => api.updateClient("c_1", { phone: "555" })); // edited again before it came back
      await new Promise((r) => setTimeout(r, 800)); // its debounce passes while the first is still held
      release();
      await waitFor(() => expect(patches).toHaveLength(2), slow);
      expect(patches[0]).toMatchObject({ first: "Augusta", version: 1 });
      expect(patches[0].phone).toBe("");
      expect(patches[1]).toMatchObject({ first: "Augusta", phone: "555", version: 2 }); // the first edit is still there
      expect(screen.getByText("Augusta|555")).toBeInTheDocument();
    });

    it("a client removed elsewhere disappears locally, with a message, instead of failing forever", async () => {
      serve([serverClient()]);
      server.use(http.patch(`${API}/api/clients/c_1`, () => HttpResponse.json({ error: "Not found" }, { status: 404 })));
      render();
      await screen.findByText("Ada|");
      act(() => api.updateClient("c_1", { phone: "1" }));
      await waitFor(() => expect(screen.queryByText(/Ada\|/)).not.toBeInTheDocument(), slow);
      expect(await screen.findByText(/no longer exists/)).toBeInTheDocument();
    });

    it("a failed save is retried, and the edit is not lost", async () => {
      serve([serverClient()]);
      let attempts = 0;
      server.use(
        http.patch(`${API}/api/clients/c_1`, async ({ request }) => {
          const body = await request.json();
          return ++attempts === 1
            ? HttpResponse.json({ error: "Server busy" }, { status: 503 })
            : HttpResponse.json(serverClient({ ...body, version: 2 }));
        })
      );
      render();
      await screen.findByText("Ada|");
      act(() => api.updateClient("c_1", { phone: "555" }));
      await waitFor(() => expect(attempts).toBe(1), slow);
      expect(screen.getByText("Ada|555")).toBeInTheDocument(); // still shown, not rolled back
      await waitFor(() => expect(attempts).toBe(2), { timeout: 9000 }); // the retry timer
    }, 15000);
  });

  describe("logging out", () => {
    it("clears the clients from memory and from the browser's cache", async () => {
      serve([serverClient({ first: "Private" })]);
      render();
      await screen.findByText("Private|");
      await waitFor(() => expect(localStorage.getItem(CACHE_KEY)).toContain("Private"));
      act(() => api.logout());
      await waitFor(() => expect(screen.queryAllByRole("listitem")).toHaveLength(0));
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
      expect(Object.keys(localStorage).filter((k) => k.startsWith("advisorpilot."))).toEqual([]);
    });

    // What matters is that nothing WRITES after the clear, so the test watches the writes instead of sleeping past them.
    const ours = (spy) => spy.mock.calls.filter(([key]) => String(key).startsWith("advisorpilot."));
    const settled = async () => {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    };

    it("does not write the cleared state back into the cache afterwards", async () => {
      serve([serverClient({ first: "Private" })]);
      render();
      await screen.findByText("Private|");
      await waitFor(() => expect(localStorage.getItem(CACHE_KEY)).toContain("Private")); // the load has finished and written its cache
      const writes = vi.spyOn(Storage.prototype, "setItem");
      act(() => api.logout());
      await waitFor(() => expect(screen.queryAllByRole("listitem")).toHaveLength(0));
      await settled();
      expect(ours(writes)).toEqual([]);
      expect(Object.keys(localStorage).filter((k) => k.startsWith("advisorpilot."))).toEqual([]);
      writes.mockRestore();
    });

    it("refuses a write that arrives after the clear but before the signed-in account has changed (the window logout leaves open)", async () => {
      serve([serverClient({ first: "Private" })]);
      render();
      await screen.findByText("Private|");
      await waitFor(() => expect(localStorage.getItem(CACHE_KEY)).toContain("Private"));
      // The first thing logout does is clear the browser's copy; the signed-in account is only dropped a moment later. A change landing in
      // between used to re-persist the client list into local storage: the logged-out machine kept the advisor's clients.
      clearLocalData();
      act(() => api.updateClient("c_1", { phone: "555" }));
      await settled();
      expect(Object.keys(localStorage).filter((k) => k.startsWith("advisorpilot."))).toEqual([]);
    });

    it("writes the cache again once somebody signs in", async () => {
      serve([serverClient({ first: "Ada" })]);
      render();
      await screen.findByText("Ada|");
      await waitFor(() => expect(localStorage.getItem(CACHE_KEY)).toContain("Ada"));
      clearLocalData();
      act(() => api.logout());
      await waitFor(() => expect(screen.queryAllByRole("listitem")).toHaveLength(0));
      cleanup();
      localStorage.clear();
      serve([serverClient({ first: "Grace" })]);
      render();
      await screen.findByText("Grace|");
      await waitFor(() => expect(localStorage.getItem(CACHE_KEY)).toContain("Grace"));
    });
  });
});

describe("a conflict message", () => {
  it("offers Refresh, which takes the server's latest copy of everything", async () => {
    let loads = 0;
    server.use(
      http.get(`${API}/api/clients`, () => {
        loads += 1;
        return HttpResponse.json([serverClient(loads === 1 ? {} : { first: "Ada (latest)", version: 6, phone: "123" })]);
      }),
      http.patch(`${API}/api/clients/c_1`, () =>
        HttpResponse.json(
          { error: "Changed elsewhere", client: serverClient({ first: "Ada (edited elsewhere)", version: 3 }) },
          { status: 409 }
        )
      )
    );
    render();
    await screen.findByText("Ada|");
    act(() => api.updateClient("c_1", { phone: "555" }));
    expect(await screen.findByText(/was changed elsewhere/, {}, slow)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("Ada (latest)|123", {}, slow)).toBeInTheDocument();
    expect(loads).toBe(2);
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument(); // the toast closes
  });
});

describe("client workspace actions", () => {
  it("keeps contact, stage, note, file, task, import, and group actions consistent", async () => {
    serve([
      serverClient({
        currentStage: "cp",
        followUpDate: "",
        lastContactDate: "2026-01-01",
        lastContact: "Met — 2026-01-01",
        stages: {
          cp: { status: "upcoming", data: {}, files: [] },
          fc1: { status: "upcoming", data: {}, files: [] },
          client: { status: "upcoming", data: {}, files: [] },
        },
        notes: [{ id: "n1", text: "Original" }],
        files: [
          { id: "pending", status: "pending" },
          { id: "done", status: "done" },
        ],
        meeting: { date: "2026-06-01", time: "10:30" },
      }),
    ]);
    server.use(
      http.post(`${API}/api/clients/import`, async ({ request }) => {
        const { clients: rows } = await request.json();
        return HttpResponse.json(rows.map((row, index) => serverClient({ ...row, id: `import-${index}`, version: 1 })));
      }),
      http.patch(`${API}/api/clients/:id`, async ({ request }) => HttpResponse.json({ ...(await request.json()), version: 2 }))
    );
    render();
    await screen.findByText("Ada|");

    act(() => {
      api.editClient("missing", { first: "No", last: "Client" });
      api.editClient("c_1", { first: " Ada ", last: " Lovelace ", nextFollowUpDate: "", lastContactDate: "2026-01-01" });
      api.editClient("c_1", { first: "Ada", last: "Lovelace", nextFollowUpDate: "2026-06-20", lastContactDate: "2026-01-02" });
      api.editClient("c_1", { first: "Ada", last: "Lovelace", nextFollowUpDate: "2026-06-20", lastContactDate: "" });
      api.addNote("c_1", "   ");
      api.addNote("c_1", "  Follow up  ");
      api.editNote("c_1", "n1", "Updated");
      api.editNote("missing", "n1", "No-op");
      api.deleteNote("c_1", "n1");
      api.deleteNote("missing", "n1");
      api.updateStage("missing", "cp", { status: "completed" });
      api.updateStage("c_1", "cp", { status: "completed", date: "2026-06-03", note: "  Met  " });
      api.updateStage("c_1", "cp", { status: "skipped", date: "2026-06-04", note: "" });
      api.updateStage("c_1", "fc1", { status: "completed", date: "2026-06-05", note: "" });
      api.updateClient("c_1", { currentStage: "client" });
      api.updateStage("c_1", "client", { status: "completed", note: "Final stage" });
      api.setStageGoogleEventId("c_1", "new-stage", "event-1");
      api.setStageGoogleEventId("missing", "new-stage", "event-2");
      api.setStageGoogleEventId("c_1", "new-stage", null);
      api.markContacted("c_1");
      api.snooze("c_1");
      api.snooze("missing", 2);
      api.rescheduleFollowUp("c_1", "2026-06-22");
      api.rescheduleMeeting("c_1", "2026-06-23", "11:00");
      api.rescheduleMeeting("missing", "2026-06-23");
      api.toggleFileStatus("c_1", "pending");
      api.toggleFileStatus("c_1", "done");
      api.toggleFileStatus("missing", "pending");
      api.toggleDailyTask("c_1", "call");
      api.toggleDailyTask("c_1", "call");
      api.toggleDailyTask("c_1", "email", "2026-06-20");
      api.addGroup("   ");
      api.addGroup("  Household  ");
      api.addGroup("Business", "av-purple");
    });

    const household = api.groups.find((group) => group.name === "Household");
    act(() => {
      api.updateGroup("missing", { name: "No-op" });
      api.updateGroup(household.id, { name: "Family" });
      api.setGroupMembers(household.id, ["c_1"]);
      api.toggleClientInGroup(household.id, 1);
      api.toggleClientInGroup(household.id, "c_1");
      api.toggleClientInGroup("missing", "c_1");
      api.deleteGroup("missing");
    });

    expect(api.getClient("c_1")).toMatchObject({ first: "Ada", last: "Lovelace", followUpDate: "2026-06-22" });
    expect(api.getClient("c_1").stages.fc1.status).toBe("completed");
    expect(api.getClient("c_1").currentStage).toBe("client");
    expect(api.getClient("c_1").lastContact).toBe("Logged contact, today");
    expect(api.getClient("c_1").notes.some((note) => note.text === "Follow up")).toBe(true);
    expect(api.getClient("c_1").files.map((file) => file.status)).toEqual(["done", "pending"]);
    expect(api.isTaskDoneToday("c_1", "call")).toBe(false);
    expect(api.isTaskDoneToday("c_1", "email", "2026-06-20")).toBe(true);
    expect(api.getGroupsForClient("1")).toHaveLength(1);
    expect(api.groups).toHaveLength(2);
    act(() => api.deleteGroup(household.id));
    expect(api.groups).toHaveLength(1);

    let imported;
    await act(async () => {
      imported = await api.importClients([
        { Name: "A New Client", Stage: "FC1", "Next Follow-up": "2026-06-30", "Last Contact": "2026-06-01" },
        { Name: "SAMPLE delete this row" },
        { Phone: "no name" },
      ]);
    });
    expect(imported).toMatchObject({ successCount: 1, failedRows: [{ row: 3, error: "Missing Name" }] });
  });
});
