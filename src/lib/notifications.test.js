import { afterEach, describe, expect, it, vi } from "vitest";
import { buildNotifications, formatTime } from "./notifications";

describe("notifications", () => {
  afterEach(() => vi.useRealTimers());

  it("collects overdue, today's meeting, and recent-lead notifications", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T12:00:00Z"));
    const items = buildNotifications([
      {
        id: "1",
        first: "Ada",
        last: "Lovelace",
        nextFollowUp: "Overdue",
        joined: "2026-02-10",
        meeting: { date: "2026-02-10", time: "09:05" },
      },
      { id: "2", first: "Grace", last: "Hopper", joined: "not-a-date", meeting: { date: "2026-02-10" } },
      { id: "3", first: "Alan", last: "Turing", joined: "2026-02-01", meeting: { date: "2026-02-11" } },
      { id: "4", first: "Empty", last: "Join Date", joined: "" },
    ]);
    expect(items.map((item) => item.type)).toEqual(["overdue", "meeting", "lead", "meeting"]);
    expect(items[1].text).toContain("at 9:05 AM");
    expect(items[3].text).not.toContain(" at ");
  });

  it("includes pending due or overdue reminders and waiting booking requests only", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T12:00:00Z"));
    const items = buildNotifications(
      [],
      [
        { id: "past", status: "pending", dueDate: "2026-02-09", title: "Call client" },
        { id: "today", status: "pending", dueDate: "2026-02-10", dueTime: "15:30", title: "Send forms" },
        { id: "untimed", status: "pending", dueDate: "2026-02-10", title: "Review notes" },
        { id: "future", status: "pending", dueDate: "2026-02-11", title: "Later" },
        { id: "done", status: "done", dueDate: "2026-02-10", title: "Closed" },
      ],
      [
        { id: "pending", status: "pending", clientName: "Ada", date: "2026-02-12", time: "00:00" },
        { id: "accepted", status: "accepted", clientName: "Grace", date: "2026-02-12", time: "12:00" },
      ]
    );
    expect(items.map((item) => item.type)).toEqual(["reminder-overdue", "reminder-due", "reminder-due", "booking-pending"]);
    expect(items[0].text).toBe("Reminder overdue: Call client");
    expect(items[1].text).toContain("at 3:30 PM");
    expect(items[2].text).toBe("Reminder due today: Review notes");
    expect(items[3].text).toContain("at 12:00 AM");
  });

  it.each([
    ["00:03", "12:03 AM"],
    ["12:00", "12:00 PM"],
    ["23:59", "11:59 PM"],
  ])("formats %s as %s", (time, label) => {
    expect(formatTime(time)).toBe(label);
  });
});
