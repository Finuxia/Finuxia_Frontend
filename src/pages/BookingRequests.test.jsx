import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import BookingRequests from "./BookingRequests";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, within } from "../test/utils";

const request = (overrides = {}) => ({
  id: "req-1",
  clientName: "Ada Lovelace",
  clientEmail: "ada@example.com",
  clientPhone: "555-0100",
  date: "2026-11-10",
  time: "09:30",
  durationMinutes: 45,
  status: "pending",
  note: "Discuss retirement options",
  guestEmails: ["guest@example.com"],
  answers: [{ questionId: "q1", label: "Topic", answer: "Retirement" }],
  ...overrides,
});

const show = () => renderWithProviders(<BookingRequests />);

describe("booking request review", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the empty state if the request list cannot be loaded", async () => {
    server.use(http.get(`${API}/api/booking/requests`, () => HttpResponse.json({ detail: "Offline" }, { status: 503 })));
    show();
    expect(await screen.findByText(/No booking requests yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Connect Google Calendar on your Profile/i)).toBeInTheDocument();
  });

  it("renders request details and approves while disconnected, without creating a calendar event", async () => {
    let approvals = 0;
    let eventCreates = 0;
    server.use(
      http.get(`${API}/api/booking/requests`, () => HttpResponse.json([request()])),
      http.post(`${API}/api/booking/requests/req-1/approve`, () => {
        approvals += 1;
        return HttpResponse.json({ status: "confirmed" });
      }),
      http.post(`${API}/api/calendar-connect/events`, () => {
        eventCreates += 1;
        return HttpResponse.json({ id: "event-1" });
      })
    );
    show();
    expect(await screen.findByText("Guests: guest@example.com")).toBeInTheDocument();
    expect(screen.getByText("Topic:")).toBeInTheDocument();
    expect(screen.getByText('"Discuss retirement options"')).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText(/Connect Google Calendar \(Profile\)/)).toBeInTheDocument();
    expect(await screen.findByText("Confirmed meeting with Ada Lovelace")).toBeInTheDocument();
    expect(approvals).toBe(1);
    expect(eventCreates).toBe(0);
  });

  it("creates a calendar event for a connected advisor, including guests and the note", async () => {
    let eventBody;
    let linkedEvent;
    server.use(
      http.get(`${API}/api/booking/requests`, () => HttpResponse.json([request({ guestEmails: ["guest@example.com", ""] })])),
      http.get(`${API}/api/calendar-connect/status`, () =>
        HttpResponse.json({ configured: true, connected: true, status: "connected", googleEmail: "advisor@gmail.com" })
      ),
      http.post(`${API}/api/booking/requests/req-1/approve`, () => HttpResponse.json({ status: "confirmed" })),
      http.post(`${API}/api/calendar-connect/events`, async ({ request: req }) => {
        eventBody = await req.json();
        return HttpResponse.json({ id: "google-event-1" });
      }),
      http.put(`${API}/api/booking/requests/req-1/google-event`, async ({ request: req }) => {
        linkedEvent = await req.json();
        return HttpResponse.json({});
      })
    );
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Confirmed meeting with Ada Lovelace")).toBeInTheDocument();
    expect(eventBody).toMatchObject({
      summary: "Meeting with Ada Lovelace",
      description: "Discuss retirement options",
      attendees: ["ada@example.com", "guest@example.com"],
    });
    expect(new Date(eventBody.endISO).getTime() - new Date(eventBody.startISO).getTime()).toBe(45 * 60 * 1000);
    expect(linkedEvent).toEqual({ googleEventId: "google-event-1" });
  });

  it("reports calendar failures without undoing a confirmed booking", async () => {
    server.use(
      http.get(`${API}/api/booking/requests`, () => HttpResponse.json([request()])),
      http.get(`${API}/api/calendar-connect/status`, () =>
        HttpResponse.json({ configured: true, connected: true, status: "connected", googleEmail: "advisor@gmail.com" })
      ),
      http.post(`${API}/api/booking/requests/req-1/approve`, () => HttpResponse.json({ status: "confirmed" })),
      http.post(`${API}/api/calendar-connect/events`, () => HttpResponse.json({ detail: "Google is unavailable" }, { status: 502 }))
    );
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText(/Confirmed, but couldn't add it to Google Calendar/)).toBeInTheDocument();
    expect(await screen.findByText("Confirmed meeting with Ada Lovelace")).toBeInTheDocument();
  });

  it("allows cancelling or rescheduling a confirmed request, and leaves declined requests read-only", async () => {
    const bodies = [];
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    server.use(
      http.get(`${API}/api/booking/requests`, () =>
        HttpResponse.json([
          request({ id: "confirmed", status: "confirmed", googleEventId: "event-1", guestEmails: [], answers: [], note: "" }),
          request({
            id: "declined",
            status: "declined",
            clientName: "Grace Hopper",
            clientPhone: "",
            guestEmails: [],
            answers: [],
            note: "",
          }),
        ])
      ),
      http.post(`${API}/api/booking/requests/confirmed/cancel`, () => HttpResponse.json({ status: "cancelled" })),
      http.post(`${API}/api/booking/requests/confirmed/reschedule`, async ({ request: req }) => {
        bodies.push(await req.json());
        return HttpResponse.json({ status: "confirmed" });
      })
    );
    show();
    const cancelButtons = await screen.findAllByRole("button", { name: "Cancel" });
    expect(cancelButtons).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Reschedule" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    expect(await screen.findByRole("heading", { name: "Reschedule Ada Lovelace" })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    const date = await screen.findByLabelText("Date");
    await userEvent.clear(date);
    await userEvent.type(date, "2026-11-12");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Rescheduled")).toBeInTheDocument();
    expect(bodies).toEqual([{ date: "2026-11-12", time: "09:30" }]);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalledWith("Cancel the meeting with Ada Lovelace?");
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
  });
});
