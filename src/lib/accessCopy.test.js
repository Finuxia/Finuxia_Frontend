import { describe, expect, it } from "vitest";
import { accessCopy } from "./accessCopy";

const summary = (over) => ({
  status: "valid",
  warning: "none",
  endsAt: "2026-06-30T12:00:00",
  daysLeft: 40,
  valid: true,
  warnDays: 14,
  ...over,
});

describe("accessCopy", () => {
  it("says nothing when the server sent no summary", () => {
    expect(accessCopy(null)).toBeNull();
    expect(accessCopy(undefined)).toBeNull();
  });

  it("valid: the end date and the days left", () => {
    expect(accessCopy(summary())).toMatchObject({ tone: "ok", headline: "You have access until June 30, 2026.", detail: "40 days left." });
    expect(accessCopy(summary({ daysLeft: 1 })).detail).toBe("1 day left.");
  });

  it("no end: says so, and invents no date", () => {
    expect(accessCopy(summary({ status: "unlimited", endsAt: null, daysLeft: null }))).toMatchObject({
      tone: "ok",
      headline: "Your access does not end.",
    });
  });

  it("lapsing: warns, louder when urgent, and says when", () => {
    expect(accessCopy(summary({ status: "lapsing", warning: "soon", daysLeft: 9 }))).toMatchObject({
      tone: "soon",
      headline: "Your access ends in 9 days, on June 30, 2026.",
    });
    expect(accessCopy(summary({ status: "lapsing", warning: "urgent", daysLeft: 1 }))).toMatchObject({
      tone: "urgent",
      headline: "Your access ends in 1 day, on June 30, 2026.",
    });
    expect(accessCopy(summary({ status: "lapsing", warning: "urgent", daysLeft: 0 })).headline).toBe(
      "Your access ends today, on June 30, 2026."
    );
  });

  it("lapsed: says it ended, that nothing was deleted, and how to get back", () => {
    const copy = accessCopy(summary({ status: "lapsed", warning: "ended", daysLeft: 0 }));
    expect(copy.tone).toBe("ended");
    expect(copy.headline).toBe("Your access ended on June 30, 2026.");
    expect(copy.detail).toMatch(/Nothing you added has been deleted/);
  });

  it("an unreadable end date is left out rather than shown as 'Invalid Date'", () => {
    expect(accessCopy(summary({ status: "lapsed", warning: "ended", endsAt: "not a date" })).headline).toBe("Your access has ended.");
  });
});
