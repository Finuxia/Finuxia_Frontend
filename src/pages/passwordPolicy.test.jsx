import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import App from "../App";
import { PASSWORD_REQUIREMENT } from "../lib/passwordPolicy";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent } from "../test/utils";

const show = (route) => renderWithProviders(<App />, { route });
const commonPassword = "password1234";
const tooShortPassword = "12345678901";

describe("the shared password policy", () => {
  it("sign-up states the requirement, blocks a short value locally, and surfaces the server's refusal", async () => {
    let requests = 0;
    server.use(
      http.post(`${API}/api/auth/register`, () => {
        requests += 1;
        return HttpResponse.json({ password: ["This password is too common."] }, { status: 400 });
      })
    );
    show("/register");
    expect(await screen.findByPlaceholderText(PASSWORD_REQUIREMENT.replace(/\.$/, ""))).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/full name/i), "Test Advisor");
    await userEvent.type(screen.getByLabelText(/^email$/i), "advisor@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), tooShortPassword);
    await userEvent.type(screen.getByLabelText(/confirm password/i), tooShortPassword);
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText(/must be at least 12 characters/i)).toBeInTheDocument();
    expect(requests).toBe(0);

    await userEvent.clear(screen.getByLabelText(/^password$/i));
    await userEvent.clear(screen.getByLabelText(/confirm password/i));
    await userEvent.type(screen.getByLabelText(/^password$/i), commonPassword);
    await userEvent.type(screen.getByLabelText(/confirm password/i), commonPassword);
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText("This password is too common.")).toBeInTheDocument();
    expect(requests).toBe(1);
  });

  it("reset states the requirement, blocks a short value locally, and surfaces the server's refusal", async () => {
    let requests = 0;
    server.use(
      http.post(`${API}/api/auth/reset-password`, () => {
        requests += 1;
        return HttpResponse.json({ password: ["This password is too similar to your email address."] }, { status: 400 });
      })
    );
    show("/reset-password?uid=1&token=valid");
    expect(await screen.findByText(`Use ${PASSWORD_REQUIREMENT.toLowerCase()}`)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/^new password$/i), tooShortPassword);
    await userEvent.type(screen.getByLabelText(/confirm new password/i), tooShortPassword);
    await userEvent.click(screen.getByRole("button", { name: "Set New Password" }));
    expect(await screen.findByText(/must be at least 12 characters/i)).toBeInTheDocument();
    expect(requests).toBe(0);

    await userEvent.clear(screen.getByLabelText(/^new password$/i));
    await userEvent.clear(screen.getByLabelText(/confirm new password/i));
    await userEvent.type(screen.getByLabelText(/^new password$/i), commonPassword);
    await userEvent.type(screen.getByLabelText(/confirm new password/i), commonPassword);
    await userEvent.click(screen.getByRole("button", { name: "Set New Password" }));
    expect(await screen.findByText("This password is too similar to your email address.")).toBeInTheDocument();
    expect(requests).toBe(1);
  });

  it("change states the requirement, blocks a short value locally, and surfaces the server's refusal", async () => {
    let requests = 0;
    server.use(
      http.post(`${API}/api/auth/change-password`, () => {
        requests += 1;
        return HttpResponse.json({ newPassword: ["This password is too common."] }, { status: 400 });
      })
    );
    show("/profile");
    expect(await screen.findByText(`${PASSWORD_REQUIREMENT} Changing it signs out your other devices.`)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/current password/i), "current-password");
    await userEvent.type(screen.getByLabelText(/^new password$/i), tooShortPassword);
    await userEvent.type(screen.getByLabelText(/confirm new password/i), tooShortPassword);
    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    expect(await screen.findByText(/must be at least 12 characters/i)).toBeInTheDocument();
    expect(requests).toBe(0);

    await userEvent.clear(screen.getByLabelText(/^new password$/i));
    await userEvent.clear(screen.getByLabelText(/confirm new password/i));
    await userEvent.type(screen.getByLabelText(/^new password$/i), commonPassword);
    await userEvent.type(screen.getByLabelText(/confirm new password/i), commonPassword);
    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    expect(await screen.findByText("This password is too common.")).toBeInTheDocument();
    expect(requests).toBe(1);
  });
});
