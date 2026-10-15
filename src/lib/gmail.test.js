import { afterEach, describe, expect, it, vi } from "vitest";
import { feedbackEmailDraft, openGmailCompose } from "./gmail";

describe("Gmail compose helpers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens a prefilled compose window without sending the message", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    openGmailCompose({ to: "ada@example.com", subject: "Review", body: "Hello" });
    const [url, target, features] = open.mock.calls[0];
    expect(url).toContain("to=ada%40example.com");
    expect(url).toContain("su=Review");
    expect(url).toContain("body=Hello");
    expect([target, features]).toEqual(["_blank", "noopener,noreferrer"]);
  });

  it("uses empty defaults in compose and drafts feedback for a named or unnamed client", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    openGmailCompose({});
    expect(open.mock.calls[0][0]).toContain("to=&su=&body=");
    expect(feedbackEmailDraft({ first: "Ada", email: "ada@example.com" }, { meetingLabel: "Plan review" })).toMatchObject({
      to: "ada@example.com",
      subject: "Quick feedback on our meeting — Plan review",
      body: expect.stringContaining("Hi Ada,"),
    });
    expect(feedbackEmailDraft({ email: "client@example.com" }).body).toContain("Hi there,");
  });
});
