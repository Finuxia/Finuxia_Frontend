import { describe, expect, it } from "vitest";
import { accessCopy, canStateIntent } from "./accessCopy";

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

  it("lapsing, for someone who said they will not continue: still says when, no longer urges a purchase", () => {
    const lapsing = summary({ status: "lapsing", warning: "soon", daysLeft: 9 });
    const copy = accessCopy(lapsing, { notContinuing: true });
    expect(copy.headline).toBe("Your access ends in 9 days, on June 30, 2026.");
    expect(copy.detail).toContain("You've told us you don't plan to continue");
    expect(copy.detail).not.toMatch(/Buy a plan before/);
    expect(accessCopy(lapsing).detail).toMatch(/Buy a plan before/); // unchanged for everyone else
    expect(accessCopy(summary(), { notContinuing: true })).toEqual(accessCopy(summary())); // nothing to say while access is comfortable
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

describe("canStateIntent", () => {
  const billing = (over = {}, accessOver = {}) => ({ plan: { key: "professional", name: "Professional" }, access: summary(accessOver), ...over });

  it("is offered while access is running and has an end", () => {
    expect(canStateIntent(billing())).toBe(true);
    expect(canStateIntent(billing({}, { status: "lapsing", warning: "soon", daysLeft: 5 }))).toBe(true);
  });

  it("is not offered with no billing, no plan, or no summary", () => {
    expect(canStateIntent(null)).toBe(false);
    expect(canStateIntent(undefined)).toBe(false);
    expect(canStateIntent(billing({ plan: null }))).toBe(false);
    expect(canStateIntent(billing({ access: null }))).toBe(false);
  });

  it("is not offered when access is not valid, even if the rest looks fine", () => {
    expect(canStateIntent(billing({}, { valid: false }))).toBe(false);
  });

  it("is not offered when there is no end, even if the status looks fine", () => {
    expect(canStateIntent(billing({}, { endsAt: null }))).toBe(false);
  });

  it("is not offered when access does not end or has ended, staff included (valid, yet lapsed)", () => {
    expect(canStateIntent(billing({}, { status: "unlimited", endsAt: null, daysLeft: null }))).toBe(false);
    expect(canStateIntent(billing({}, { status: "lapsed", warning: "ended", valid: false, daysLeft: 0 }))).toBe(false);
    expect(canStateIntent(billing({}, { status: "lapsed", warning: "ended", valid: true, daysLeft: 0 }))).toBe(false);
  });
});
