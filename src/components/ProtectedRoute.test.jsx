import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen } from "../test/utils";
import ProtectedRoute from "./ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<p>login page</p>} />
      <Route
        path="/secret"
        element={
          <ProtectedRoute>
            <p>secret page</p>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

describe("ProtectedRoute", () => {
  it("shows the page to a signed-in user", async () => {
    renderWithProviders(<App />, { route: "/secret", providers: ["router", "toast", "auth"] });
    expect(await screen.findByText("secret page")).toBeInTheDocument();
  });

  it("sends a signed-out user to the login page without flashing the protected content", async () => {
    server.use(
      http.get(`${API}/api/auth/me`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 }))
    );
    renderWithProviders(<App />, { route: "/secret", providers: ["router", "toast", "auth"] });
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
  });
});
