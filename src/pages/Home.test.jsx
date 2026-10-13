import { readFileSync } from "node:fs";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import App from "../App";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, waitFor } from "../test/utils";
import { PURPOSE } from "./Home";

const signedOut = (ms = 0) =>
  server.use(
    http.get(`${API}/api/auth/me`, async () => {
      await delay(ms);
      return new HttpResponse(null, { status: 401 });
    }),
    http.post(`${API}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 }))
  );

describe("the public home page", () => {
  it("tells a signed-out visitor what Finuxia is, in words, and who it is for", async () => {
    signedOut();
    renderWithProviders(<App />, { route: "/" });
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("The client-relationship app for financial advisors");
    expect(screen.getByText(PURPOSE)).toBeInTheDocument();
    expect(PURPOSE).toMatch(/client-relationship management \(CRM\) web application for financial advisors/);
  });

  it("links to the privacy policy and the terms, and to logging in and registering", async () => {
    signedOut();
    renderWithProviders(<App />, { route: "/" });
    await screen.findByTestId("home");
    for (const [name, href] of [
      ["Log in", "/login"],
      ["Register", "/register"],
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(screen.getAllByRole("link", { name: /Privacy/ }).every((a) => a.getAttribute("href") === "/privacy")).toBe(true);
    expect(screen.getAllByRole("link", { name: /Terms/ }).every((a) => a.getAttribute("href") === "/terms")).toBe(true);
    expect(screen.getAllByRole("link", { name: /Privacy/ }).length).toBeGreaterThanOrEqual(2); // in the text and in the footer
  });

  it("says what the optional Google and Zoom connections are used for", async () => {
    signedOut();
    renderWithProviders(<App />, { route: "/" });
    const section = (await screen.findByRole("heading", { name: "Connected services (optional)" })).closest("section");
    expect(section).toHaveTextContent(/Google Calendar, Google Drive or Zoom/);
    expect(section).toHaveTextContent(/can be removed at any time/);
  });

  it("is there at once, without waiting for the session check to finish", async () => {
    signedOut(300);
    renderWithProviders(<App />, { route: "/" });
    expect(await screen.findByText(PURPOSE)).toBeInTheDocument();
    expect(screen.getByTestId("home")).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(screen.getByTestId("home")).toHaveAttribute("aria-busy", "false"));
  });

  it("is not the login form", async () => {
    signedOut();
    renderWithProviders(<App />, { route: "/" });
    await screen.findByTestId("home");
    expect(screen.queryByText("Welcome back")).not.toBeInTheDocument();
  });

  it("sends a signed-in advisor to the dashboard, as `/` always did", async () => {
    renderWithProviders(<App />, { route: "/" });
    expect(await screen.findByRole("heading", { name: /^Welcome back, / })).toBeInTheDocument(); // the dashboard
    expect(screen.queryByTestId("home")).not.toBeInTheDocument();
  });
});

describe("the same description is in the HTML, for anything that does not run scripts", () => {
  const html = readFileSync("index.html", "utf8") // the tests run from the repository root;
  const squash = (s) => s.replace(/\s+/g, " ").trim();

  it("the page's purpose sentence is in the noscript block word for word", () => {
    const noscript = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? "";
    expect(squash(noscript.replace(/<[^>]+>/g, " "))).toContain(squash(PURPOSE));
  });

  it("there is a meta description and a title that say what it is, and the noscript links to privacy and terms", () => {
    expect(html).toMatch(/<meta\s+name="description"\s+content="Finuxia is a client-relationship management \(CRM\) web application for financial advisors/);
    expect(html).toMatch(/<title>[^<]*financial advisors[^<]*<\/title>/);
    expect(html).toContain('<a href="/privacy">Privacy Policy</a>');
    expect(html).toContain('<a href="/terms">Terms of Service</a>');
  });
});
