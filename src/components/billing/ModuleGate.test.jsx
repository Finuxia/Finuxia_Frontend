import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { API, testBilling } from "../../test/handlers";
import { server } from "../../test/server";
import { renderWithProviders, screen, userEvent } from "../../test/utils";
import ModuleGate from "./ModuleGate";

function Gated({ moduleKey = "documents" }) {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ModuleGate moduleKey={moduleKey} moduleName="Documents">
            <p>the documents page</p>
          </ModuleGate>
        }
      />
      <Route path="/billing" element={<p>billing page</p>} />
    </Routes>
  );
}

const render = (ui) => renderWithProviders(ui, { providers: ["router", "toast", "auth"] });

describe("ModuleGate", () => {
  it("shows a loading state while the plan is being fetched, never a locked page", async () => {
    server.use(
      http.get(`${API}/api/billing/me`, async () => {
        await new Promise((r) => setTimeout(r, 80));
        return HttpResponse.json(testBilling);
      })
    );
    render(<Gated />);
    expect(await screen.findByText("Checking your plan…")).toBeInTheDocument();
    expect(screen.queryByText(/isn't included/)).not.toBeInTheDocument();
    expect(await screen.findByText("the documents page")).toBeInTheDocument();
  });

  it("renders the children when the plan includes the module", async () => {
    render(<Gated moduleKey="documents" />);
    expect(await screen.findByText("the documents page")).toBeInTheDocument();
    expect(screen.queryByText("Checking your plan…")).not.toBeInTheDocument();
  });

  it("shows the upgrade prompt, with a way to the plans, when it does not", async () => {
    render(<Gated moduleKey="followups" />);
    expect(await screen.findByText(/isn't included in your current plan/)).toBeInTheDocument();
    expect(screen.queryByText("the documents page")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "View Plans" }));
    expect(await screen.findByText("billing page")).toBeInTheDocument();
  });

  it("shows an error with a retry when the plan cannot be fetched, and recovers on retry", async () => {
    let attempts = 0;
    server.use(http.get(`${API}/api/billing/me`, () => (++attempts === 1 ? HttpResponse.error() : HttpResponse.json(testBilling))));
    render(<Gated />);
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't check your plan");
    expect(screen.queryByText(/isn't included/)).not.toBeInTheDocument(); // a failed fetch is not "not entitled"
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("the documents page")).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it("a retry that fails again keeps showing the error", async () => {
    server.use(http.get(`${API}/api/billing/me`, () => HttpResponse.error()));
    render(<Gated />);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
