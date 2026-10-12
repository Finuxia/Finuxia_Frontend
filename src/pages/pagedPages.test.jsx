import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import Documents from "./Documents";
import Tickets from "./Tickets";

const render = (ui) => renderWithProviders(ui, { route: "/", providers: ["router", "toast", "auth"] });
const ticket = (id) => ({
  id,
  type: "bug",
  title: `Ticket ${id}`,
  description: "d",
  status: "open",
  reporterName: "A",
  createdAt: "2026-01-02T10:00:00Z",
  updatedAt: "2026-01-02T10:00:00Z",
  commentCount: 0,
});
const doc = (id, over = {}) => ({
  id,
  title: `Doc ${id}`,
  summary: "s",
  keywords: [],
  fileName: "g.pdf",
  uploadedByName: "Ann",
  status: "approved",
  rejectionNote: "",
  createdAt: null,
  reviewedAt: null,
  ...over,
});

/** Pages `all` by `size`; records the cursors asked for. Page `failing` (1-based) fails once. */
function paged(path, all, { size = 3, failing = 0 } = {}) {
  const asked = [];
  let failed = false;
  server.use(
    http.get(`${API}${path}`, ({ request }) => {
      const cursor = new URL(request.url).searchParams.get("cursor");
      asked.push(cursor);
      if (failing && asked.length === failing && !failed) {
        failed = true;
        return HttpResponse.json({ error: "Page unavailable" }, { status: 503 });
      }
      const start = cursor ? Number(atob(cursor)) : 0;
      const end = Math.min(start + size, all.length);
      return HttpResponse.json({ results: all.slice(start, end), nextCursor: end < all.length ? btoa(String(end)) : null });
    })
  );
  return asked;
}
const rows = (pattern) => screen.queryAllByText(pattern).length;

describe("Tickets, a page at a time", () => {
  it("shows the first page and a Load more, which adds the next page below it", async () => {
    const asked = paged("/api/tickets", [1, 2, 3, 4, 5, 6, 7].map(ticket));
    render(<Tickets />);
    expect(await screen.findByText("Ticket 1")).toBeInTheDocument();
    expect(rows(/^Ticket \d$/)).toBe(3);
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows(/^Ticket \d$/)).toBe(6));
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows(/^Ticket \d$/)).toBe(7));
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument(); // the last page: nothing more
    expect(asked).toEqual([null, btoa("3"), btoa("6")]);
  });

  it("with one page there is no Load more at all", async () => {
    paged("/api/tickets", [1, 2].map(ticket));
    render(<Tickets />);
    await screen.findByText("Ticket 1");
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("a page that fails to load keeps the tickets already shown and offers to try again", async () => {
    paged("/api/tickets", [1, 2, 3, 4, 5].map(ticket), { failing: 2 });
    render(<Tickets />);
    await screen.findByText("Ticket 1");
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Page unavailable");
    expect(rows(/^Ticket \d$/)).toBe(3);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(rows(/^Ticket \d$/)).toBe(5));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a failure of the first page is the page's error, with no list", async () => {
    paged("/api/tickets", [1, 2, 3, 4].map(ticket), { failing: 1 });
    render(<Tickets />);
    expect(await screen.findByText("Page unavailable")).toBeInTheDocument();
    expect(rows(/^Ticket \d$/)).toBe(0);
  });

  it("still works against a server that returns the whole list", async () => {
    server.use(http.get(`${API}/api/tickets`, () => HttpResponse.json([ticket(1), ticket(2)])));
    render(<Tickets />);
    expect(await screen.findByText("Ticket 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });
});

describe("Documents, a page at a time", () => {
  it("the library loads a page at a time and my submissions still load whole", async () => {
    const asked = paged(
      "/api/documents",
      [1, 2, 3, 4, 5].map((i) => doc(i))
    );
    server.use(http.get(`${API}/api/documents/mine`, () => HttpResponse.json([doc(50, { title: "My draft", status: "pending" })])));
    render(<Documents />);
    expect(await screen.findByText("Doc 1")).toBeInTheDocument();
    expect(screen.getByText("My draft")).toBeInTheDocument();
    expect(rows(/^Doc \d$/)).toBe(3);
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows(/^Doc \d$/)).toBe(5));
    expect(asked).toEqual([null, btoa("3")]);
  });

  it("my own submissions are read across all their pages, so none is missed", async () => {
    server.use(http.get(`${API}/api/documents`, () => HttpResponse.json({ results: [doc(1)], nextCursor: null })));
    paged(
      "/api/documents/mine",
      [10, 11, 12, 13].map((i) => doc(i, { title: `Mine ${i}`, status: "pending" })),
      { size: 2 }
    );
    render(<Documents />);
    expect(await screen.findByText("Mine 13")).toBeInTheDocument();
    expect(rows(/^Mine \d+$/)).toBe(4);
  });

  it("a failure loading more of the library keeps what is shown", async () => {
    paged(
      "/api/documents",
      [1, 2, 3, 4].map((i) => doc(i)),
      { failing: 2 }
    );
    server.use(http.get(`${API}/api/documents/mine`, () => HttpResponse.json([])));
    render(<Documents />);
    await screen.findByText("Doc 1");
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Page unavailable");
    expect(rows(/^Doc \d$/)).toBe(3);
  });
});
