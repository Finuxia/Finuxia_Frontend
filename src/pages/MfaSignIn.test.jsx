import { http, HttpResponse } from "msw";
import { Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import { API, testUser } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import Login from "./Login";
import Register from "./Register";

function Where() {
  const { pathname } = useLocation();
  return <p>at {pathname}</p>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
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

const render = (route = "/login") => renderWithProviders(<App />, { route, providers: ["router", "toast", "auth"] });

const CHALLENGE = "signed-challenge";
const RECOVERY = ["ABCDE-FGHJK", "LMNPQ-RSTUV", "WXYZ2-34567"];

// The server side of the story: signed out until the second step (or the set-up) creates the session.
function backend({ step = "verify", verify, confirm, loginStatus = 200 } = {}) {
  let signedIn = false;
  const calls = { verify: [], confirm: [], start: 0 };
  server.use(
    http.get(`${API}/api/auth/me`, () => (signedIn ? HttpResponse.json({ user: testUser }) : new HttpResponse(null, { status: 401 }))),
    http.post(`${API}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
    http.post(`${API}/api/auth/login`, () =>
      loginStatus === 200 ? HttpResponse.json({ mfa: step, challenge: CHALLENGE }) : new HttpResponse(null, { status: loginStatus })
    ),
    http.post(`${API}/api/auth/register`, () => HttpResponse.json({ mfa: "enrol", challenge: CHALLENGE }, { status: 201 })),
    http.post(`${API}/api/auth/mfa/verify`, async ({ request }) => {
      const body = await request.json();
      calls.verify.push(body);
      if (verify) return verify(body);
      signedIn = true;
      return HttpResponse.json({ user: testUser, usedRecoveryCode: Boolean(body.recoveryCode) });
    }),
    http.post(`${API}/api/auth/mfa/enrol/start`, () => {
      calls.start += 1;
      return HttpResponse.json({
        secret: "JBSWY3DPEHPK3PXP",
        otpauthUri: "otpauth://totp/Finuxia%3Aadvisor%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Finuxia",
        account: "advisor@example.com",
        issuer: "Finuxia",
      });
    }),
    http.post(`${API}/api/auth/mfa/enrol/confirm`, async ({ request }) => {
      const body = await request.json();
      calls.confirm.push(body);
      if (confirm) return confirm(body);
      signedIn = true;
      return HttpResponse.json({ user: testUser, recoveryCodes: RECOVERY });
    })
  );
  return calls;
}

async function password() {
  await userEvent.type(await screen.findByLabelText(/email or username/i), "advisor");
  await userEvent.type(screen.getByLabelText(/password/i), "pw");
  await userEvent.click(screen.getByRole("button", { name: "Log In" }));
}

describe("signing in with a code from the authenticator app", () => {
  it("asks for the code after a correct password, and signs in with it", async () => {
    const calls = backend();
    render("/clients/42");
    await password();
    expect(await screen.findByRole("heading", { name: "Enter your code" })).toBeInTheDocument();
    expect(screen.queryByText("at /clients/42")).not.toBeInTheDocument(); // no session yet
    await userEvent.type(screen.getByLabelText(/authenticator code/i), "123 456");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("at /clients/42")).toBeInTheDocument();
    expect(calls.verify).toEqual([{ challenge: CHALLENGE, code: "123456" }]);
  });

  it("will not send a code that is not six digits", async () => {
    const calls = backend();
    render();
    await password();
    await userEvent.type(await screen.findByLabelText(/authenticator code/i), "12345");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(calls.verify).toEqual([]);
  });

  it("shows the server's reason for a wrong code, clears the box, and lets the person try again", async () => {
    let attempts = 0;
    backend({
      verify: () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ error: "That code is not right, or it has already been used." }, { status: 400 })
          : HttpResponse.json({ user: testUser });
      },
    });
    render("/clients/7");
    await password();
    const box = await screen.findByLabelText(/authenticator code/i);
    await userEvent.type(box, "000000");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That code is not right, or it has already been used.");
    expect(box).toHaveValue("");
    await userEvent.type(box, "654321");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("at /clients/7")).toBeInTheDocument();
  });

  it("says when code entry is paused for the account", async () => {
    backend({
      verify: () =>
        HttpResponse.json(
          { error: "Too many wrong codes for this account. Code entry is paused; try again in 15 minutes." },
          { status: 429, headers: { "Retry-After": "900" } }
        ),
    });
    render();
    await password();
    await userEvent.type(await screen.findByLabelText(/authenticator code/i), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Code entry is paused; try again in 15 minutes.");
  });

  it("a recovery code can be used instead", async () => {
    const calls = backend();
    render("/clients/9");
    await password();
    await userEvent.click(await screen.findByRole("button", { name: /use a recovery code/i }));
    await userEvent.type(screen.getByLabelText(/recovery code/i), "abcde-fghjk");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("at /clients/9")).toBeInTheDocument();
    expect(calls.verify).toEqual([{ challenge: CHALLENGE, recoveryCode: "abcde-fghjk" }]);
  });

  it("an expired step is shown as an answer, not treated as a signed-out session to refresh", async () => {
    let refreshes = 0;
    backend({ verify: () => HttpResponse.json({ error: "This sign-in step has expired. Please sign in again." }, { status: 401 }) });
    server.use(
      http.post(`${API}/api/auth/refresh`, () => {
        refreshes += 1;
        return new HttpResponse(null, { status: 401 });
      })
    );
    render();
    await password();
    const box = await screen.findByLabelText(/authenticator code/i);
    const refreshesBefore = refreshes; // the app's own boot-time check of "am I signed in" has already tried once
    await userEvent.type(box, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This sign-in step has expired. Please sign in again.");
    expect(refreshes).toBe(refreshesBefore);
  });

  it("starting over goes back to the password and forgets it", async () => {
    backend();
    render();
    await password();
    await userEvent.click(await screen.findByRole("button", { name: /start over/i }));
    expect(await screen.findByLabelText(/email or username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toHaveValue("");
  });

  it("an account that needs no second factor is signed in at once, as before", async () => {
    server.use(
      http.get(`${API}/api/auth/me`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API}/api/auth/login`, () => HttpResponse.json({ user: testUser }))
    );
    render("/clients/3");
    await password();
    expect(await screen.findByText("at /clients/3")).toBeInTheDocument();
  });
});

