import { describe, expect, it } from "vitest";
import { annotateEventsWithClients, guessClientNameFromEvent, matchClientForEvent } from "./meetingClients";

const clients = [
  { id: 1, first: "Mary", last: "Smith" },
  { id: "2", first: "Mary Anne", last: "Smith" },
  { id: 3, first: "Ada", last: "Lovelace" },
];

describe("linking calendar events to clients", () => {
  it("uses an exact private client tag before falling back to the longest matching name", () => {
    expect(matchClientForEvent({ extendedProperties: { private: { advisorpilotClientId: "3" } }, summary: "Mary Smith" }, clients)).toBe(
      clients[2]
    );
    expect(
      matchClientForEvent(
        { extendedProperties: { private: { advisorpilotClientId: 99 } }, summary: "Meeting with Mary Anne Smith" },
        clients
      )
    ).toBe(clients[1]);
    expect(matchClientForEvent({ summary: "  MEETING   WITH ADA LOVELACE  " }, clients)).toBe(clients[2]);
  });

  it("leaves unmatched or empty events unlinked", () => {
    expect(matchClientForEvent({}, clients)).toBeNull();
    expect(matchClientForEvent({ summary: "  " }, clients)).toBeNull();
    expect(matchClientForEvent({ summary: "Mary" }, clients)).toBeNull();
    expect(matchClientForEvent({ summary: "Personal appointment" }, clients)).toBeNull();
  });

  it("guesses names from common event titles and tolerates missing names", () => {
    expect(guessClientNameFromEvent(undefined)).toBeNull();
    expect(guessClientNameFromEvent({ summary: "   " })).toBeNull();
    expect(guessClientNameFromEvent({ summary: "FC1 — Jane Doe" })).toEqual({ first: "Jane", last: "Doe" });
    expect(guessClientNameFromEvent({ summary: "Meeting with Grace Hopper" })).toEqual({ first: "Grace", last: "Hopper" });
    expect(guessClientNameFromEvent({ summary: "Call Jane" })).toEqual({ first: "Jane", last: "" });
    expect(guessClientNameFromEvent({ summary: "—" })).toEqual({ first: "—", last: "" });
  });

  it("annotates each event with a match or null", () => {
    expect(annotateEventsWithClients([{ summary: "Strategy — Ada Lovelace" }, { summary: "Private" }], clients)).toEqual([
      { event: { summary: "Strategy — Ada Lovelace" }, client: clients[2] },
      { event: { summary: "Private" }, client: null },
    ]);
  });
});
