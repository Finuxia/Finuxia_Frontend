import { describe, expect, it } from "vitest";
import { canStateIntent } from "./continueIntent";

const summary = (over = {}) => ({
  status: "valid",
  warning: "none",
  endsAt: "2026-12-15T12:00:00",
  daysLeft: 60,
  valid: true,
  warnDays: 14,
  ...over,
});
const billing = (over = {}, accessOver = {}) => ({
  plan: { key: "professional", name: "Professional" },
  access: summary(accessOver),
  ...over,
});

describe("canStateIntent", () => {
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
