import { describe, expect, it } from "vitest";
import { daysLeft, formatLongDate } from "./dates";

describe("formatLongDate", () => {
  const local = (y, m, d, h = 12) => new Date(y, m - 1, d, h).toISOString();

  it("reads as a date a person would write, in their own time zone", () => {
    expect(formatLongDate(local(2026, 2, 1))).toBe("February 1, 2026");
    expect(formatLongDate(local(2026, 12, 31, 23))).toBe("December 31, 2026");
  });

  it("is empty, not 'Invalid Date', for anything that is not a date", () => {
    for (const junk of [null, undefined, "", "not a date", "2026-13-45"]) expect(formatLongDate(junk), String(junk)).toBe("");
  });
});

describe("daysLeft", () => {
  const now = new Date(2026, 0, 10, 12, 0, 0);
  const at = (days, hours = 0) => new Date(now.getTime() + days * 86400000 + hours * 3600000).toISOString();

  it("counts whole days, and a part day as a day", () => {
    expect(daysLeft(at(12), now)).toBe(12);
    expect(daysLeft(at(11, 1), now)).toBe(12);
    expect(daysLeft(at(0, 1), now)).toBe(1);
  });

  it("is 0 once it has passed, never negative", () => {
    expect(daysLeft(at(0), now)).toBe(0);
    expect(daysLeft(at(-3), now)).toBe(0);
  });

  it("is null for no date or a bad one, not NaN", () => {
    for (const junk of [null, undefined, "", "soon"]) expect(daysLeft(junk, now), String(junk)).toBeNull();
  });
});
