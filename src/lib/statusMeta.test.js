import { describe, expect, it } from "vitest";
import {
  BOOKING_REQUEST_STATUS,
  DOCUMENT_STATUS,
  TICKET_STATUS,
  TICKET_TYPE,
  getBookingRequestStatusMeta,
  getDocumentStatusMeta,
  getTicketStatusMeta,
  getTicketTypeMeta,
  toneClasses,
} from "./statusMeta";

describe("statusMeta", () => {
  it("every status has a label and a tone the colour module knows", () => {
    for (const table of [TICKET_STATUS, TICKET_TYPE, DOCUMENT_STATUS, BOOKING_REQUEST_STATUS]) {
      for (const [key, meta] of Object.entries(table)) {
        expect(meta.label, key).toBeTruthy();
        expect(toneClasses(meta.tone).badge, `${key}: ${meta.tone}`).toMatch(/^bg-/);
      }
    }
  });

  it("the same meaning is the same colour on every screen: bad is red, good is green, waiting is amber", () => {
    expect(getTicketTypeMeta("bug").tone).toBe("red");
    expect(getDocumentStatusMeta("rejected").tone).toBe("red");
    expect(getDocumentStatusMeta("approved").tone).toBe("green");
    expect(getBookingRequestStatusMeta("confirmed").tone).toBe("green");
    expect(getDocumentStatusMeta("pending").tone).toBe("amber");
    expect(getBookingRequestStatusMeta("pending").tone).toBe("amber");
  });

  it("an unknown status reads as the starting state, not as an error", () => {
    expect(getTicketStatusMeta("???").label).toBe("Open");
    expect(getTicketTypeMeta(undefined).label).toBe("Bug");
    expect(getDocumentStatusMeta(null).label).toBe("Pending review");
    expect(getBookingRequestStatusMeta("").label).toBe("Pending");
  });

  it("an unknown tone reads as slate", () => {
    expect(toneClasses("nope")).toEqual(toneClasses("slate"));
  });

  it("tickets keep the colours they always had", () => {
    expect(toneClasses(getTicketStatusMeta("in_progress").tone).badge).toBe("bg-av-amber/10 text-av-amber");
    expect(toneClasses(getTicketStatusMeta("closed").tone).badge).toBe("bg-slate-100 text-slate-500");
    expect(toneClasses(getTicketStatusMeta("open").tone).dot).toBe("bg-av-blue");
  });
});
