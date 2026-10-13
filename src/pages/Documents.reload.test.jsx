import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import Documents from "./Documents";

// The submit form itself is not what is under test: a stand-in that reports "submitted" lets the page's reaction be seen.
vi.mock("../components/documents/SubmitDocumentModal", () => ({
  default: ({ onSubmitted }) => (
    <button type="button" onClick={onSubmitted}>
      pretend submitted
    </button>
  ),
}));

describe("Documents after a submission", () => {
  it("asks for the library and for my own submissions again, so the new one shows up", async () => {
    const asked = { library: 0, mine: 0 };
    server.use(
      http.get(`${API}/api/documents`, () => {
        asked.library += 1;
        return HttpResponse.json({ results: [], nextCursor: null });
      }),
      http.get(`${API}/api/documents/mine`, () => {
        asked.mine += 1;
        return HttpResponse.json([]);
      })
    );
    renderWithProviders(<Documents />, { providers: ["router", "toast", "auth"] });
    await waitFor(() => expect(asked).toEqual({ library: 1, mine: 1 }));
    await userEvent.click(await screen.findByRole("button", { name: /Submit Document/ }));
    await userEvent.click(screen.getByRole("button", { name: "pretend submitted" }));
    await waitFor(() => expect(asked).toEqual({ library: 2, mine: 2 }));
  });
});
