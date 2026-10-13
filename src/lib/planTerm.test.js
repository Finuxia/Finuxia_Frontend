import { describe, expect, it } from "vitest";
import { describeTerm, priceLine } from "./planTerm";

const dur = (kind, over = {}) => ({ kind, days: null, months: null, years: null, until: null, ...over });

describe("describeTerm", () => {
  it.each([
    [dur("never"), "no end"],
    [dur("days", { days: 1 }), "1 day"],
    [dur("days", { days: 30 }), "30 days"],
    [dur("months", { months: 1 }), "1 month"],
    [dur("months", { months: 3 }), "3 months"],
    [dur("years", { years: 1 }), "1 year"],
    [dur("years", { years: 2 }), "2 years"],
    [dur("until_date", { until: "2026-12-31" }), "until December 31, 2026"],
    [dur("until_date", { until: "2027-01-01" }), "until January 1, 2027"], // a calendar date: no time zone can move it to the day before
    [dur("until_date", { until: null }), ""],
    [dur("something_new"), ""],
    [null, ""],
    [undefined, ""],
  ])("%j -> %s", (duration, words) => {
    expect(describeTerm(duration)).toBe(words);
  });
});

describe("priceLine", () => {
  const plan = (over) => ({ priceCents: 4900, currency: "usd", accessDuration: dur("months", { months: 1 }), ...over });

  it("shows the whole-cent amount and the term", () => {
    expect(priceLine(plan())).toBe("$49.00 for 1 month");
    expect(priceLine(plan({ priceCents: 49000, accessDuration: dur("years", { years: 1 }) }))).toBe("$490.00 for 1 year");
    expect(priceLine(plan({ currency: "cad", accessDuration: dur("days", { days: 30 }) }))).toBe("$49.00 CAD for 30 days");
  });

  it("an amount with cents is exact, never rounded", () => {
    expect(priceLine(plan({ priceCents: 4999 }))).toBe("$49.99 for 1 month");
    expect(priceLine(plan({ priceCents: 1 }))).toBe("$0.01 for 1 month");
    expect(priceLine(plan({ priceCents: 1000000 }))).toBe("$10,000.00 for 1 month");
  });

  it("a plan that never ends is one-time, one with a fixed end says when", () => {
    expect(priceLine(plan({ accessDuration: dur("never") }))).toBe("$49.00 one-time");
    expect(priceLine(plan({ accessDuration: dur("until_date", { until: "2026-12-31" }) }))).toBe("$49.00 until December 31, 2026");
  });

  it("free is free, and a server that sends no term still shows the price", () => {
    expect(priceLine(plan({ priceCents: 0 }))).toBe("Free");
    expect(priceLine(plan({ accessDuration: undefined }))).toBe("$49.00");
  });
});
