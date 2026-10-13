import { describe, expect, it, vi } from "vitest";
import { useToast } from "./ToastContext";
import Modal from "../components/ui/Modal";
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

  it("is announced by screen readers: a polite live region that exists before any message", async () => {
    renderWithProviders(<Trigger />, { providers: ["router", "toast"] });
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
    await userEvent.click(screen.getByText("plain"));
    expect(region).toHaveTextContent("Plain message");
  });

  it("is still announced while a dialog is open (the dialog does not hide it)", async () => {
    function Both() {
      const { addToast } = useToast();
      return (
        <Modal onClose={() => {}} ariaLabel="A dialog">
          <button onClick={() => addToast("Couldn't save")}>Save</button>
        </Modal>
      );
    }
    renderWithProviders(<Both />, { providers: ["router", "toast"] });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Couldn't save");
    expect(region).not.toHaveAttribute("aria-hidden");
    expect(region.closest("[aria-hidden='true']")).toBeNull();
  });
});
