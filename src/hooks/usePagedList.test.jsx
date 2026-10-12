import { http, HttpResponse } from "msw";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { act, render, screen, userEvent, waitFor } from "../test/utils";
import usePagedList from "./usePagedList";

const numbered = (n, from = 1) => Array.from({ length: n }, (_, i) => ({ id: from + i }));

function serve(path, items, { size = 2, delayMs = 0, failOn = [] } = {}) {
  const log = [];
  server.use(
    http.get(`${API}${path}`, async ({ request }) => {
      const url = new URL(request.url);
      const cursor = url.searchParams.get("cursor");
      log.push(Object.fromEntries(url.searchParams));
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      if (failOn.includes(log.length)) return HttpResponse.json({ error: `Page ${log.length} failed` }, { status: 500 });
      const start = cursor ? Number(atob(cursor)) : 0;
      const end = Math.min(start + size, items.length);
      return HttpResponse.json({ results: items.slice(start, end), nextCursor: end < items.length ? btoa(String(end)) : null });
    })
  );
  return log;
}

let list;
function Probe({ path = "/api/things", params }) {
  list = usePagedList(path, params);
  return (
    <div>
      <p>{list.loading ? "loading" : "ready"}</p>
      <p data-testid="more">{String(list.hasMore)}</p>
      <p data-testid="loading-more">{String(list.loadingMore)}</p>
      <p data-testid="error">{list.error?.message || ""}</p>
      <ul>
        {list.items.map((i) => (
          <li key={i.id}>{`item ${i.id}`}</li>
        ))}
      </ul>
    </div>
  );
}
const items = () => screen.queryAllByRole("listitem").map((li) => li.textContent);

