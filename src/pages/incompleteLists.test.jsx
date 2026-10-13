import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen } from "../test/utils";
import NotificationsDropdown from "../components/NotificationsDropdown";
import BookingRequests from "./BookingRequests";
import Documents from "./Documents";
import FollowUps from "./FollowUps";
import MyDay from "./MyDay";

/** A collection the server never finishes paging (the cap is reached), or one it pages normally. */
const endless = (path) => server.use(http.get(`${API}${path}`, () => HttpResponse.json({ results: [], nextCursor: "again" })));
const short = (path) => server.use(http.get(`${API}${path}`, () => HttpResponse.json({ results: [], nextCursor: null })));
const NOTICE = /list of .* is incomplete/i;

let consoleError;
beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

describe("a screen that reads a whole collection says when the list is incomplete (DATA-11)", () => {
  it("Booking requests", async () => {
    endless("/api/booking/requests");
    renderWithProviders(<BookingRequests />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/booking requests is incomplete/);
  });

  it("Booking requests is quiet when the list is whole", async () => {
    short("/api/booking/requests");
    renderWithProviders(<BookingRequests />);
    await screen.findByText("Booking Requests");
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("Documents (the advisor's own submissions)", async () => {
    endless("/api/documents/mine");
    server.use(http.get(`${API}/api/documents`, () => HttpResponse.json({ results: [], nextCursor: null })));
    renderWithProviders(<Documents />);
    expect(await screen.findByText(/your submitted documents is incomplete/)).toBeInTheDocument();
  });

  it("Follow-ups", async () => {
    endless("/api/reminders");
    renderWithProviders(<FollowUps />);
    expect(await screen.findByText(/follow-ups is incomplete/)).toBeInTheDocument();
  });

  it("My day (reminders)", async () => {
    endless("/api/reminders");
    renderWithProviders(<MyDay />);
    expect(await screen.findByText(/reminders is incomplete/)).toBeInTheDocument();
  });

  it("the notifications panel", async () => {
    endless("/api/booking/requests");
    renderWithProviders(<NotificationsDropdown />);
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());
    (await screen.findByRole("button")).click();
    expect(await screen.findByText(/reminders or booking requests is incomplete/)).toBeInTheDocument();
  });
});
