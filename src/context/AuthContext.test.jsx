import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import { api } from "../lib/api";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import { useAuth } from "./AuthContext";

function Probe() {
  const { user, initializing, billing, hasModule, login, logout } = useAuth();
  if (initializing) return <p>loading</p>;
  return (
    <div>
      <p>{user ? `signed in as ${user.name}` : "signed out"}</p>
      <p>{hasModule("documents") ? "has documents" : "no documents"}</p>
      <p>{billing ? `plan ${billing.plan.name}` : "no plan"}</p>
      <button onClick={() => login("advisor", "pw").catch(() => {})}>log in</button>
      <button onClick={logout}>log out</button>
    </div>
  );
}

const noSession = () =>
  server.use(
    http.get(`${API}/api/auth/me`, () => new HttpResponse(null, { status: 401 })),
    http.post(`${API}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 }))
  );

describe("AuthProvider", () => {
  it("restores the session at boot, then loads the plan's modules", async () => {
    renderWithProviders(<Probe />, { providers: ["router", "toast", "auth"] });
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(await screen.findByText("signed in as Test Advisor")).toBeInTheDocument();
    expect(await screen.findByText("has documents")).toBeInTheDocument();
    expect(screen.getByText("plan Professional")).toBeInTheDocument();
  });

  it("stays signed out when there is no valid session", async () => {
    noSession();
    renderWithProviders(<Probe />, { providers: ["router", "toast", "auth"] });
    expect(await screen.findByText("signed out")).toBeInTheDocument();
    expect(screen.getByText("no documents")).toBeInTheDocument();
  });

  it("logs in", async () => {
    noSession();
    server.use(http.post(`${API}/api/auth/login`, () => HttpResponse.json({ user: { id: 2, name: "Pat", email: "p@example.com" } })));
    renderWithProviders(<Probe />, { providers: ["router", "toast", "auth"] });
    await screen.findByText("signed out");
    await userEvent.click(screen.getByText("log in"));
    expect(await screen.findByText("signed in as Pat")).toBeInTheDocument();
  });

  it("logging out clears the cached client data, so the next person at a shared computer cannot read it", async () => {
    localStorage.setItem("advisorpilot.clients.advisor@example.com", '[{"id":1}]');
    renderWithProviders(<Probe />, { providers: ["router", "toast", "auth"] });
    await screen.findByText("signed in as Test Advisor");
    await userEvent.click(screen.getByText("log out"));
    expect(await screen.findByText("signed out")).toBeInTheDocument();
    expect(localStorage.getItem("advisorpilot.clients.advisor@example.com")).toBeNull();
  });

  it("a session that can no longer be refreshed signs the user out and wipes the cache", async () => {
    server.use(
      http.get(`${API}/api/billing/me`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 }))
    );
    localStorage.setItem("advisorpilot.clients.advisor@example.com", "[]");
    renderWithProviders(<Probe />, { providers: ["router", "toast", "auth"] });
    expect(await screen.findByText("signed out")).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem("advisorpilot.clients.advisor@example.com")).toBeNull());
  });
});

describe("billing status", () => {
  function Status() {
    const { billingStatus, initializing } = useAuth();
    return <p>{initializing ? "booting" : `billing ${billingStatus}`}</p>;
  }
  const renderStatus = () => renderWithProviders(<Status />, { providers: ["router", "toast", "auth"] });

  it("is loading until the plan arrives, then ready", async () => {
    renderStatus();
    expect(await screen.findByText("billing loading")).toBeInTheDocument();
    expect(await screen.findByText("billing ready")).toBeInTheDocument();
  });

  it("is an error when the plan cannot be fetched", async () => {
    server.use(http.get(`${API}/api/billing/me`, () => HttpResponse.error()));
    renderStatus();
    expect(await screen.findByText("billing error")).toBeInTheDocument();
  });
});

describe("legacy token", () => {
  it("any JWT left in browser storage by an older version is removed on load", async () => {
    localStorage.setItem("advisorpilot.token", "eyJ.old.jwt");
    localStorage.setItem("advisorpilot.clients.someone", "keep for now"); // other cached data is not the token's business
    renderWithProviders(<Probe />, { providers: ["router", "toast", "auth"] });
    await screen.findByText("signed in as Test Advisor");
    expect(localStorage.getItem("advisorpilot.token")).toBeNull();
    expect(localStorage.getItem("advisorpilot.clients.someone")).toBe("keep for now");
  });

  it("is removed even when nobody is signed in", async () => {
    noSession();
    localStorage.setItem("advisorpilot.token", "eyJ.old.jwt");
    renderWithProviders(<Probe />, { providers: ["router", "toast", "auth"] });
    await screen.findByText("signed out");
    expect(localStorage.getItem("advisorpilot.token")).toBeNull();
  });
});

describe("a session that expires mid-use", () => {
  function Page() {
    const { user } = useAuth();
    return (
      <div>
        <p>page for {user.name}</p>
        <button onClick={() => api.getClients().catch(() => {})}>load clients</button>
      </div>
    );
  }
  const App = () => (
    <Routes>
      <Route path="/login" element={<p>login page</p>} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Page />
          </ProtectedRoute>
        }
      />
    </Routes>
  );

  it("one failed refresh signs out and lands on login once: no refresh loop, no repeated redirects", async () => {
    let refreshes = 0;
    renderWithProviders(<App />, { route: "/", providers: ["router", "toast", "auth"] });
    await screen.findByText("page for Test Advisor");
    server.use(
      http.get(`${API}/api/clients`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API}/api/auth/refresh`, () => {
        refreshes += 1;
        return new HttpResponse(null, { status: 401 });
      })
    );
    localStorage.setItem("advisorpilot.clients.advisor@example.com", "[]");
    await userEvent.click(screen.getByText("load clients"));
    expect(await screen.findByText("login page")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 400)); // long enough for any loop to show itself
    expect(refreshes).toBe(1);
    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(localStorage.getItem("advisorpilot.clients.advisor@example.com")).toBeNull();
  });
});
