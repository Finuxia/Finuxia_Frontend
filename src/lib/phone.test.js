import { describe, expect, it } from "vitest";
import { formatCanadianPhone } from "./phone";

describe("Canadian phone formatting", () => {
  it.each([
    ["", ""],
    ["12", "(12"],
    ["1234", "(123) 4"],
    ["1234567", "(123) 456-7"],
    ["(416) 555-0199", "(416) 555-0199"],
    ["1 416 555 0199", "(141) 655-5019"],
  ])("formats %j as %j", (value, expected) => expect(formatCanadianPhone(value)).toBe(expected));
});
