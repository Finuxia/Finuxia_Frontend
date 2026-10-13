import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { PIPELINE_STAGES } from "../lib/pipeline";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import Clients from "./Clients";

const STAGE = PIPELINE_STAGES[1].id;
const client = (n, over = {}) => ({
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
  ...over,
});

/**
 * A server that filters and pages like the real one: `q` (every word must match the name), `stage`, `priority`, then `limit`/`cursor`. Records every
 * request's query so a test can see what the PAGE asked for. The clients context also reads the list (to keep its own copy), unfiltered.
 */
function serve(all, { size = 2 } = {}) {
  const asked = [];
  asked.failCursor = false; // set once the context has read everything, so only the page's own "Load more" meets the failure
  server.use(
    http.get(`${API}/api/clients`, ({ request }) => {
      const params = Object.fromEntries(new URL(request.url).searchParams);
      asked.push(params);
      if (asked.failCursor && params.cursor) return HttpResponse.json({ error: "Page failed" }, { status: 500 });
      let rows = all;
      for (const word of (params.q || "").toLowerCase().split(" ").filter(Boolean))
        rows = rows.filter((c) => `${c.first} ${c.last}`.toLowerCase().includes(word));
      if (params.stage) rows = rows.filter((c) => c.currentStage === params.stage);
      if (params.priority) rows = rows.filter((c) => c.priority === params.priority);
      const start = params.cursor ? Number(atob(params.cursor)) : 0;
      const end = Math.min(start + size, rows.length);
      return HttpResponse.json({ results: rows.slice(start, end), nextCursor: end < rows.length ? btoa(String(end)) : null });
    })
  );
  return asked;
}
const show = () => renderWithProviders(<Clients />, { providers: ["router", "toast", "auth", "clients"] });
const rows = () => [...document.querySelectorAll("button p.font-semibold")].map((p) => p.textContent.split(" ")[0]);
/** What the page itself asked for. The clients context also reads the whole list (unfiltered), so only requests carrying a filter are the page's. */
const pageRequests = (asked) => asked.filter((p) => p.q || p.stage || p.priority);

describe("the clients list, asked of the server", () => {
  it("shows the first page, and Load more follows the cursor to the next, until there is none", async () => {
    serve([1, 2, 3, 4, 5].map((n) => client(n)));
    show();
    await waitFor(() => expect(rows()).toEqual(["Client1", "Client2"]));
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toEqual(["Client1", "Client2", "Client3", "Client4"]));
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(5));
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument(); // the last page ends it
  });

  it("a search is sent to the server, once the typing pauses, and only what it returns is shown", async () => {
    const asked = serve([client(1, { first: "Alice" }), client(2, { first: "Bob" }), client(3, { first: "Alicia" })]);
    show();
    await waitFor(() => expect(rows()).toHaveLength(2));
    await userEvent.type(screen.getByPlaceholderText(/Search name/), "ali");
    await waitFor(() => expect(rows()).toEqual(["Alice", "Alicia"]));
    const searches = pageRequests(asked).filter((p) => p.q);
    expect(searches.map((p) => p.q)).toEqual(["ali"]); // one request for "ali", not one for "a", "al" and "ali"
  });

  it("a stage and a priority are sent to the server and replace the list from its first page", async () => {
    const asked = serve([
      client(1, { currentStage: PIPELINE_STAGES[0].id, priority: "High" }),
      client(2, { currentStage: STAGE, priority: "High" }),
      client(3, { currentStage: STAGE, priority: "Low" }),
      client(4, { currentStage: STAGE, priority: "High" }),
    ]);
    show();
    await waitFor(() => expect(rows()).toEqual(["Client1", "Client2"]));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], STAGE);
    await waitFor(() => expect(rows()).toEqual(["Client2", "Client3"]));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "High");
    await waitFor(() => expect(rows()).toEqual(["Client2", "Client4"]));
    expect(pageRequests(asked).map((p) => [p.stage ?? "", p.priority ?? "", p.cursor ?? ""])).toEqual([
      [STAGE, "", ""],
      [STAGE, "High", ""], // each change starts from the first page, never from the old cursor
    ]);
  });

  it("filters work across pages: a match on a later page is found, not only within what was loaded", async () => {
    serve([...[1, 2, 3, 4, 5, 6].map((n) => client(n)), client(7, { first: "Needle" })]);
    show();
    await waitFor(() => expect(rows()).toHaveLength(2));
    await userEvent.type(screen.getByPlaceholderText(/Search name/), "needle");
    await waitFor(() => expect(rows()).toEqual(["Needle"]));
  });

  it("the total is the whole list, whatever is filtered", async () => {
    serve([1, 2, 3, 4, 5].map((n) => client(n)));
    show();
    await screen.findByText("5 total");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "Low");
    await waitFor(() => expect(rows()).toEqual([]));
    expect(screen.getByText("5 total")).toBeInTheDocument();
  });

  it("nothing matching says so", async () => {
    serve([client(1)]);
    show();
    await waitFor(() => expect(rows()).toEqual(["Client1"]));
    await userEvent.type(screen.getByPlaceholderText(/Search name/), "zzz");
    expect(await screen.findByText("No clients match your filters.")).toBeInTheDocument();
  });

  it("a page that fails leaves the clients already shown and offers a retry", async () => {
    const asked = serve([1, 2, 3, 4].map((n) => client(n)));
    show();
    await waitFor(() => expect(rows()).toEqual(["Client1", "Client2"]));
    await screen.findByText("4 total"); // the context has read everything
    asked.failCursor = true;
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText(/Could not load more/)).toBeInTheDocument();
    expect(rows()).toEqual(["Client1", "Client2"]); // still there
    asked.failCursor = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(rows()).toEqual(["Client1", "Client2", "Client3", "Client4"]));
  });

  it("a failure of the first page is explained, with a retry", async () => {
    let fail = true;
    server.use(
      http.get(`${API}/api/clients`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        if (fail && params.get("stage")) return HttpResponse.json({ error: "Could not search" }, { status: 500 });
        return HttpResponse.json({ results: [client(1)], nextCursor: null });
      })
    );
    show();
    await waitFor(() => expect(rows()).toEqual(["Client1"]));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], STAGE);
    expect(await screen.findByText("Could not search")).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(rows()).toEqual(["Client1"]));
  });
});
