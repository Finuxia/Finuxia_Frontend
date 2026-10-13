import { describe, expect, it } from "vitest";
import { formatBytes } from "./bytes";

describe("formatBytes", () => {
  it("reads a cap back as the round number it was set as", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatBytes(7 * 1024 * 1024)).toBe("7 MB");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2 GB");
  });

  it("keeps one decimal for a size that is not whole, and no more", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024 * 2.25)).toBe("2.3 MB");
  });

  it("says bytes below a kilobyte, so a small number is not shown as 0 KB", () => {
    expect(formatBytes(0)).toBe("0 bytes");
    expect(formatBytes(1)).toBe("1 bytes");
    expect(formatBytes(1023)).toBe("1023 bytes");
  });

  it("groups a large figure", () => {
    expect(formatBytes(1024 ** 5 * 2000)).toBe("2,000 PB"); // stops at the largest unit rather than inventing one
  });

  it("refuses to guess at something that is not a size", () => {
    for (const bad of [null, undefined, NaN, Infinity, -1, "4096"]) {
      expect(formatBytes(bad), String(bad)).toBe("–");
    }
  });
});
