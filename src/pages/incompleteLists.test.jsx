import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen } from "../test/utils";
import NotificationsDropdown from "../components/layout/NotificationsDropdown";
import BookingRequests from "./BookingRequests";
import Documents from "./Documents";
import FollowUps from "./FollowUps";
import MyDay from "./MyDay";
import SalesPackagePrep from "./SalesPackagePrep";

/** A collection the server never finishes paging (the cap is reached), or one it pages normally. */
const endless = (path) =>
  server.use(
    http.get(`${API}${path}`, () =>
      HttpResponse.json({ results: [], nextCursor: "again" }),
    ),
  );
const short = (path) =>
  server.use(
    http.get(`${API}${path}`, () =>
      HttpResponse.json({ results: [], nextCursor: null }),
    ),
  );
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
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /booking requests is incomplete/,
    );
  });

  it("Booking requests is quiet when the list is whole", async () => {
    short("/api/booking/requests");
    renderWithProviders(<BookingRequests />);
    await screen.findByText("Booking Requests");
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("Documents (the advisor's own submissions)", async () => {
    endless("/api/documents/mine");
    server.use(
      http.get(`${API}/api/documents`, () =>
        HttpResponse.json({ results: [], nextCursor: null }),
      ),
    );
    renderWithProviders(<Documents />);
    expect(
      await screen.findByText(/your submitted documents is incomplete/),
    ).toBeInTheDocument();
  });

  it("Follow-ups", async () => {
    endless("/api/reminders");
    renderWithProviders(<FollowUps />);
    expect(
      await screen.findByText(/follow-ups is incomplete/),
    ).toBeInTheDocument();
  });

  it("My day (reminders)", async () => {
    endless("/api/reminders");
    renderWithProviders(<MyDay />);
    expect(
      await screen.findByText(/reminders is incomplete/),
    ).toBeInTheDocument();
  });

  it.each([
    ["reminders", "/api/reminders", "/api/booking/requests"],
    ["booking requests", "/api/booking/requests", "/api/reminders"],
  ])(
    "the notifications panel, when only the %s are cut off",
    async (_name, cutOff, whole) => {
      endless(cutOff);
      short(whole);
      renderWithProviders(<NotificationsDropdown />);
      await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());
      (await screen.findByRole("button")).click();
      expect(
        await screen.findByText(/reminders or booking requests is incomplete/),
      ).toBeInTheDocument();
    },
  );

  it("the notifications panel is quiet when both lists are whole", async () => {
    short("/api/reminders");
    short("/api/booking/requests");
    renderWithProviders(<NotificationsDropdown />);
    (await screen.findByRole("button")).click();
    await screen.findByText("Notifications");
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("the sales package picker lists what it has and says the list is incomplete", async () => {
    let n = 0;
    server.use(
      http.get(`${API}/api/sales-packages/packages`, () => {
        n += 1;
        return HttpResponse.json({
          results: [
            {
              id: n,
              insuredPerson: `Person ${n}`,
              status: "draft",
              updatedAt: "2026-10-01T10:00:00Z",
            },
          ],
          nextCursor: "again",
        });
      }),
    );
    renderWithProviders(<SalesPackagePrep />, { route: "/sales" });
    expect(
      await screen.findByText(/sales packages is incomplete/),
    ).toBeInTheDocument();
    expect(screen.getByText("Person 1")).toBeInTheDocument();
  });

  it("the sales package picker is quiet when the list is whole", async () => {
    server.use(
      http.get(`${API}/api/sales-packages/packages`, () =>
        HttpResponse.json({
          results: [
            {
              id: 1,
              insuredPerson: "Grace",
              status: "draft",
              updatedAt: "2026-10-01T10:00:00Z",
            },
          ],
          nextCursor: null,
        }),
      ),
    );
    renderWithProviders(<SalesPackagePrep />, { route: "/sales" });
    expect(await screen.findByText("Grace")).toBeInTheDocument();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });
});
