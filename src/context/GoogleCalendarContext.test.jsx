import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { useAuth } from "./AuthContext";
import { useGoogleCalendar } from "./GoogleCalendarContext";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, waitFor } from "../test/utils";

// FE-16: the calendar connection is asked about only once someone is signed in. It used to be asked on every page load, the login page included.
function Probe() {
  const { initializing, user } = useAuth();
  const { status } = useGoogleCalendar();
  return <p>{initializing ? "booting" : user ? `in:${status}` : `out:${status}`}</p>;
}

function countStatusRequests() {
  const seen = { count: 0 };
  server.events.on("request:start", ({ request }) => {
    if (new URL(request.url).pathname === "/api/calendar-connect/status") seen.count += 1;
  });
  return seen;
}

describe("the calendar connection check", () => {
  afterEach(() => server.events.removeAllListeners());

  it("is not made while nobody is signed in", async () => {
    server.use(
      http.get(`${API}/api/auth/me`, () => HttpResponse.json({ detail: "Not signed in" }, { status: 401 })),
      http.post(`${API}/api/auth/refresh`, () => HttpResponse.json({ detail: "No session" }, { status: 401 }))
    );
    const seen = countStatusRequests();
    renderWithProviders(<Probe />);
    expect(await screen.findByText("out:disconnected")).toBeInTheDocument();
    expect(seen.count).toBe(0);
  });

  it("is made once when someone is signed in", async () => {
    server.use(
      http.get(`${API}/api/calendar-connect/status`, () =>
        HttpResponse.json({ configured: true, connected: true, status: "connected", googleEmail: "advisor@gmail.com" })
      )
    );
    const seen = countStatusRequests();
    renderWithProviders(<Probe />);
    expect(await screen.findByText("in:connected")).toBeInTheDocument();
    await waitFor(() => expect(seen.count).toBe(1));
  });
});
