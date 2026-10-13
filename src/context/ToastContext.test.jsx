import { describe, expect, it, vi } from "vitest";
import { useToast } from "./ToastContext";
import { renderWithProviders, screen, userEvent } from "../test/utils";

function Trigger({ onAction }) {
  const { addToast } = useToast();
  return (
    <>
      <button onClick={() => addToast("Plain message")}>plain</button>
      <button onClick={() => addToast("Changed elsewhere", { action: { label: "Refresh", onClick: onAction } })}>with action</button>
    </>
  );
}

describe("toasts", () => {
  it("shows a message", async () => {
    renderWithProviders(<Trigger />, { providers: ["router", "toast"] });
    await userEvent.click(screen.getByText("plain"));
    expect(screen.getByText("Plain message")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
  });

  it("can carry an action: clicking it runs it and closes the toast", async () => {
    const onAction = vi.fn();
    renderWithProviders(<Trigger onAction={onAction} />, { providers: ["router", "toast"] });
    await userEvent.click(screen.getByText("with action"));
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Changed elsewhere")).not.toBeInTheDocument();
  });
});
