import { describe, expect, it } from "vitest";
import { formatCents, formatCurrencyInput } from "./currency";

describe("formatCurrencyInput", () => {
  it.each([
    ["", ""],
    [null, ""],
    ["1234567", "$1,234,567"],
    ["1234.5", "$1,234.5"],
    ["1234.567", "$1,234.56"],
    ["abc12x3", "$123"],
    ["1.2.3", "$1.23"],
    [".5", "$0.5"],
  ])("formats %j as %j", (input, expected) => {
    expect(formatCurrencyInput(input)).toBe(expected);
  });
});

describe("formatCents", () => {
  it("reads as money", () => {
    expect(formatCents(9900, "usd")).toBe("$99.00");
    expect(formatCents(4950, "USD")).toBe("$49.50");
    expect(formatCents(0, "usd")).toBe("$0.00");
    expect(formatCents(100000, "usd")).toBe("$1,000.00");
  });

  it("is exact for every cent, built from the integer and never from a fraction", () => {
    expect(formatCents(1, "usd")).toBe("$0.01");
    expect(formatCents(5, "usd")).toBe("$0.05");
    expect(formatCents(99, "usd")).toBe("$0.99");
    expect(formatCents(4999, "usd")).toBe("$49.99");
    expect(formatCents(10001, "usd")).toBe("$100.01");
    expect(formatCents(99_999_999, "usd")).toBe("$999,999.99"); // the largest single charge
    // the classic float traps: x.xx5 and amounts that are not exact in binary
    for (const cents of [1005, 1015, 2675, 3, 29, 57, 1099, 4_294_967_295]) {
      const text = formatCents(cents, "usd").replace(/[$,]/g, "");
      expect(text.replace(".", "")).toBe(String(cents).padStart(3, "0")); // the digits are the cents, in order
    }
  });

  it("names a currency that is not US dollars, so two dollars are never confused", () => {
    expect(formatCents(4999, "cad")).toBe("$49.99 CAD");
    expect(formatCents(4999, "CAD")).toBe("$49.99 CAD");
    expect(formatCents(1234, "eur")).toBe("12.34 EUR");
  });

  it("shows the wallet-sized amounts the AI panel used to format for itself, identically", () => {
    const cases = {
      0: "$0.00",
      1: "$0.01",
      9: "$0.09",
      100: "$1.00",
      1005: "$10.05",
      123456: "$1,234.56",
      99999999: "$999,999.99",
      [-250]: "-$2.50",
    };
    for (const [cents, text] of Object.entries(cases)) expect(formatCents(Number(cents)), cents).toBe(text);
  });

  it("shows a negative balance with its sign, and nothing at all as zero", () => {
    expect(formatCents(-20, "usd")).toBe("-$0.20");
    expect(formatCents(-1250, "usd")).toBe("-$12.50");
    expect(formatCents(null, "usd")).toBe("$0.00");
    expect(formatCents(undefined)).toBe("$0.00");
  });

  it("refuses to guess at an amount that is not a whole number of cents", () => {
    for (const bad of [49.99, 0.5, NaN, Infinity, "4900", {}, [], Number.MAX_SAFE_INTEGER + 2]) {
      expect(formatCents(bad, "usd")).toBe("–");
    }
  });
});

describe("there is one way to show money from cents", () => {
  // Two functions of this name once existed (here and in the AI usage helpers) and disagreed on bad input; a figure on screen depended on which page it was.
  const sources = import.meta.glob(["../**/*.{js,jsx,ts,tsx}", "!../**/*.test.*", "!../test/**"], {
    query: "?raw",
    import: "default",
    eager: true,
  });

  it("only lib/currency.js defines formatCents", () => {
    const definers = Object.entries(sources)
      .filter(([, text]) => /(export\s+)?(async\s+)?function\s+formatCents\b|(const|let|var)\s+formatCents\s*=/.test(text))
      .map(([file]) => file);
    expect(definers).toEqual(["./currency.js"]);
  });

  it("everything that uses it imports it from there", () => {
    const wrong = Object.entries(sources)
      .filter(([, text]) => /import\s*\{[^}]*\bformatCents\b[^}]*\}\s*from\s*["'][^"']*(?<!currency)["']/.test(text))
      .map(([file]) => file);
    expect(wrong).toEqual([]);
  });
});
