import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../test/utils";
import AiUsageInline from "./AiUsageInline";

// `mode: "allowance"` is load-bearing: warningMessage says nothing for an account with no allowance
// to run out of (unlimited, or paying per call), so the notice would render nothing at all.
const usage = (over) => ({
  mode: "allowance",
  blocked: null,
  warning: "warning",
  percentUsed: 82,
  period: { end: "2026-11-30T00:00:00Z" },
  credits: { included: 1000, extra: 0, total: 1000, used: 820, inFlight: 0, remaining: 180 },
  wallet: { balanceCents: 1250 },
  ...over,
});

const show = (over) => renderWithProviders(<AiUsageInline usage={usage(over)} />, { providers: ["router"] });

/**
 * The notice's own behaviour. The pages that show it (the AI usage panel, the document suggestion and the
 * letter step) assert which message appears; this is the one place that pins how it is announced, so the
 * guarantee does not rest on it happening to be the only status region in the document.
 */
describe("the inline AI allowance notice", () => {
  it("is a polite live region, so the warning is announced without taking focus", () => {
    show();
    const notice = screen.getByTestId("ai-usage-warning");
    expect(notice).toHaveAttribute("role", "status");
    expect(notice).toHaveTextContent(/82%/);
    // Named by its own text, not by a label that would replace it.
    expect(notice).not.toHaveAttribute("aria-label");
  });

  it("offers the way to see the detail", () => {
    show();
    expect(screen.getByRole("link", { name: "See your AI usage" })).toHaveAttribute("href", "/profile?tab=ai-usage");
  });

  it("says nothing at all below 80%: no empty region left in the page", () => {
    show({ warning: null, percentUsed: 10 });
    expect(screen.queryByTestId("ai-usage-warning")).not.toBeInTheDocument();
  });

  it("is urgent once the allowance is nearly gone", () => {
    show({ warning: "critical", percentUsed: 96 });
    expect(screen.getByTestId("ai-usage-warning").className).toContain("av-red");
  });
});
