import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCachedEvents, readCachedEvents, writeCachedEvents } from "./eventCache";

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    removeItem: vi.fn((key) => values.delete(key)),
  };
}

describe("calendar event cache", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads only supported cache records, including the anonymous user's key", () => {
    const local = storage({
      "advisorpilot.calendarCache.advisor@example.com": JSON.stringify({ version: 1, cachedAt: 123, events: [{ id: "e1" }] }),
      "advisorpilot.calendarCache.old@example.com": JSON.stringify({ version: 2, cachedAt: 123, events: [] }),
      "advisorpilot.calendarCache.bad@example.com": JSON.stringify({ version: 1, events: {} }),
      "advisorpilot.calendarCache.corrupt@example.com": "{",
    });
    vi.stubGlobal("localStorage", local);
    expect(readCachedEvents("advisor@example.com")).toEqual({ events: [{ id: "e1" }], cachedAt: 123 });
    expect(readCachedEvents("old@example.com")).toBeNull();
    expect(readCachedEvents("bad@example.com")).toBeNull();
    expect(readCachedEvents("corrupt@example.com")).toBeNull();
    expect(readCachedEvents(undefined)).toBeNull();
    expect(local.getItem).toHaveBeenCalledWith("advisorpilot.calendarCache.anonymous");
  });

  it("writes event data with a timestamp and safely ignores serialization and quota failures", () => {
    const local = storage();
    vi.stubGlobal("localStorage", local);
    vi.spyOn(Date, "now").mockReturnValue(456);
    writeCachedEvents("advisor@example.com", [{ id: "e1" }]);
    expect(JSON.parse(local.values.get("advisorpilot.calendarCache.advisor@example.com"))).toEqual({
      version: 1,
      cachedAt: 456,
      events: [{ id: "e1" }],
    });
    local.setItem.mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
    expect(() => writeCachedEvents("advisor@example.com", [])).not.toThrow();
    const circular = {};
    circular.self = circular;
    expect(() => writeCachedEvents("advisor@example.com", circular)).not.toThrow();
  });

  it("clears a user's key and safely ignores storage failures", () => {
    const local = storage({ "advisorpilot.calendarCache.advisor@example.com": "cached" });
    vi.stubGlobal("localStorage", local);
    clearCachedEvents("advisor@example.com");
    expect(local.removeItem).toHaveBeenCalledWith("advisorpilot.calendarCache.advisor@example.com");
    local.removeItem.mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    expect(() => clearCachedEvents("advisor@example.com")).not.toThrow();
  });
});
