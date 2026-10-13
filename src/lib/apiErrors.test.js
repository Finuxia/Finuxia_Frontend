import { describe, expect, it } from "vitest";
import { describeError, formatWait, messageForStatus, parseRetryAfter } from "./apiErrors";

describe("parseRetryAfter", () => {
  it.each([
    ["30", 30],
    [" 7 ", 7],
    [0, 0],
    ["0", 0],
    [null, null],
    [undefined, null],
    ["", null],
    ["soon", null],
    ["99999999", 86400], // capped at a day
  ])("%j -> %j", (value, expected) => {
    expect(parseRetryAfter(value)).toBe(expected);
  });

  it("reads an HTTP date relative to now, rounding up, never negative", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(parseRetryAfter("Thu, 01 Jan 2026 00:01:30 GMT", now)).toBe(90);
    expect(parseRetryAfter("Wed, 31 Dec 2025 23:00:00 GMT", now)).toBe(0);
  });
});

describe("formatWait", () => {
  it.each([
    [1, "1 second"],
    [45, "45 seconds"],
    [59, "59 seconds"],
    [59.2, "1 minute"],
    [60, "1 minute"],
    [61, "2 minutes"], // rounded UP: never tell someone to retry too early
    [300, "5 minutes"],
    [3600, "1 hour"],
    [3601, "2 hours"],
    [0, "1 second"],
  ])("%s s -> %s", (seconds, expected) => {
    expect(formatWait(seconds)).toBe(expected);
  });
});

describe("messageForStatus", () => {
  it("prefers the server's own sentence", () => {
    expect(messageForStatus(402, "Your AI wallet balance is too low for this. Top up in Profile.")).toBe(
      "Your AI wallet balance is too low for this. Top up in Profile."
    );
    expect(messageForStatus(500, "The report service is down")).toBe("The report service is down");
  });

  it("falls back to a sensible sentence per status when the server sent none, never 'Request failed (N)'", () => {
    expect(messageForStatus(401, "")).toBe("Please sign in again.");
    expect(messageForStatus(402, undefined)).toMatch(/credit or a plan/);
    expect(messageForStatus(403, null)).toMatch(/don't have access/);
    expect(messageForStatus(404, "  ")).toMatch(/couldn't find/);
    expect(messageForStatus(409, "")).toMatch(/changed elsewhere/);
    expect(messageForStatus(503, "")).toMatch(/our side/);
    expect(messageForStatus(418, "")).toBe("Something went wrong (418).");
  });

  describe("429", () => {
    it("says how long to wait, from Retry-After", () => {
      expect(messageForStatus(429, "", { retryAfter: 30 })).toBe("Too many requests. Try again in 30 seconds.");
      expect(messageForStatus(429, "", { retryAfter: 125 })).toBe("Too many requests. Try again in 3 minutes.");
    });

    it("replaces the framework's default throttle text with the structured wait", () => {
      expect(messageForStatus(429, "Request was throttled. Expected available in 25 seconds.", { retryAfter: 25 })).toBe(
        "Too many requests. Try again in 25 seconds."
      );
    });

    it("keeps a custom server sentence for a 429", () => {
      expect(messageForStatus(429, "You've used too many AI requests this hour.", { retryAfter: 60 })).toBe(
        "You've used too many AI requests this hour."
      );
    });

    it("has a fallback with no Retry-After", () => {
      expect(messageForStatus(429, "")).toBe("Too many requests. Please wait a moment and try again.");
    });

    it("uses lockout wording for sign-in endpoints", () => {
      expect(messageForStatus(429, "", { retryAfter: 600, path: "/api/auth/login" })).toBe("Too many attempts. Try again in 10 minutes.");
      expect(messageForStatus(429, "", { path: "/api/auth/forgot-password" })).toMatch(/^Too many attempts\./);
    });
  });
});

describe("describeError", () => {
  const err = (status, over = {}) => ({ status, message: over.message ?? messageForStatus(status, ""), ...over });

  it.each([
    [err(0), "network"],
    [err(429, { retryAfter: 20, path: "/api/clients" }), "rate_limited"],
    [err(429, { retryAfter: 600, path: "/api/auth/login" }), "login_locked"],
    [err(402, { message: "Out of credit" }), "quota"],
    [err(403, { code: "ai_credit_exhausted" }), "quota"],
    [err(403, { code: "ai_not_in_plan", message: "Not in plan" }), "plan_gate"],
    [err(403, { message: "Your current plan doesn't include this feature (documents)." }), "plan_gate"],
    [err(403, { message: "Your free trial has ended. Contact us to keep using Finuxia." }), "trial_ended"],
    [err(403, { message: "Nope" }), "other"],
    [err(409, { message: "Changed" }), "conflict"],
    [err(500), "other"],
  ])("%j -> %s", (error, kind) => {
    expect(describeError(error).kind).toBe(kind);
  });

  it("carries the message and the wait", () => {
    expect(describeError(err(429, { retryAfter: 42, message: "Too many requests. Try again in 42 seconds." }))).toEqual({
      kind: "rate_limited",
      message: "Too many requests. Try again in 42 seconds.",
      retryAfter: 42,
    });
  });

  it("reads the code from the response body when the error has none of its own", () => {
    expect(describeError({ status: 402, message: "x", data: { code: "ai_credit_exhausted" } }).kind).toBe("quota");
    expect(describeError({ status: 403, message: "x", data: { code: "ai_not_in_plan" } }).kind).toBe("plan_gate");
  });

  it("survives nothing at all", () => {
    expect(describeError(undefined).kind).toBe("network");
    expect(describeError(null).message).toEqual(expect.any(String));
  });
});
