import { describe, expect, it } from "vitest";
import { creditsLabel, formatCents, formatResetDay, isAiBlocked, warningMessage } from "./aiUsage";

const usage = (over = {}) => ({
  mode: "allowance",
  warning: "warning",
  percentUsed: 85,
  blocked: null,
  period: { start: "2026-10-01T12:00:00Z", end: "2026-11-04T12:00:00Z" },
  credits: { included: 100, extra: 0, total: 100, used: 85, inFlight: 0, remaining: 15 },
  wallet: { balanceCents: 250 },
  ...over,
});

describe("formatCents", () => {
  it("shows whole cents exactly, with thousands separators", () => {
    const cases = { 0: "$0.00", 1: "$0.01", 9: "$0.09", 100: "$1.00", 1005: "$10.05", 123456: "$1,234.56", 99999999: "$999,999.99", [-250]: "-$2.50" };
    for (const [cents, text] of Object.entries(cases)) expect(formatCents(Number(cents)), cents).toBe(text);
  });

  it("never shows a fraction of a cent or NaN: anything that is not a whole number reads as $0.00", () => {
    for (const bad of [1.5, NaN, undefined, null, "12", Infinity]) expect(formatCents(bad), String(bad)).toBe("$0.00");
  });
});

describe("creditsLabel", () => {
  it("is singular only for exactly one", () => {
    expect(creditsLabel(1)).toBe("1 credit");
    expect(creditsLabel(0)).toBe("0 credits");
    expect(creditsLabel(2)).toBe("2 credits");
    expect(creditsLabel(1500)).toBe("1,500 credits");
    expect(creditsLabel(undefined)).toBe("0 credits");
  });
});

describe("formatResetDay", () => {
  it("is the day, without the year", () => {
    expect(formatResetDay("2026-11-04T12:00:00Z")).toBe("November 4");
  });
  it("is empty for a missing or invalid date", () => {
    for (const bad of [null, undefined, "", "not a date"]) expect(formatResetDay(bad)).toBe("");
  });
});

describe("isAiBlocked", () => {
  it("is a refusal to pay (402) and nothing else", () => {
    expect(isAiBlocked({ status: 402 })).toBe(true);
    for (const other of [{ status: 403 }, { status: 429 }, { status: 502 }, { status: 0 }, null, undefined]) expect(isAiBlocked(other)).toBe(false);
  });
});

describe("warningMessage", () => {
  it("says how much is used, how much is left and when it starts again", () => {
    const text = warningMessage(usage());
    expect(text).toContain("85%");
    expect(text).toContain("15 credits left");
    expect(text).toContain("November 4");
  });

  it("is said again, urgently, at 95%", () => {
    expect(warningMessage(usage({ warning: "critical", percentUsed: 96, credits: { total: 100, remaining: 4 } }))).toContain("96%");
  });

  it("when the plan's credits are used up but the wallet still pays, says so with the wallet balance", () => {
    const text = warningMessage(usage({ warning: "exhausted", percentUsed: 100, credits: { total: 100, remaining: 0 } }));
    expect(text).toContain("used all 100 credits");
    expect(text).toContain("paid from your wallet ($2.50)");
  });

  it("is nothing below 80%, with no allowance, unlimited, or once blocked (the blocked notice says it)", () => {
    expect(warningMessage(usage({ warning: null }))).toBeNull();
    expect(warningMessage(usage({ mode: "unlimited" }))).toBeNull();
    expect(warningMessage(usage({ mode: "wallet" }))).toBeNull();
    expect(warningMessage(usage({ mode: "none" }))).toBeNull();
    expect(warningMessage(usage({ blocked: { message: "x", actions: [] } }))).toBeNull();
    expect(warningMessage(null)).toBeNull();
  });

  it("never mentions tokens", () => {
    expect(warningMessage(usage()).toLowerCase()).not.toContain("token");
  });
});
