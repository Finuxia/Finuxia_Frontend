import { describe, expect, it } from "vitest";
import { buildTimeSlots, formatSlotLabel, generateSlotTimes } from "./timeSlots";

describe("calendar time slots", () => {
  it("generates half-hour labels by default and accepts a custom range", () => {
    expect(generateSlotTimes().slice(0, 3)).toEqual(["00:00", "00:30", "01:00"]);
    expect(generateSlotTimes({ startHour: 9, endHour: 10, stepMinutes: 20 })).toEqual(["09:00", "09:20", "09:40"]);
    expect(generateSlotTimes({ startHour: 10, endHour: 9 })).toEqual([]);
  });

  it("marks any overlapping slot busy and ignores invalid calendar intervals", () => {
    const slots = buildTimeSlots({
      date: "2026-06-15",
      times: ["09:00", "09:30", "10:00"],
      durationMinutes: 30,
      busyIntervals: [
        { start: "invalid", end: "2026-06-15T10:00:00" },
        { start: "2026-06-15T09:15:00", end: "2026-06-15T09:20:00" },
        { start: "2026-06-15T09:45:00", end: "2026-06-15T10:00:00" },
      ],
    });
    expect(slots.map((slot) => slot.available)).toEqual([false, false, true]);
    expect(slots[0].reason).toBe("CALENDAR_BUSY");
    expect(new Date(slots[0].endISO).getTime() - new Date(slots[0].startISO).getTime()).toBe(30 * 60 * 1000);
    expect(slots[2].reason).toBeUndefined();
  });

  it.each([
    ["00:00", "12:00 AM"],
    ["12:05", "12:05 PM"],
    ["15:40", "3:40 PM"],
  ])("formats %s as %s", (time, expected) => {
    expect(formatSlotLabel(time)).toBe(expected);
  });
});
