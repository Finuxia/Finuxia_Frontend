/**
 * SETTING THINGS UP THROUGH THE API, as the signed-in user, for steps a journey needs but is not about.
 *
 * The booking journey is about a client booking a slot and the advisor approving it, not about filling in the booking-link form; the AI journey
 * is about running out of credit, not about the plan-change dialog. Those preparations go through the same public API the web app calls, with the
 * same session: `page.context().request` carries the browser's httpOnly auth cookies, and an unsafe request echoes the readable `fx_csrf` cookie
 * in `X-CSRF-Token`, exactly as `src/lib/api.js` does. Nothing here is a test-only endpoint.
 */
import { expect } from "@playwright/test";

/** Where the API is. The web app reads VITE_API_URL; the local stack serves on 8000. */
export const API_URL = (process.env.E2E_API_URL || "http://localhost:8000").replace(/\/$/, "");

async function csrfToken(page) {
  const cookies = await page.context().cookies(API_URL);
  return cookies.find((c) => c.name === "fx_csrf")?.value || "";
}

/** `method` `path` as the signed-in user; returns the decoded body and fails the test, with the body, on anything but a 2xx. */
export async function apiCall(page, method, path, data) {
  const headers = method === "GET" ? {} : { "X-CSRF-Token": await csrfToken(page), "Content-Type": "application/json" };
  const response = await page
    .context()
    .request.fetch(`${API_URL}${path}`, { method, headers, data: data === undefined ? undefined : JSON.stringify(data) });
  const text = await response.text();
  expect(response.ok(), `${method} ${path} -> ${response.status()}: ${text.slice(0, 300)}`).toBe(true);
  return text ? JSON.parse(text) : null;
}
