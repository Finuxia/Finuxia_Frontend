import { http, HttpResponse } from "msw";
import { Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ProtectedRoute from "../components/ProtectedRoute";
import { destinationAfterLogin } from "../lib/redirects";
import { API, testUser } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import Login from "./Login";

function Where() {
  const { pathname, search, hash } = useLocation();
  return <p>at {pathname + search + hash}</p>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <Where />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function signedOutUntilLogin() {
  let signedIn = false;
  server.use(
    http.get(`${API}/api/auth/me`, () => (signedIn ? HttpResponse.json({ user: testUser }) : new HttpResponse(null, { status: 401 }))),
    http.post(`${API}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
    http.post(`${API}/api/auth/login`, () => {
      signedIn = true;
      return HttpResponse.json({ user: testUser });
    })
  );
}

async function logIn() {
  await userEvent.type(await screen.findByLabelText(/email or username/i), "advisor");
  await userEvent.type(screen.getByLabelText(/password/i), "pw");
  await userEvent.click(screen.getByRole("button", { name: "Log In" }));
}

const render = (route) => renderWithProviders(<App />, { route, providers: ["router", "toast", "auth"] });

describe("the protected-route wrapper and login", () => {
  it("sends a signed-out visitor to login, then back to the page they asked for", async () => {
    signedOutUntilLogin();
    render("/clients/42");
    await logIn();
    expect(await screen.findByText("at /clients/42")).toBeInTheDocument();
  });

  it("restores the query string and hash too, not just the path", async () => {
    signedOutUntilLogin();
    render("/reports?range=90&tab=aum#totals");
    await logIn();
    expect(await screen.findByText("at /reports?range=90&tab=aum#totals")).toBeInTheDocument();
  });

  it("goes to the dashboard when there was no intended page", async () => {
    signedOutUntilLogin();
    render("/login");
    await logIn();
    expect(await screen.findByText("at /dashboard")).toBeInTheDocument();
  });
});

describe("destinationAfterLogin", () => {
  const from = (pathname, extra = {}) => ({ state: { from: { pathname, ...extra } } });

  it.each([
    [from("/clients/1", { search: "?a=1", hash: "#x" }), "/clients/1?a=1#x"],
    [from("/clients/1"), "/clients/1"],
    [undefined, "/dashboard"],
    [{}, "/dashboard"],
    [from("/login"), "/dashboard"], // never back to the login page
    [from("//evil.example/x"), "/dashboard"], // only an in-app path is accepted
    [from("https://evil.example"), "/dashboard"],
    [from(42), "/dashboard"],
  ])("%j -> %s", (location, expected) => {
    expect(destinationAfterLogin(location)).toBe(expected);
  });
});

describe("login rate limiting", () => {
  const lockedOut = (retryAfter = 2) =>
    server.use(
      http.get(`${API}/api/auth/me`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API}/api/auth/login`, () =>
        HttpResponse.json({ detail: "Request was throttled. Expected available in 2 seconds." }, { status: 429, headers: { "Retry-After": String(retryAfter) } })
      )
    );

  it("shows a clear lockout message with the wait, not 'request failed'", async () => {
    lockedOut(600);
    renderWithProviders(<App />, { route: "/login", providers: ["router", "toast", "auth"] });
    await logIn();
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts. Try again in 10 minutes.");
    expect(screen.queryByText(/request failed/i)).not.toBeInTheDocument();
  });

  it("holds the Log In button until the wait is over, then lets the user try again", async () => {
    lockedOut(2);
    renderWithProviders(<App />, { route: "/login", providers: ["router", "toast", "auth"] });
    await logIn();
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Log In" })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Log In" })).toBeEnabled(), { timeout: 3500 });
  });

  it("a wrong password is still just the server's message, not a lockout", async () => {
    server.use(
      http.get(`${API}/api/auth/me`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API}/api/auth/login`, () => HttpResponse.json({ error: "Invalid email or password." }, { status: 401 }))
    );
    renderWithProviders(<App />, { route: "/login", providers: ["router", "toast", "auth"] });
    await logIn();
    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log In" })).toBeEnabled();
  });
});
