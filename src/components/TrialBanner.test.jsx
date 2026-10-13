import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../test/utils";
import TrialBanner, { daysUntil } from "./TrialBanner";

// n calendar days from today, at local midnight: the banner counts whole days from the start of today
const inDays = (n) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + n).toISOString();
};
const show = (user, billing) => renderWithProviders(<TrialBanner user={user} billing={billing} />, { providers: ["router"] });

describe("daysUntil", () => {
  it("is null for no date or a date that is not one", () => {
    for (const junk of [null, undefined, "", "not a date"]) expect(daysUntil(junk), String(junk)).toBeNull();
  });
  it("counts whole days from the start of today", () => {
    expect(daysUntil(inDays(3))).toBe(3);
    expect(daysUntil(inDays(0))).toBe(0);
    expect(daysUntil(inDays(-2))).toBe(-2);
  });

  it("counts a part day as a day", () => {
    const now = new Date();
    expect(daysUntil(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 12).toISOString())).toBe(4);
  });
});

describe("the trial banner", () => {
  it("counts down in the last week, in the singular on the last day, and links to Subscribe", () => {
    show({ subscriptionUntil: inDays(5) });
    expect(screen.getByTestId("trial-banner")).toHaveTextContent("Your free trial ends in 5 days.");
    expect(screen.getByRole("link", { name: "Subscribe" })).toHaveAttribute("href", "/subscribe");
  });

  it("says 1 day, and says 'today' on the day", () => {
    const { unmount } = show({ subscriptionUntil: inDays(1) });
    expect(screen.getByTestId("trial-banner")).toHaveTextContent("Your free trial ends in 1 day.");
    unmount();
    show({ subscriptionUntil: inDays(0) });
    expect(screen.getByTestId("trial-banner")).toHaveTextContent("Your free trial ends today.");
  });

  it("is not shown earlier than a week out, or with no end date", () => {
    const { unmount } = show({ subscriptionUntil: inDays(20) });
    expect(screen.queryByTestId("trial-banner")).not.toBeInTheDocument();
    unmount();
    show({ subscriptionUntil: null });
    expect(screen.queryByTestId("trial-banner")).not.toBeInTheDocument();
  });

  it("stops once they have said they do not intend to continue", () => {
    show({ subscriptionUntil: inDays(2) }, { notContinuingSince: "2026-10-01T10:00:00Z" });
    expect(screen.queryByTestId("trial-banner")).not.toBeInTheDocument();
  });

  it("goes on for anyone who has not", () => {
    show({ subscriptionUntil: inDays(2) }, { notContinuingSince: null });
    expect(screen.getByTestId("trial-banner")).toBeInTheDocument();
  });
});