describe("setting up the second factor", () => {
  const toEnrolment = async () => {
    await password();
    await screen.findByRole("heading", { name: "Set up two-factor sign-in" });
  };

  it("shows a QR code and the key, and switches on only when a code from it is entered", async () => {
    const calls = backend({ step: "enrol" });
    render("/clients/5");
    await toEnrolment();
    const qr = await screen.findByRole("img", { name: /qr code/i });
    expect(qr.getAttribute("src")).toMatch(/^data:image\/gif;base64,/);
    expect(screen.getByLabelText("Secret key")).toHaveTextContent("JBSW Y3DP EHPK 3PXP");
    expect(calls.start).toBe(1);
    expect(screen.getByRole("button", { name: /turn on two-factor/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/code from the app/i), "123456");
    await userEvent.click(screen.getByRole("button", { name: /turn on two-factor/i }));
    expect(await screen.findByLabelText("Recovery codes")).toBeInTheDocument();
    expect(calls.confirm).toEqual([{ challenge: CHALLENGE, code: "123456" }]);
  });

  it("a code that does not match is refused and nothing is switched on", async () => {
    backend({
      step: "enrol",
      confirm: () => HttpResponse.json({ error: "That code is not right, or it has already been used." }, { status: 400 }),
    });
    render();
    await toEnrolment();
    await userEvent.type(await screen.findByLabelText(/code from the app/i), "000000");
    await userEvent.click(screen.getByRole("button", { name: /turn on two-factor/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not right");
    expect(screen.queryByLabelText("Recovery codes")).not.toBeInTheDocument();
  });

  it("shows the recovery codes once and does not let the person go on until they say they are saved", async () => {
    backend({ step: "enrol" });
    render("/clients/6");
    await toEnrolment();
    await userEvent.type(await screen.findByLabelText(/code from the app/i), "123456");
    await userEvent.click(screen.getByRole("button", { name: /turn on two-factor/i }));
    const list = await screen.findByLabelText("Recovery codes");
    RECOVERY.forEach((code) => expect(list).toHaveTextContent(code));
    expect(screen.queryByText("at /clients/6")).not.toBeInTheDocument(); // the account is not loaded into the app yet
    const go = screen.getByRole("button", { name: /continue to finuxia/i });
    expect(go).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /i have saved these codes/i }));
    expect(go).toBeEnabled();
    await userEvent.click(go);
    expect(await screen.findByText("at /clients/6")).toBeInTheDocument();
  });

  it("copies the codes as plain text on request", async () => {
    backend({ step: "enrol" });
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render();
    await toEnrolment();
    await userEvent.type(await screen.findByLabelText(/code from the app/i), "123456");
    await userEvent.click(screen.getByRole("button", { name: /turn on two-factor/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain("ABCDE-FGHJK");
    expect(writeText.mock.calls[0][0]).toContain("Each code works once");
  });

  it("a new account is taken through the set-up before it gets in", async () => {
    backend({ step: "enrol" });
    render("/register");
    await userEvent.type(await screen.findByLabelText(/full name/i), "Jane Doe");
    await userEvent.type(screen.getByLabelText(/^email/i), "jane@example.com");
    await userEvent.type(screen.getByLabelText(/^password/i), "a-long-enough-password");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "a-long-enough-password");
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByRole("heading", { name: "Set up two-factor sign-in" })).toBeInTheDocument();
    await userEvent.type(await screen.findByLabelText(/code from the app/i), "123456");
    await userEvent.click(screen.getByRole("button", { name: /turn on two-factor/i }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /i have saved these codes/i }));
    await userEvent.click(screen.getByRole("button", { name: /continue to finuxia/i }));
    expect(await screen.findByText("at /dashboard")).toBeInTheDocument();
  });

  it("if the secret cannot be fetched the person is told and can start over", async () => {
    backend({ step: "enrol" });
    server.use(
      http.post(`${API}/api/auth/mfa/enrol/start`, () =>
        HttpResponse.json({ error: "This sign-in step has expired. Please sign in again." }, { status: 401 })
      )
    );
    render();
    await toEnrolment();
    expect(await screen.findByRole("alert")).toHaveTextContent("expired");
    await userEvent.click(screen.getByRole("button", { name: /start over/i }));
    expect(await screen.findByLabelText(/email or username/i)).toBeInTheDocument();
  });
});
