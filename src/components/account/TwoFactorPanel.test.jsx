import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API, testUser } from "../../test/handlers";
import { server } from "../../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../../test/utils";
import TwoFactorPanel from "./TwoFactorPanel";

const withMfa = (mfa) => server.use(http.get(`${API}/api/auth/me`, () => HttpResponse.json({ user: { ...testUser, mfa } })));
const render = () => renderWithProviders(<TwoFactorPanel />, { providers: ["router", "toast", "auth"] });

describe("the two-factor panel on the profile", () => {
  it("says it is on and how many recovery codes are left", async () => {
    withMfa({ required: true, enrolled: true, recoveryCodesRemaining: 8 });
    render();
    expect(await screen.findByText(/^On\. You sign in/)).toBeInTheDocument();
    expect(screen.getByTestId("recovery-count")).toHaveTextContent("8");
  });

  it("warns when only a couple are left", async () => {
    withMfa({ required: true, enrolled: true, recoveryCodesRemaining: 2 });
    render();
    expect(await screen.findByText(/get a new set before you run out/i)).toBeInTheDocument();
  });

  it("does not warn when plenty are left", async () => {
    withMfa({ required: true, enrolled: true, recoveryCodesRemaining: 3 });
    render();
    await screen.findByTestId("recovery-count");
    expect(screen.queryByText(/get a new set/i)).not.toBeInTheDocument();
  });

  it("gives a new set after a current code is entered, and shows it once", async () => {
    withMfa({ required: true, enrolled: true, recoveryCodesRemaining: 1 });
    let sent = null;
    server.use(
      http.post(`${API}/api/auth/mfa/recovery-codes`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ recoveryCodes: ["AAAAA-BBBBB", "CCCCC-DDDDD"] });
      })
    );
    render();
    await userEvent.click(await screen.findByRole("button", { name: /get new recovery codes/i }));
    expect(screen.getByRole("button", { name: /replace my recovery codes/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/code from your authenticator app/i), "123456");
    await userEvent.click(screen.getByRole("button", { name: /replace my recovery codes/i }));
    const list = await screen.findByLabelText("New recovery codes");
    expect(list).toHaveTextContent("AAAAA-BBBBB");
    expect(sent).toEqual({ code: "123456" });
    await userEvent.click(screen.getByRole("button", { name: /i have saved them/i }));
    expect(screen.queryByLabelText("New recovery codes")).not.toBeInTheDocument();
  });

  it("shows why a wrong code was refused", async () => {
    withMfa({ required: true, enrolled: true, recoveryCodesRemaining: 5 });
    server.use(
      http.post(`${API}/api/auth/mfa/recovery-codes`, () =>
        HttpResponse.json({ error: "That code is not right, or it has already been used." }, { status: 400 })
      )
    );
    render();
    await userEvent.click(await screen.findByRole("button", { name: /get new recovery codes/i }));
    await userEvent.type(screen.getByLabelText(/code from your authenticator app/i), "000000");
    await userEvent.click(screen.getByRole("button", { name: /replace my recovery codes/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not right");
  });

  it("says so for an account the requirement was lifted for", async () => {
    withMfa({ required: false, enrolled: false, recoveryCodesRemaining: 0 });
    render();
    expect(await screen.findByText(/not required for this account/i)).toBeInTheDocument();
  });

  it("renders nothing when the server sent no two-factor information", async () => {
    let asked = false;
    server.use(
      http.get(`${API}/api/auth/me`, () => {
        asked = true;
        return HttpResponse.json({ user: testUser });
      })
    );
    const { container } = render();
    await waitFor(() => expect(asked).toBe(true));
    expect(container).toBeEmptyDOMElement();
  });
});
