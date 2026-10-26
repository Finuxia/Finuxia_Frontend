import { afterEach, describe, expect, it } from "vitest";
import { writeCachedEvents, readCachedEvents } from "../services/eventCache";
import { allowLocalData, clearLocalData, writeLocal } from "./localData";

afterEach(() => {
  allowLocalData();
  localStorage.clear();
});

describe("the browser cache and logout", () => {
  it("writes while somebody is signed in", () => {
    expect(writeLocal("advisorpilot.test", { a: 1 })).toBe(true);
    expect(JSON.parse(localStorage.getItem("advisorpilot.test"))).toEqual({ a: 1 });
  });

  it("clearing wipes every advisorpilot key and leaves other keys alone", () => {
    localStorage.setItem("advisorpilot.clients.a@b.c", "[]");
    localStorage.setItem("advisorpilot.calendarCache.a@b.c", "{}");
    localStorage.setItem("unrelated", "keep");
    clearLocalData();
    expect(Object.keys(localStorage)).toEqual(["unrelated"]);
  });

  it("clearing also closes the cache: nothing can be written until somebody signs in again", () => {
    clearLocalData();
    expect(writeLocal("advisorpilot.clients.a@b.c", [{ first: "Private" }])).toBe(false);
    expect(localStorage.getItem("advisorpilot.clients.a@b.c")).toBeNull();
    allowLocalData();
    expect(writeLocal("advisorpilot.clients.a@b.c", [])).toBe(true);
  });

  it("the calendar-event cache obeys the same rule", () => {
    clearLocalData();
    writeCachedEvents("a@b.c", [{ title: "Meeting with a client" }]);
    expect(readCachedEvents("a@b.c")).toBeNull();
    expect(Object.keys(localStorage)).toEqual([]);
    allowLocalData();
    writeCachedEvents("a@b.c", [{ title: "Meeting with a client" }]);
    expect(readCachedEvents("a@b.c")?.events).toHaveLength(1);
  });

  it("a storage failure is not an error", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
    try {
      expect(writeLocal("advisorpilot.x", 1)).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it("nothing outside lib/localData.js writes advisorpilot keys straight to local storage", async () => {
    const files = import.meta.glob(["../**/*.{js,jsx}", "!../**/*.test.*", "!../test/**", "!./localData.js"], {
      query: "?raw",
      import: "default",
      eager: true,
    });
    const offenders = Object.entries(files)
      .filter(([, text]) => /localStorage\s*\.\s*setItem\s*\(/.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
