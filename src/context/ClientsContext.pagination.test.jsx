import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { act, renderWithProviders, screen, waitFor } from "../test/utils";
import { useAuth } from "./AuthContext";
import { useClients } from "./ClientsContext";

const CACHE_KEY = "advisorpilot.clients.advisor@example.com";
const client = (n, over = {}) => ({
  id: `c_${n}`,
  first: `Client${n}`,
  last: "X",
  phone: "",
  email: "",
  version: 1,
  stages: {},
  notes: [],
  files: [],
  interests: [],
  meeting: null,
  ...over,
});

let ctx;
function Probe() {
  const clients = useClients();
  const auth = useAuth();
  ctx = { ...clients, logout: auth.logout };
  return (
    <div>
      <p data-testid="state">{clients.loading ? "loading" : "loaded"}</p>
      <p data-testid="more">{String(clients.loadingMore)}</p>
      <ul>
        {clients.clients.map((c) => (
          <li key={c.id}>{`${c.first}|${c.phone}`}</li>
        ))}
      </ul>
    </div>
  );
}
const render = () => renderWithProviders(<Probe />, { providers: ["router", "toast", "auth", "clients"] });
const names = () => screen.queryAllByRole("listitem").map((li) => li.textContent.split("|")[0]);

/** Serves `all` in pages of `size`, each page after `delays[n]` ms; records every request's cursor. */
function pagedServer(all, { size = 2, delays = [], failOnPage = 0 } = {}) {
  const asked = [];
  server.use(
    http.get(`${API}/api/clients`, async ({ request }) => {
      const cursor = new URL(request.url).searchParams.get("cursor");
      asked.push(cursor);
      const n = asked.length;
      if (delays[n - 1]) await new Promise((r) => setTimeout(r, delays[n - 1]));
      if (failOnPage === n) return HttpResponse.json({ error: "Page failed" }, { status: 500 });
      const start = cursor ? Number(atob(cursor)) : 0;
      const end = Math.min(start + size, all.length);
      return HttpResponse.json({ results: all.slice(start, end), nextCursor: end < all.length ? btoa(String(end)) : null });
    })
  );
  return asked;
}

