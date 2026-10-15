import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuthenticatedApp from "../AuthenticatedApp";
import { API, testBilling } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent } from "../test/utils";
const show = () => renderWithProviders(<AuthenticatedApp />, { route: "/advisor-assistant/presentations" });

const item = { slug: "retirement", title: "Retirement Planning", info: "", hasPdf: true, variants: [] };

describe("presentations access", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the upgrade prompt and never loads the page without the module", async () => {
    let presentationRequests = 0;
    server.use(
      http.get(`${API}/api/billing/me`, () => HttpResponse.json({ ...testBilling, moduleKeys: [] })),
      http.get(`${API}/api/presentations`, () => {
        presentationRequests += 1;
        return HttpResponse.json([item]);
      })
    );

    show();

    expect(await screen.findByText(/isn't included in your current plan/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Presentations" })).not.toBeInTheDocument();
    expect(presentationRequests).toBe(0);
  });

  it("loads and lists the API response when the module is included", async () => {
    server.use(
      http.get(`${API}/api/billing/me`, () =>
        HttpResponse.json({ ...testBilling, moduleKeys: [...testBilling.moduleKeys, "presentations"] })
      ),
      http.get(`${API}/api/presentations`, () => HttpResponse.json([item]))
    );

    show();

    expect(await screen.findByRole("heading", { name: "Presentations" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Retirement Planning" })).toBeInTheDocument();
  });

  it("downloads through the authenticated API client", async () => {
    let credentials;
    server.use(
      http.get(`${API}/api/billing/me`, () =>
        HttpResponse.json({ ...testBilling, moduleKeys: [...testBilling.moduleKeys, "presentations"] })
      ),
      http.get(`${API}/api/presentations`, () => HttpResponse.json([item])),
      http.get(`${API}/api/presentations/retirement/pdf`, ({ request }) => {
        credentials = request.credentials;
        return new HttpResponse("pdf", {
          headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="retirement.pdf"' },
        });
      })
    );
    const createObjectURL = vi.fn(() => "blob:retirement");
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    show();
    await userEvent.click(await screen.findByRole("button", { name: "Download" }));

    expect(credentials).toBe("include");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed download instead of failing silently", async () => {
    server.use(
      http.get(`${API}/api/billing/me`, () =>
        HttpResponse.json({ ...testBilling, moduleKeys: [...testBilling.moduleKeys, "presentations"] })
      ),
      http.get(`${API}/api/presentations`, () => HttpResponse.json([item])),
      http.get(`${API}/api/presentations/retirement/pdf`, () =>
        HttpResponse.json({ error: "Your plan no longer includes presentations." }, { status: 403 })
      )
    );

    show();
    await userEvent.click(await screen.findByRole("button", { name: "Download" }));

    expect(await screen.findByText("Your plan no longer includes presentations.")).toBeInTheDocument();
  });
});
