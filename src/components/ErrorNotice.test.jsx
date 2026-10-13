import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api";
import { messageForStatus } from "../lib/apiErrors";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import ErrorNotice from "./ErrorNotice";

const err = (status, { message, ...rest } = {}) =>
  new ApiError(message ?? messageForStatus(status, "", { retryAfter: rest.retryAfter, path: rest.path || "" }), { status, ...rest });

const render = (ui) => renderWithProviders(ui, { providers: ["router"] });

describe("ErrorNotice", () => {
  it("renders nothing without an error", () => {
    const { container } = render(<ErrorNotice error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe("rate limited", () => {
    it("says how long to wait, counts down, and enables the retry when the wait is over", async () => {
      const onRetry = vi.fn();
      render(<ErrorNotice error={err(429, { retryAfter: 2, path: "/api/clients" })} onRetry={onRetry} />);
      expect(screen.getByRole("alert")).toHaveTextContent("Too many requests. Try again in 2 seconds.");
      const retry = screen.getByRole("button", { name: "Try again" });
      expect(retry).toBeDisabled();
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Try again in 1 second."), { timeout: 2500 });
      await waitFor(() => expect(retry).toBeEnabled(), { timeout: 3000 });
      await userEvent.click(retry);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("keeps a custom server sentence instead of rewriting it", () => {
      render(<ErrorNotice error={err(429, { retryAfter: 60, message: "You've used too many AI requests this hour." })} />);
      expect(screen.getByRole("alert")).toHaveTextContent("You've used too many AI requests this hour.");
    });
  });

  it("a sign-in lockout reads as a lockout with its wait", () => {
    render(<ErrorNotice error={err(429, { retryAfter: 600, path: "/api/auth/login" })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Too many attempts. Try again in 10 minutes.");
  });

  describe("out of credit", () => {
    const quota = () =>
      new ApiError("Your AI wallet balance is too low for this. Top up in Profile.", {
        status: 402,
        data: { code: "ai_credit_exhausted", actions: ["top_up", "upgrade"] },
      });

    it("is an inline state with the server's sentence and an Add credit action, not a toast", () => {
      render(<ErrorNotice error={quota()} />);
      expect(screen.getByRole("alert")).toHaveTextContent("Your AI wallet balance is too low for this. Top up in Profile.");
      expect(screen.getByRole("link", { name: "Add credit" })).toHaveAttribute("href", "/profile?tab=ai-usage");
      expect(screen.getByRole("link", { name: "See plans" })).toHaveAttribute("href", "/billing");
    });

    it("offers only what the server offers", () => {
      render(<ErrorNotice error={new ApiError("Out of credit", { status: 402, data: { actions: [] } })} />);
      expect(screen.getByRole("link", { name: "Add credit" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "See plans" })).not.toBeInTheDocument();
    });
  });

  it("a plan-gate refusal shows the existing upgrade prompt", () => {
    render(
      <ErrorNotice
        error={
          new ApiError("Your current plan doesn't include this feature (documents).", { status: 403, data: { code: "ai_not_in_plan" } })
        }
      />
    );
    expect(screen.getByText("Your current plan doesn't include this feature (documents).")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Plans" })).toHaveAttribute("href", "/billing");
  });

  it("a conflict says the record changed elsewhere and offers Refresh", async () => {
    const onRefresh = vi.fn();
    render(<ErrorNotice error={err(409)} onRefresh={onRefresh} />);
    expect(screen.getByRole("alert")).toHaveTextContent("This record changed elsewhere.");
    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("an ended trial points at subscribing", () => {
    render(<ErrorNotice error={new ApiError("Your free trial has ended. Contact us to keep using Finuxia.", { status: 403 })} />);
    expect(screen.getByRole("link", { name: "Subscribe" })).toHaveAttribute("href", "/subscribe");
  });

  it("a network failure offers a retry, and any other error shows the server's message", async () => {
    const onRetry = vi.fn();
    const { unmount } = render(
      <ErrorNotice error={new ApiError("Can't reach the server. Is the backend running?", { status: 0 })} onRetry={onRetry} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
    unmount();
    render(<ErrorNotice error={new ApiError("The report service is down", { status: 500 })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The report service is down");
  });

  it("can be dismissed", async () => {
    const onDismiss = vi.fn();
    render(<ErrorNotice error={err(500)} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