describe("clients arriving a page at a time", () => {
  it("with nothing on screen yet, the first page is shown at once and the rest are added behind it", async () => {
    pagedServer(
      [1, 2, 3, 4, 5].map((n) => client(n)),
      { delays: [0, 200, 0] }
    );
    render();
    await waitFor(() => expect(names()).toEqual(["Client1", "Client2"]));
    expect(screen.getByTestId("state")).toHaveTextContent("loaded"); // not held up by the pages still to come
    expect(screen.getByTestId("more")).toHaveTextContent("true");
    await waitFor(() => expect(names()).toEqual(["Client1", "Client2", "Client3", "Client4", "Client5"]), { timeout: 4000 });
    await waitFor(() => expect(screen.getByTestId("more")).toHaveTextContent("false"));
  });

  it("asks for the pages one after another, following the cursor", async () => {
    const asked = pagedServer([1, 2, 3, 4, 5].map((n) => client(n)));
    render();
    await waitFor(() => expect(names()).toHaveLength(5));
    expect(asked).toEqual([null, btoa("2"), btoa("4")]);
  });

  it("with the cache already on screen the list is not replaced by a shorter one: the complete list is swapped in at the end", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify([1, 2, 3, 4, 5].map((n) => client(n, { first: `Cached${n}` }))));
    pagedServer(
      [1, 2, 3, 4, 5].map((n) => client(n, { first: `Server${n}` })),
      { delays: [0, 250] }
    );
    render();
    expect(await screen.findByText("Cached1|")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 120)); // the first server page has arrived; the second has not
    expect(names()).toEqual(["Cached1", "Cached2", "Cached3", "Cached4", "Cached5"]); // never shrinks to a first page
    await waitFor(() => expect(names()).toEqual(["Server1", "Server2", "Server3", "Server4", "Server5"]), { timeout: 4000 });
  });

  it("the cache holds the complete list once it has arrived, not a first page", async () => {
    pagedServer([1, 2, 3, 4, 5].map((n) => client(n)));
    render();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CACHE_KEY) || "[]")).toHaveLength(5));
  });

  it("an edit made while the rest are still arriving is kept, and is sent once everything has loaded", async () => {
    pagedServer(
      [1, 2, 3, 4].map((n) => client(n)),
      { delays: [0, 300] }
    );
    const patches = [];
    server.use(
      http.patch(`${API}/api/clients/:ref`, async ({ params, request }) => {
        patches.push({ ref: params.ref, body: await request.json() });
        return HttpResponse.json(client(1, { phone: "555", version: 2 }));
      })
    );
    render();
    await waitFor(() => expect(names()).toEqual(["Client1", "Client2"]));
    act(() => ctx.updateClient("c_1", { phone: "555" })); // while page 2 is still on its way
    expect(screen.getByText("Client1|555")).toBeInTheDocument();
    await waitFor(() => expect(names()).toHaveLength(4), { timeout: 4000 });
    expect(screen.getByText("Client1|555")).toBeInTheDocument(); // the late pages did not overwrite it
    await waitFor(() => expect(patches).toHaveLength(1), { timeout: 4000 });
    expect(patches[0].ref).toBe("c_1");
    expect(patches[0].body.version).toBe(1);
  });

  it("clients on pages not yet loaded are never treated as deleted", async () => {
    pagedServer(
      [1, 2, 3, 4, 5, 6].map((n) => client(n)),
      { delays: [0, 250, 250] }
    );
    const deletes = [];
    server.use(http.delete(`${API}/api/clients/:ref`, ({ params }) => (deletes.push(params.ref), new HttpResponse(null, { status: 204 }))));
    render();
    await waitFor(() => expect(names()).toHaveLength(2));
    await waitFor(() => expect(names()).toHaveLength(6), { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 900)); // long enough for any sync to have run
    expect(deletes).toEqual([]);
  });

  it("a page that fails leaves the clients already loaded, and says so", async () => {
    pagedServer(
      [1, 2, 3, 4, 5].map((n) => client(n)),
      { failOnPage: 2 }
    );
    render();
    await waitFor(() => expect(ctx?.syncError).toBeTruthy(), { timeout: 4000 });
    expect(names()).toEqual(["Client1", "Client2"]);
    expect(screen.getByTestId("more")).toHaveTextContent("false");
    expect(screen.getByTestId("state")).toHaveTextContent("loaded");
  });

  it("a client that appears on two pages (the list shifted meanwhile) is shown once", async () => {
    let n = 0;
    server.use(
      http.get(`${API}/api/clients`, () => {
        n += 1;
        return n === 1
          ? HttpResponse.json({ results: [client(1), client(2)], nextCursor: "next" })
          : HttpResponse.json({ results: [client(2), client(3)], nextCursor: null });
      })
    );
    render();
    await waitFor(() => expect(names()).toEqual(["Client1", "Client2", "Client3"]));
  });

  it("a client that comes round again on a later page, newer, does not replace our baseline: an edit is sent against the version we first saw", async () => {
    let n = 0;
    server.use(
      http.get(`${API}/api/clients`, () => {
        n += 1;
        return n === 1
          ? HttpResponse.json({ results: [client(1, { version: 1 })], nextCursor: "next" })
          : HttpResponse.json({ results: [client(1, { version: 5, phone: "999" })], nextCursor: null });
      })
    );
    const patches = [];
    server.use(
      http.patch(`${API}/api/clients/:ref`, async ({ request }) => {
        patches.push(await request.json());
        return HttpResponse.json(client(1, { version: 6, phone: "555" }));
      })
    );
    render();
    await waitFor(() => expect(n).toBe(2)); // both pages asked for
    await waitFor(() => expect(screen.getByTestId("more")).toHaveTextContent("false")); // and the loading finished
    expect(names()).toEqual(["Client1"]);
    act(() => ctx.updateClient("c_1", { phone: "555" }));
    await waitFor(() => expect(patches).toHaveLength(1), { timeout: 4000 });
    expect(patches[0].version).toBe(1); // the version we confirmed, so the server can tell us if it moved on (a 409), never a silent overwrite
  });

  it("signing out while later pages are still on their way does not bring the clients back", async () => {
    pagedServer(
      [1, 2, 3, 4].map((n) => client(n)),
      { delays: [0, 250] }
    );
    render();
    await waitFor(() => expect(names()).toEqual(["Client1", "Client2"])); // the first page is on screen, the second is in flight
    await act(async () => {
      await ctx.logout();
    });
    await waitFor(() => expect(names()).toEqual([]));
    await new Promise((r) => setTimeout(r, 450)); // the second page arrives after the sign-out
    expect(names()).toEqual([]);
  });

  it("still works against a server that returns the whole list at once", async () => {
    server.use(http.get(`${API}/api/clients`, () => HttpResponse.json([client(1), client(2), client(3)])));
    render();
    await waitFor(() => expect(names()).toEqual(["Client1", "Client2", "Client3"]));
    expect(screen.getByTestId("more")).toHaveTextContent("false");
  });
});
