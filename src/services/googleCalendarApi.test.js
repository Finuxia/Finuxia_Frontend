import { describe, expect, it } from "vitest";
import { eventStart, isAllDay, isAppEvent, isOnDate } from "./googleCalendarApi";

describe("Google Calendar event helpers", () => {
  it("recognizes only events tagged as created by Finuxia", () => {
    expect(isAppEvent(undefined)).toBe(false);
    expect(isAppEvent({})).toBe(false);
    expect(isAppEvent({ extendedProperties: { private: { source: "other" } } })).toBe(false);
    expect(isAppEvent({ extendedProperties: { private: { source: "advisorpilot" } } })).toBe(true);
  });

  it("reads timed and all-day starts and distinguishes the formats", () => {
    expect(eventStart({ start: { dateTime: "2026-04-01T09:30:00Z", date: "2026-04-01" } }).toISOString()).toBe("2026-04-01T09:30:00.000Z");
    expect(eventStart({ start: { date: "2026-04-01" } })).toBeInstanceOf(Date);
    expect(eventStart({})).toBeNull();
    expect(isAllDay({ start: { date: "2026-04-01" } })).toBe(true);
    expect(isAllDay({ start: { date: "2026-04-01", dateTime: "2026-04-01T00:00:00Z" } })).toBe(false);
    expect(isAllDay({})).toBe(false);
  });

  it("matches a date only for valid event starts on the same local day", () => {
    const day = new Date(2026, 3, 1, 12);
    expect(isOnDate({ start: { dateTime: new Date(2026, 3, 1, 8).toISOString() } }, day)).toBe(true);
    expect(isOnDate({ start: { date: "2026-04-02" } }, day)).toBe(false);
    expect(isOnDate({ start: { dateTime: "not-a-date" } }, day)).toBe(false);
    expect(isOnDate({}, day)).toBe(false);
  });
});
