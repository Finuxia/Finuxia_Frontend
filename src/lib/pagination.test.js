import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { api, isIncompleteList, PAGE_SIZE, toPage, withQuery } from "./api";
import * as errorReporting from "./errorReporting";
import { API } from "../test/handlers";
import { server } from "../test/server";

/** A server that pages `items` by `size`, with the cursor an opaque string; records every request's query string. */
function pagedServer(path, items, { size = 50, log = [] } = {}) {
  server.use(
    http.get(`${API}${path}`, ({ request }) => {
      const url = new URL(request.url);
      log.push(Object.fromEntries(url.searchParams));
      const limit = Number(url.searchParams.get("limit")) || size;
      const start = url.searchParams.get("cursor") ? Number(atob(url.searchParams.get("cursor"))) : 0;
      const end = Math.min(start + limit, items.length);
      return HttpResponse.json({ results: items.slice(start, end), nextCursor: end < items.length ? btoa(String(end)) : null });
    })
  );
  return log;
}
const numbered = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

describe("withQuery", () => {
  it("adds the parameters that have a value and leaves the others out", () => {
    expect(withQuery("/api/x", { limit: 50, cursor: "abc", q: "", sort: undefined, nothing: null })).toBe("/api/x?limit=50&cursor=abc");
    expect(withQuery("/api/x")).toBe("/api/x");
    expect(withQuery("/api/x", { a: undefined })).toBe("/api/x");
  });

  it("encodes what needs encoding, and keeps a zero", () => {
    expect(withQuery("/api/x", { q: "a b&c", n: 0 })).toBe("/api/x?q=a+b%26c&n=0");
  });
});

describe("toPage", () => {
  it("passes the paginated shape through", () => {
    expect(toPage({ results: [1, 2], nextCursor: "next" })).toEqual({ results: [1, 2], nextCursor: "next" });
    expect(toPage({ results: [], nextCursor: null })).toEqual({ results: [], nextCursor: null });
  });

  it("takes a plain list, from a server that does not paginate yet, as the only page", () => {
    expect(toPage([{ id: 1 }])).toEqual({ results: [{ id: 1 }], nextCursor: null });
    expect(toPage([])).toEqual({ results: [], nextCursor: null });
  });

  it("is an empty last page for anything else", () => {
    for (const junk of [null, undefined, {}, "x", 5, { results: "no" }])
      expect(toPage(junk), String(junk)).toEqual({ results: [], nextCursor: null });
  });
});

describe("getPage", () => {
  it("asks for a page of the server's own size, and carries the cursor and the filters", async () => {
    const log = pagedServer("/api/things", numbered(120));
    const first = await api.getPage("/api/things");
    expect([first.results.length, first.nextCursor !== null]).toEqual([50, true]);
    expect(log[0]).toEqual({ limit: String(PAGE_SIZE) });
    await api.getPage("/api/things", { cursor: first.nextCursor, q: "ada", sort: "-last" });
    expect(log[1]).toEqual({ limit: "50", cursor: first.nextCursor, q: "ada", sort: "-last" });
  });

  it("a limit can be asked for, and the page size is fifty", async () => {
    expect(PAGE_SIZE).toBe(50);
    const log = pagedServer("/api/things", numbered(20));
    await api.getPage("/api/things", { limit: 5 });
    expect(log[0].limit).toBe("5");
  });

  it("works against a server that still answers with the whole list", async () => {
    server.use(http.get(`${API}/api/things`, () => HttpResponse.json([{ id: 1 }, { id: 2 }])));
    expect(await api.getPage("/api/things")).toEqual({ results: [{ id: 1 }, { id: 2 }], nextCursor: null });
  });

  it("a refusal is an error, as for any request", async () => {
    server.use(http.get(`${API}/api/things`, () => HttpResponse.json({ error: "No." }, { status: 403 })));
    await expect(api.getPage("/api/things")).rejects.toThrow("No.");
  });
});

