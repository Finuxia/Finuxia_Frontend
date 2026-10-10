import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BOOKING_STATUS,
  DOCUMENT_STATUS,
  DOTS,
  PAYMENT_STATUS,
  paymentStatusMeta,
  TICKET_STATUS,
  TICKET_TYPE,
  TONES,
  bookingStatusMeta,
  documentStatusMeta,
  ticketStatusMeta,
  ticketTypeMeta,
} from "./statusMeta";

describe("status styling lives in one module", () => {
  it.each([
    ["booking", BOOKING_STATUS],
    ["document", DOCUMENT_STATUS],
    ["ticket status", TICKET_STATUS],
    ["ticket type", TICKET_TYPE],
  ])("every %s status has a label, a known tone and the badge / dot classes of that tone", (_name, map) => {
    for (const [key, meta] of Object.entries(map)) {
      expect(meta.label, key).toEqual(expect.any(String));
      expect(TONES[meta.tone], key).toBeTruthy();
      expect(meta.badge, key).toBe(TONES[meta.tone]);
      expect(meta.dot, key).toBe(DOTS[meta.tone]);
    }
  });

  it("keeps the colours the pages had before", () => {
    expect(bookingStatusMeta("pending")).toMatchObject({ label: "Pending", badge: "bg-av-amber/10 text-av-amber" });
    expect(bookingStatusMeta("confirmed")).toMatchObject({ label: "Confirmed", badge: "bg-av-green/10 text-av-green" });
    expect(bookingStatusMeta("cancelled")).toMatchObject({ label: "Cancelled", badge: "bg-slate-100 text-slate-500" });
    expect(documentStatusMeta("pending")).toMatchObject({ label: "Pending review", badge: "bg-av-amber/10 text-av-amber" });
    expect(documentStatusMeta("approved").tone).toBe("green");
    expect(documentStatusMeta("rejected").tone).toBe("red");
    expect(ticketStatusMeta("in_progress")).toMatchObject({ label: "In Progress", dot: "bg-av-amber" });
    expect(ticketTypeMeta("feature")).toMatchObject({ label: "Feature", badge: "bg-av-purple/10 text-av-purple" });
  });

  it("an unknown status falls back to the default one rather than breaking the page", () => {
    expect(bookingStatusMeta("???")).toBe(BOOKING_STATUS.pending);
    expect(documentStatusMeta(undefined)).toBe(DOCUMENT_STATUS.pending);
    expect(ticketStatusMeta("???")).toBe(TICKET_STATUS.open);
    expect(ticketTypeMeta(null)).toBe(TICKET_TYPE.bug);
  });

  it("the document statuses carry an icon for the badge", () => {
    for (const meta of Object.values(DOCUMENT_STATUS)) expect(meta.icon).toBeTruthy();
  });

  it("no page defines its own status-style map any more", () => {
    for (const file of readdirSync("src/pages").filter((f) => f.endsWith(".jsx"))) {
      const code = readFileSync(`src/pages/${file}`, "utf8");
      expect(code, file).not.toMatch(/const STATUS_META\s*=/);
      expect(code, file).not.toMatch(/bg-av-\w+\/10 text-av-\w+.*Pending/);
    }
  });
});

describe("payment statuses", () => {
  it("each known status has a label and a tone", () => {
    expect(Object.keys(PAYMENT_STATUS).sort()).toEqual(["expired", "failed", "pending", "refunded", "succeeded"]);
    expect(paymentStatusMeta("succeeded")).toMatchObject({ label: "Paid", tone: "green" });
    expect(paymentStatusMeta("pending")).toMatchObject({ label: "Waiting for payment", tone: "amber" });
    expect(paymentStatusMeta("failed")).toMatchObject({ label: "Failed", tone: "red" });
  });

  it("a status added later shows its own word, neutral", () => {
    expect(paymentStatusMeta("scheduled")).toMatchObject({ label: "Scheduled", tone: "slate" });
    expect(paymentStatusMeta("")).toMatchObject({ label: "Unknown", tone: "slate" });
    expect(paymentStatusMeta(undefined)).toMatchObject({ label: "Unknown", tone: "slate" });
  });
});
