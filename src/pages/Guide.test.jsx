import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent } from "../test/utils";
import Guide from "./Guide";

const groups = [
  {
    category: "Getting started",
    items: [
      { id: 1, question: "How do I add a client?", answer: "Use Add client." },
      { id: 2, question: "How do I import clients?", answer: "Use Import." },
    ],
  },
];
const serve = (reply) => server.use(http.get(`${API}/api/guides`, reply));

describe("the guide", () => {
  it("opens the very first question by default, and the reader can open another", async () => {
    serve(() => HttpResponse.json(groups));
    renderWithProviders(<Guide />);
    const first = await screen.findByRole("button", { name: /How do I add a client/ });
    expect(first).toHaveAttribute("aria-expanded", "true");
    const second = screen.getByRole("button", { name: /How do I import clients/ });
    expect(second).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(second);
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(first).toHaveAttribute("aria-expanded", "false");
  });

  it("the reader closing the open question keeps it closed (the default does not come back)", async () => {
    serve(() => HttpResponse.json(groups));
    renderWithProviders(<Guide />);
    const first = await screen.findByRole("button", { name: /How do I add a client/ });
    await userEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");
  });

  it("says when there is nothing yet, and shows a failure instead of an empty page", async () => {
    serve(() => HttpResponse.json([]));
    const { unmount } = renderWithProviders(<Guide />);
    expect(await screen.findByText(/No guide entries yet/)).toBeInTheDocument();
    unmount();
    serve(() => HttpResponse.json({ error: "Guide unavailable" }, { status: 503 }));
    renderWithProviders(<Guide />);
    expect(await screen.findByText("Guide unavailable")).toBeInTheDocument();
  });
});