describe("getAllPages", () => {
  it("follows the cursor to the end, one request at a time, and returns everything in order", async () => {
    const log = pagedServer("/api/things", numbered(120));
    const all = await api.getAllPages("/api/things");
    expect(all.map((t) => t.id)).toEqual(numbered(120).map((t) => t.id));
    expect(log).toHaveLength(3);
    expect(log[0].cursor).toBeUndefined();
    expect(log[1].cursor).toBeTruthy();
  });

  it("is a single request when everything fits on one page", async () => {
    const log = pagedServer("/api/things", numbered(10));
    expect(await api.getAllPages("/api/things")).toHaveLength(10);
    expect(log).toHaveLength(1);
  });

  it("is an empty list for nothing", async () => {
    pagedServer("/api/things", []);
    expect(await api.getAllPages("/api/things")).toEqual([]);
  });

  it("tells the caller about each page as it arrives, so the first can be shown while the rest are fetched", async () => {
    pagedServer("/api/things", numbered(120));
    const seen = [];
    await api.getAllPages("/api/things", {}, { onPage: (items, all) => seen.push([items.length, all.length]) });
    expect(seen).toEqual([
      [50, 50],
      [50, 100],
      [20, 120],
    ]);
  });

  it("carries the filters on every page", async () => {
    const log = pagedServer("/api/things", numbered(120));
    await api.getAllPages("/api/things", { q: "ada" });
    expect(log.map((r) => r.q)).toEqual(["ada", "ada", "ada"]);
  });

  it("stops, with what it has, when told the caller has gone away", async () => {
    const log = pagedServer("/api/things", numbered(150));
    let calls = 0;
    const all = await api.getAllPages("/api/things", {}, { isCancelled: () => ++calls > 1 });
    expect(all.length).toBeLessThan(150);
    expect(log.length).toBeLessThan(3);
  });

  it("does not loop for ever on a cursor that never ends", async () => {
    server.use(http.get(`${API}/api/things`, () => HttpResponse.json({ results: [{ id: 1 }], nextCursor: "again" })));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const all = await api.getAllPages("/api/things", {}, { maxPages: 4 });
    spy.mockRestore();
    expect(all).toHaveLength(4);
  });

  it("by default it gives up after two hundred pages rather than loop for ever", async () => {
    server.use(http.get(`${API}/api/things`, () => HttpResponse.json({ results: [{ id: 1 }], nextCursor: "again" })));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await api.getAllPages("/api/things")).toHaveLength(200);
    spy.mockRestore();
  });

  describe("reaching the cap is not the same as reaching the end (DATA-11)", () => {
    const endless = () => server.use(http.get(`${API}/api/things`, () => HttpResponse.json({ results: [{ id: 1 }], nextCursor: "again" })));

    it("a list cut off by the cap is marked incomplete, so the caller can tell", async () => {
      endless();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const all = await api.getAllPages("/api/things", {}, { maxPages: 4 });
      expect(all).toHaveLength(4);
      expect(isIncompleteList(all)).toBe(true);
      spy.mockRestore();
    });

    it("it is reported: an error in the console and an event to the error tracker, naming the path and the count", async () => {
      endless();
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const report = vi.spyOn(errorReporting, "reportError").mockImplementation(() => {});
      await api.getAllPages("/api/things", {}, { maxPages: 3 });
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("/api/things: stopped after 3 pages (3 items)"));
      expect(report).toHaveBeenCalledTimes(1);
      expect(report.mock.calls[0][0].message).toContain("incomplete");
      expect(report.mock.calls[0][1]).toEqual({ errorId: "list-incomplete" });
      consoleError.mockRestore();
      report.mockRestore();
    });

    it("more pages than the default cap still returns, and says so", async () => {
      endless();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const all = await api.getAllPages("/api/things");
      expect(all).toHaveLength(200);
      expect(isIncompleteList(all)).toBe(true);
      spy.mockRestore();
    });

    it("a list that ends exactly at the cap is complete, not flagged", async () => {
      pagedServer("/api/things", numbered(4), { size: 1 });
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const all = await api.getAllPages("/api/things", {}, { maxPages: 4 });
      expect(all).toHaveLength(4);
      expect(isIncompleteList(all)).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("an ordinary list, an empty list and a copy of an incomplete list are not marked", async () => {
      pagedServer("/api/things", numbered(120));
      expect(isIncompleteList(await api.getAllPages("/api/things"))).toBe(false);
      pagedServer("/api/things", []);
      expect(isIncompleteList(await api.getAllPages("/api/things"))).toBe(false);
      endless();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const all = await api.getAllPages("/api/things", {}, { maxPages: 2 });
      expect(isIncompleteList([...all])).toBe(false); // the mark belongs to the list it was put on
      spy.mockRestore();
    });

    it("things that are not lists are never incomplete", () => {
      for (const v of [null, undefined, {}, "x", 3]) expect(isIncompleteList(v)).toBe(false);
    });

    it("a cancelled load is not reported as incomplete", async () => {
      endless();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const all = await api.getAllPages("/api/things", {}, { maxPages: 4, isCancelled: () => true });
      expect(isIncompleteList(all)).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  it("a failure partway is an error, not a silently short list", async () => {
    let n = 0;
    server.use(
      http.get(`${API}/api/things`, () =>
        ++n === 2 ? HttpResponse.json({ error: "Down." }, { status: 500 }) : HttpResponse.json({ results: [{ id: n }], nextCursor: "more" })
      )
    );
    await expect(api.getAllPages("/api/things")).rejects.toThrow("Down.");
  });

  it("works against a server that still answers with the whole list", async () => {
    server.use(http.get(`${API}/api/things`, () => HttpResponse.json(numbered(7))));
    expect(await api.getAllPages("/api/things")).toHaveLength(7);
  });
});

describe("the helpers that return a whole collection", () => {
  it.each([
    ["getReminders", "/api/reminders"],
    ["getBookingRequests", "/api/booking/requests"],
    ["getSalesPackages", "/api/sales-packages/packages"],
    ["getMyDocuments", "/api/documents/mine"],
  ])("%s reads every page and still returns one array", async (method, path) => {
    pagedServer(path, numbered(120));
    const all = await api[method]();
    expect(all).toHaveLength(120);
  });

  it("the clients page helper passes the server's filters and sort", async () => {
    const log = pagedServer("/api/clients", numbered(3));
    await api.getClientsPage({ q: "ada", priority: "high", sort: "-last", limit: 10 });
    expect(log[0]).toEqual({ q: "ada", priority: "high", sort: "-last", limit: "10" });
  });

  it("they still work against a server that does not paginate yet", async () => {
    vi.useRealTimers();
    server.use(http.get(`${API}/api/reminders`, () => HttpResponse.json(numbered(3))));
    expect(await api.getReminders()).toHaveLength(3);
  });
});
