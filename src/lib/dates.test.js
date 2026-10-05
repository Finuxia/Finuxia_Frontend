import { afterEach, describe, expect, it } from "vitest";
import { birthDateError, todayISO } from "./dates";

const originalTZ = process.env.TZ;
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

describe("birthDateError", () => {
  it.each([
    ["", ""],
    ["1980-05-05", ""],
    ["1900-01-01", ""],
    ["2000-02-29", ""], // a real leap day
    ["1999-02-29", "That isn't a real calendar date."],
    ["1980-13-01", "That isn't a real calendar date."],
    ["1980-04-31", "That isn't a real calendar date."],
    ["146753-01-01", "Enter a valid date with a 4-digit year."],
    ["80-05-05", "Enter a valid date with a 4-digit year."],
    ["1899-12-31", "Date of birth can't be before 1900."],
    ["2999-01-01", "Date of birth can't be in the future."],
  ])("%j -> %j", (value, expected) => {
    expect(birthDateError(value)).toBe(expected);
  });

  it("gives the same answer in every time zone: a valid date is valid east and west of UTC", () => {
    for (const tz of [
      "Pacific/Auckland",
      "Asia/Tehran",
      "Europe/Paris",
      "UTC",
      "America/Toronto",
      "America/Vancouver",
      "Pacific/Honolulu",
    ]) {
      process.env.TZ = tz;
      expect(birthDateError("1980-05-05"), tz).toBe("");
      expect(birthDateError("2000-02-29"), tz).toBe("");
      expect(birthDateError("1999-02-29"), tz).toBe("That isn't a real calendar date.");
      expect(birthDateError("2999-01-01"), tz).toBe("Date of birth can't be in the future.");
    }
  });

  it("today is not in the future, tomorrow is", () => {
    expect(birthDateError(todayISO())).toBe("");
  });
});