describe("usePagedList", () => {
  it("shows the first page and says there is more", async () => {
    serve("/api/things", numbered(5));
    render(<Probe />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    await screen.findByText("ready");
    expect(items()).toEqual(["item 1", "item 2"]);
    expect(screen.getByTestId("more")).toHaveTextContent("true");
  });

  it("loadMore adds the next page after the ones shown, and the last page ends it", async () => {
    serve("/api/things", numbered(5));
    render(<Probe />);
    await screen.findByText("ready");
    await act(() => list.loadMore());
    expect(items()).toEqual(["item 1", "item 2", "item 3", "item 4"]);
    await act(() => list.loadMore());
    expect(items()).toEqual(["item 1", "item 2", "item 3", "item 4", "item 5"]);
    expect(screen.getByTestId("more")).toHaveTextContent("false");
  });

  it("loadMore with nothing more does nothing", async () => {
    const log = serve("/api/things", numbered(2));
    render(<Probe />);
    await screen.findByText("ready");
    await act(() => list.loadMore());
    expect(log).toHaveLength(1);
  });

  it("two loadMore calls at once fetch the page once", async () => {
    const log = serve("/api/things", numbered(6), { delayMs: 40 });
    render(<Probe />);
    await screen.findByText("ready");
    await act(async () => {
      await Promise.all([list.loadMore(), list.loadMore()]);
    });
    expect(log).toHaveLength(2);
    expect(items()).toEqual(["item 1", "item 2", "item 3", "item 4"]);
  });

  it("says it is loading more while the next page is on its way", async () => {
    serve("/api/things", numbered(4), { delayMs: 60 });
    render(<Probe />);
    await screen.findByText("ready");
    let pending;
    act(() => {
      pending = list.loadMore();
    });
    await waitFor(() => expect(screen.getByTestId("loading-more")).toHaveTextContent("true"));
    await act(() => pending);
    expect(screen.getByTestId("loading-more")).toHaveTextContent("false");
  });

  it("asks for the filters and sort it was given, on every page", async () => {
    const log = serve("/api/things", numbered(4));
    render(<Probe params={{ q: "ada", sort: "-last" }} />);
    await screen.findByText("ready");
    await act(() => list.loadMore());
    expect(log.map((r) => [r.q, r.sort])).toEqual([
      ["ada", "-last"],
      ["ada", "-last"],
    ]);
    expect(log[1].cursor).toBeTruthy();
  });

  it("starts again from the first page when the filters change", async () => {
    serve("/api/things", numbered(6));
    function Switch() {
      const [q, setQ] = useState("a");
      return (
        <>
          <button onClick={() => setQ("b")}>change</button>
          <Probe params={{ q }} />
        </>
      );
    }
    render(<Switch />);
    await screen.findByText("ready");
    await act(() => list.loadMore());
    expect(items()).toHaveLength(4);
    await userEvent.click(screen.getByText("change"));
    await waitFor(() => expect(items()).toEqual(["item 1", "item 2"]));
  });

  it("an answer that arrives after the filters changed is ignored", async () => {
    const answers = { a: [{ id: 100 }], b: [{ id: 200 }] };
    server.use(
      http.get(`${API}/api/things`, async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q");
        if (q === "a") await new Promise((r) => setTimeout(r, 120));
        return HttpResponse.json({ results: answers[q], nextCursor: null });
      })
    );
    function Switch() {
      const [q, setQ] = useState("a");
      return (
        <>
          <button onClick={() => setQ("b")}>change</button>
          <Probe params={{ q }} />
        </>
      );
    }
    render(<Switch />);
    await userEvent.click(screen.getByText("change"));
    await waitFor(() => expect(items()).toEqual(["item 200"]));
    await new Promise((r) => setTimeout(r, 200));
    expect(items()).toEqual(["item 200"]); // the slow answer for "a" did not overwrite it
  });

  it("a page still on its way when the filters change is not added to the new list", async () => {
    server.use(
      http.get(`${API}/api/things`, async ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get("q");
        if (url.searchParams.get("cursor")) {
          await new Promise((r) => setTimeout(r, 150));
          return HttpResponse.json({ results: [{ id: 99 }], nextCursor: null });
        }
        return HttpResponse.json({ results: [{ id: q === "a" ? 1 : 2 }], nextCursor: "more" });
      })
    );
    function Switch() {
      const [q, setQ] = useState("a");
      return (
        <>
          <button onClick={() => setQ("b")}>change</button>
          <Probe params={{ q }} />
        </>
      );
    }
    render(<Switch />);
    await waitFor(() => expect(items()).toEqual(["item 1"]));
    let late;
    act(() => {
      late = list.loadMore(); // the second page of "a", slow
    });
    await userEvent.click(screen.getByText("change"));
    await waitFor(() => expect(items()).toEqual(["item 2"]));
    await act(() => late);
    expect(items()).toEqual(["item 2"]); // page 2 of the old list did not land in the new one
  });

  it("a failure on the first page is an error with nothing shown", async () => {
    serve("/api/things", numbered(4), { failOn: [1] });
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("Page 1 failed"));
    expect(items()).toEqual([]);
    expect(screen.getByText("ready")).toBeInTheDocument();
  });

  it("a failure loading more keeps what is shown, reports it, and trying again fetches that page", async () => {
    const log = serve("/api/things", numbered(6), { failOn: [2] });
    render(<Probe />);
    await screen.findByText("ready");
    await act(() => list.loadMore());
    expect(items()).toEqual(["item 1", "item 2"]);
    expect(screen.getByTestId("error")).toHaveTextContent("Page 2 failed");
    expect(screen.getByTestId("more")).toHaveTextContent("true");
    await act(() => list.loadMore());
    expect(items()).toEqual(["item 1", "item 2", "item 3", "item 4"]);
    expect(screen.getByTestId("error")).toHaveTextContent("");
    expect(log.map((r) => r.cursor ?? null)).toEqual([null, btoa("2"), btoa("2")]); // the same page, asked for again
  });

  it("a reload whose first page fails keeps what was shown, reports it, and trying again recovers", async () => {
    const log = serve("/api/things", numbered(4), { failOn: [2] });
    render(<Probe />);
    await screen.findByText("ready");
    await act(() => list.reload());
    expect(items()).toEqual(["item 1", "item 2"]); // the old list is not blanked by the failed refresh
    expect(screen.getByTestId("error")).toHaveTextContent("Page 2 failed");
    await act(() => list.reload());
    expect(screen.getByTestId("error")).toHaveTextContent("");
    expect(items()).toEqual(["item 1", "item 2"]);
    expect(log).toHaveLength(3);
  });

  it("reload starts from the first page", async () => {
    serve("/api/things", numbered(6));
    render(<Probe />);
    await screen.findByText("ready");
    await act(() => list.loadMore());
    await act(() => list.reload());
    expect(items()).toEqual(["item 1", "item 2"]);
  });

  it("setItems changes what is shown without asking the server", async () => {
    const log = serve("/api/things", numbered(3));
    render(<Probe />);
    await screen.findByText("ready");
    act(() => list.setItems((current) => current.filter((i) => i.id !== 1)));
    expect(items()).toEqual(["item 2"]);
    expect(log).toHaveLength(1);
  });

  it("an empty list is ready, with nothing and no more", async () => {
    serve("/api/things", []);
    render(<Probe />);
    await screen.findByText("ready");
    expect(items()).toEqual([]);
    expect(screen.getByTestId("more")).toHaveTextContent("false");
  });

  it("a server that does not paginate gives the whole list as the one page", async () => {
    server.use(http.get(`${API}/api/things`, () => HttpResponse.json(numbered(3))));
    render(<Probe />);
    await screen.findByText("ready");
    expect(items()).toEqual(["item 1", "item 2", "item 3"]);
    expect(screen.getByTestId("more")).toHaveTextContent("false");
  });
});
