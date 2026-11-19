import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { API } from "../../test/handlers";
import { server } from "../../test/server";
import { renderWithProviders, screen } from "../../test/utils";
import NotificationsDropdown from "./NotificationsDropdown";

const reminder = (id, title) => ({ id, title, status: "pending", dueDate: "2020-01-01", dueTime: null, kind: "reminder" });

function serveReminders(list) {
  server.use(http.get(`${API}/api/reminders`, () => HttpResponse.json({ results: list, nextCursor: null })));
}

describe("notifications: read and unread", () => {
  beforeEach(() => localStorage.clear());

  it("opening the panel does not mark anything as read", async () => {
    serveReminders([reminder(1, "Call Sam"), reminder(2, "Send forms")]);
    renderWithProviders(<NotificationsDropdown />);
    const bell = screen.getByRole("button", { name: "Notifications" });
    expect(await screen.findByText("2")).toBeInTheDocument();
    await userEvent.click(bell);
    expect(await screen.findByText(/Reminder overdue: Call Sam/)).toBeInTheDocument();
    expect(bell).toHaveTextContent("2");
  });

  it("Mark all as read clears the badge, keeps the list, and the choice survives a reload", async () => {
    serveReminders([reminder(1, "Call Sam"), reminder(2, "Send forms")]);
    const first = renderWithProviders(<NotificationsDropdown />);
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    await userEvent.click(await screen.findByRole("button", { name: "Mark all as read" }));
    expect(screen.getByRole("button", { name: "Notifications" })).not.toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
    expect(screen.getByText(/Reminder overdue: Call Sam/)).toBeInTheDocument();
    first.unmount();

    renderWithProviders(<NotificationsDropdown />);
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText(/Reminder overdue: Send forms/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).not.toHaveTextContent(/\d/);
  });

  it("a reminder that arrives after Mark all as read is unread", async () => {
    serveReminders([reminder(1, "Call Sam")]);
    const first = renderWithProviders(<NotificationsDropdown />);
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    await userEvent.click(await screen.findByRole("button", { name: "Mark all as read" }));
    first.unmount();

    serveReminders([reminder(1, "Call Sam"), reminder(3, "New one")]);
    renderWithProviders(<NotificationsDropdown />);
    expect(await screen.findByText("1")).toBeInTheDocument();
  });
});
