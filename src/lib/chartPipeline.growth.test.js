import { describe, expect, it } from "vitest";
import { MEETING_TYPES, countsByMonthAndType, growth, monthKeysBetween } from "./chartPipeline";

const at = (summary, iso) => ({ summary, start: { dateTime: iso } });

describe("meeting types", () => {
  it("lists every type in the order a client moves through them, with Other last", () => {
    expect(MEETING_TYPES).toEqual(["CP", "FC1", "FC2", "FC3", "Strategy", "Closing", "Policy Delivery", "Other"]);
  });
});

describe("monthKeysBetween", () => {
  it("counts the months from the first to the last, both included", () => {
    expect(monthKeysBetween("2026-10", "2026-11")).toEqual(["2026-10", "2026-11"]);
    expect(monthKeysBetween("2026-11", "2026-11")).toEqual(["2026-11"]);
  });

  it("goes across a year end", () => {
    expect(monthKeysBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("is empty for an end before the start, or a missing end", () => {
    expect(monthKeysBetween("2026-11", "2026-10")).toEqual([]);
    expect(monthKeysBetween("2026-11", null)).toEqual([]);
  });
});

describe("countsByMonthAndType", () => {
  it("counts meetings per month and type, by the words in the title", () => {
    const counts = countsByMonthAndType([
      at("CP - Dana", "2026-10-03T10:00:00"),
      at("CP - Lee", "2026-10-20T10:00:00"),
      at("FC1 Dana", "2026-10-21T10:00:00"),
      at("CP - Sam", "2026-11-02T10:00:00"),
      at("Lunch", "2026-11-03T10:00:00"),
    ]);
    expect(counts).toEqual({ "2026-10": { CP: 2, FC1: 1 }, "2026-11": { CP: 1, Other: 1 } });
  });

  it("ignores an event with no usable date", () => {
    expect(countsByMonthAndType([{ summary: "CP" }])).toEqual({});
  });
});

describe("growth", () => {
  it("gives the change and the percentage", () => {
    expect(growth(4, 6)).toEqual({ change: 2, percent: 50 });
    expect(growth(10, 5)).toEqual({ change: -5, percent: -50 });
    expect(growth(3, 3)).toEqual({ change: 0, percent: 0 });
  });

  it("has no percentage when there was nothing before", () => {
    expect(growth(0, 5)).toEqual({ change: 5, percent: null });
    expect(growth(0, 0)).toEqual({ change: 0, percent: null });
  });
});
