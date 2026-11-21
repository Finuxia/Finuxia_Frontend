import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor, within } from "../test/utils";
import Testimonials from "./Testimonials";

const link = (over = {}) => ({
  id: 1,
  slug: "abcdefghijklmnopqrstuvwx",
  title: "Share your experience",
  message: "",
  isActive: true,
  clientRef: null,
  clientName: null,
  createdAt: "2026-11-01T10:00:00Z",
  submissions: 0,
  ...over,
});
const testimonial = (over = {}) => ({
  id: 10,
  name: "Dana Client",
  email: "",
  phone: "",
  roleCompany: "",
  text: "She was wonderful.",
  rating: 5,
  hasPhoto: false,
  isFeatured: false,
  isRead: false,
  linkId: 1,
  clientRef: null,
  clientName: null,
  createdAt: "2026-11-02T10:00:00Z",
  ...over,
});

function serve({ links = [], items = [], clients = [] } = {}) {
  server.use(
    http.get(`${API}/api/testimonials/links`, () => HttpResponse.json(links)),
    http.get(`${API}/api/testimonials`, () => HttpResponse.json({ results: items, nextCursor: null })),
    http.get(`${API}/api/clients`, () => HttpResponse.json(clients))
  );
}

let confirm;
beforeEach(() => {
  confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => confirm.mockRestore());

describe("the testimonials page", () => {
  it("explains itself when there is nothing yet", async () => {
    serve();
    renderWithProviders(<Testimonials />);
    expect(await screen.findByText(/No links yet/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
  });

  it("lists my links with their address and how many came in, and what people wrote", async () => {
    serve({
      links: [
        link({ id: 1, submissions: 2 }),
        link({ id: 2, slug: "zzzzzzzzzzzzzzzzzzzzzzzz", clientRef: "c1", clientName: "Dana Client", submissions: 0 }),
      ],
      items: [testimonial({ clientName: "Dana Client", roleCompany: "Dentist" })],
    });
    renderWithProviders(<Testimonials />);
    expect(await screen.findByText("General link", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("For Dana Client")).toBeInTheDocument();
    expect(screen.getByText("2 testimonials received")).toBeInTheDocument();
    expect(screen.getByText(/\/testimonial\/abcdefghijklmnopqrstuvwx$/)).toBeInTheDocument();
    expect(screen.getByText("She was wonderful.")).toBeInTheDocument();
    expect(screen.getByText("Dentist")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "5 out of 5" })).toBeInTheDocument();
  });

  it("makes a general link", async () => {
    serve();
    let body;
    server.use(
      http.post(
        `${API}/api/testimonials/links`,
        async ({ request }) => ((body = await request.json()), HttpResponse.json(link({ id: 7 }), { status: 201 }))
      )
    );
    renderWithProviders(<Testimonials />);
    await userEvent.click(await screen.findByRole("button", { name: /general link/i }));
    expect(await screen.findByText("General link", { selector: "p" })).toBeInTheDocument();
    expect(body).toEqual({});
  });

  it("makes a link for the chosen client, and the button waits for a choice", async () => {
    serve({ clients: [{ id: "c1", first: "Dana", last: "Client", email: "", phone: "" }] });
    let body;
    server.use(
      http.post(
        `${API}/api/testimonials/links`,
        async ({ request }) => (
          (body = await request.json()),
          HttpResponse.json(link({ id: 8, clientRef: "c1", clientName: "Dana Client" }), { status: 201 })
        )
      )
    );
    renderWithProviders(<Testimonials />);
    const make = await screen.findByRole("button", { name: /link for this client/i });
    expect(make).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Client"), "c1");
    await userEvent.click(make);
    expect(await screen.findByText("For Dana Client")).toBeInTheDocument();
    expect(body).toEqual({ clientRef: "c1" });
  });

  it("switches a link off and on", async () => {
    serve({ links: [link()] });
    const sent = [];
    server.use(
      http.patch(
        `${API}/api/testimonials/links/1`,
        async ({ request }) => (sent.push(await request.json()), HttpResponse.json(link({ isActive: sent.at(-1).isActive })))
      )
    );
    renderWithProviders(<Testimonials />);
    const toggle = await screen.findByRole("switch");
    await userEvent.click(toggle);
    await waitFor(() => expect(screen.getByText(/switched off/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(screen.queryByText(/switched off/)).not.toBeInTheDocument());
    expect(sent).toEqual([{ isActive: false }, { isActive: true }]);
  });

  it("deletes a link only after asking", async () => {
    serve({ links: [link()] });
    server.use(http.delete(`${API}/api/testimonials/links/1`, () => new HttpResponse(null, { status: 204 })));
    renderWithProviders(<Testimonials />);
    confirm.mockReturnValueOnce(false);
    await userEvent.click(await screen.findByRole("button", { name: "Delete link" }));
    expect(screen.getByText("General link", { selector: "p" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete link" }));
    await waitFor(() => expect(screen.queryByText("General link", { selector: "p" })).not.toBeInTheDocument());
  });

  it("features, reads, and deletes a testimonial", async () => {
    serve({ items: [testimonial()] });
    const sent = [];
    server.use(
      http.patch(`${API}/api/testimonials/10`, async ({ request }) => {
        const change = await request.json();
        sent.push(change);
        return HttpResponse.json({ ...testimonial(), ...change });
      }),
      http.delete(`${API}/api/testimonials/10`, () => new HttpResponse(null, { status: 204 }))
    );
    renderWithProviders(<Testimonials />);
    const card = (await screen.findByText("She was wonderful.")).closest("article");
    await userEvent.click(within(card).getByRole("button", { name: "Feature" }));
    await waitFor(() => expect(within(card).getByRole("button", { name: "Unfeature" })).toBeInTheDocument());
    await userEvent.click(within(card).getByRole("button", { name: "Mark as read" }));
    await waitFor(() => expect(screen.queryByText("New")).not.toBeInTheDocument());
    expect(sent).toEqual([{ isFeatured: true }, { isRead: true }]);
    await userEvent.click(within(card).getByRole("button", { name: "Delete testimonial" }));
    await waitFor(() => expect(screen.queryByText("She was wonderful.")).not.toBeInTheDocument());
  });

  it("marks everything read in one go, and the button is off when nothing is unread", async () => {
    serve({ items: [testimonial({ id: 10 }), testimonial({ id: 11, name: "Lee" })] });
    let called = 0;
    server.use(http.post(`${API}/api/testimonials/mark-all-read`, () => (called++, HttpResponse.json({ updated: 2 }))));
    renderWithProviders(<Testimonials />);
    const button = await screen.findByRole("button", { name: "Mark all as read" });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    expect(called).toBe(1);
    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });

  it("shows a photo only for someone who sent one, fetched with the session", async () => {
    serve({ items: [testimonial({ hasPhoto: true })] });
    let asked = 0;
    server.use(
      http.get(
        `${API}/api/testimonials/10/photo`,
        () => (asked++, new HttpResponse(new Uint8Array([137, 80, 78, 71]), { headers: { "Content-Type": "image/png" } }))
      )
    );
    renderWithProviders(<Testimonials />);
    expect(await screen.findByAltText("Dana Client")).toBeInTheDocument();
    expect(asked).toBe(1);
  });
});
