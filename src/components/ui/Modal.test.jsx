import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "../../test/utils";
import Modal, { ModalTitle } from "./Modal";

function Harness({ onClosed, dismissOnBackdrop = true, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <p>page behind</p>
      {open && (
        <Modal
          onClose={() => {
            setOpen(false);
            onClosed?.();
          }}
          dismissOnBackdrop={dismissOnBackdrop}
        >
          <ModalTitle>Edit thing</ModalTitle>
          {children || (
            <>
              <input aria-label="First field" />
              <input aria-label="Second field" />
              <button>Save</button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

const open = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Open dialog" }));
  return screen.getByRole("dialog");
};

describe("Modal", () => {
  it("is a modal dialog named by its title", async () => {
    render(<Harness />);
    const dialog = await open();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Edit thing");
  });

  it("can be named by aria-label when it has no visible title", () => {
    render(
      <Modal onClose={() => {}} ariaLabel="Confirm deletion">
        <button>OK</button>
      </Modal>
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Confirm deletion");
  });

  describe("focus", () => {
    it("moves into the dialog on open (first control), and back to the trigger on close", async () => {
      render(<Harness />);
      const trigger = screen.getByRole("button", { name: "Open dialog" });
      await userEvent.click(trigger);
      expect(screen.getByLabelText("First field")).toHaveFocus();
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(trigger).toHaveFocus();
    });

    it("leaves a field that asked for focus (autoFocus) where it is", async () => {
      render(
        <Harness>
          <input aria-label="One" />
          <input aria-label="Two" autoFocus />
        </Harness>
      );
      await open();
      expect(screen.getByLabelText("Two")).toHaveFocus();
    });

    it("keeps Tab inside the dialog, wrapping at both ends", async () => {
      render(<Harness />);
      await open();
      const first = screen.getByLabelText("First field");
      const save = screen.getByRole("button", { name: "Save" });
      await userEvent.tab();
      await userEvent.tab();
      expect(save).toHaveFocus();
      await userEvent.tab();
      expect(first).toHaveFocus(); // wrapped to the start, not out to the page
      await userEvent.tab({ shift: true });
      expect(save).toHaveFocus(); // and back to the end
    });

    it("a dialog with nothing to focus holds focus on itself", async () => {
      render(
        <Harness>
          <p>Just text</p>
        </Harness>
      );
      const dialog = await open();
      expect(dialog).toHaveFocus();
      await userEvent.tab();
      expect(dialog).toHaveFocus();
    });
  });

  describe("closing", () => {
    it("Escape closes it", async () => {
      const onClosed = vi.fn();
      render(<Harness onClosed={onClosed} />);
      await open();
      await userEvent.keyboard("{Escape}");
      expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it("only the topmost of two stacked dialogs closes on Escape", async () => {
      const outer = vi.fn();
      const inner = vi.fn();
      render(
        <>
          <Modal onClose={outer} ariaLabel="Outer">
            <button>outer button</button>
          </Modal>
          <Modal onClose={inner} ariaLabel="Inner">
            <button>inner button</button>
          </Modal>
        </>
      );
      await userEvent.keyboard("{Escape}");
      expect([inner.mock.calls.length, outer.mock.calls.length]).toEqual([1, 0]);
    });

    it("a click on the dark area closes it; a click inside does not", async () => {
      const onClosed = vi.fn();
      render(<Harness onClosed={onClosed} />);
      const dialog = await open();
      await userEvent.click(screen.getByLabelText("First field"));
      expect(onClosed).not.toHaveBeenCalled();
      await userEvent.click(dialog.parentElement); // the overlay
      expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it("a drag that starts inside and ends on the dark area does not close it", async () => {
      const onClosed = vi.fn();
      render(<Harness onClosed={onClosed} />);
      const dialog = await open();
      const overlay = dialog.parentElement;
      await userEvent.pointer([
        { keys: "[MouseLeft>]", target: screen.getByLabelText("First field") },
        { target: overlay },
        { keys: "[/MouseLeft]" },
      ]);
      expect(onClosed).not.toHaveBeenCalled();
    });

    it("a dialog that needs an answer ignores the backdrop but still closes on Escape", async () => {
      const onClosed = vi.fn();
      render(<Harness onClosed={onClosed} dismissOnBackdrop={false} />);
      const dialog = await open();
      await userEvent.click(dialog.parentElement);
      expect(onClosed).not.toHaveBeenCalled();
      await userEvent.keyboard("{Escape}");
      expect(onClosed).toHaveBeenCalledTimes(1);
    });
  });

  describe("the page behind", () => {
    it("does not scroll while a dialog is open, and scrolls again after", async () => {
      document.body.style.overflow = "";
      render(<Harness />);
      await open();
      expect(document.body.style.overflow).toBe("hidden");
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(document.body.style.overflow).toBe(""));
    });

    it("restores whatever overflow the page had, even with two dialogs stacked", () => {
      document.body.style.overflow = "scroll";
      const a = render(
        <Modal onClose={() => {}} ariaLabel="A">
          <button>a</button>
        </Modal>
      );
      const b = render(
        <Modal onClose={() => {}} ariaLabel="B">
          <button>b</button>
        </Modal>
      );
      expect(document.body.style.overflow).toBe("hidden");
      b.unmount();
      expect(document.body.style.overflow).toBe("hidden"); // still one open
      a.unmount();
      expect(document.body.style.overflow).toBe("scroll");
      document.body.style.overflow = "";
    });

    it("is hidden from screen readers while open, and visible again after", async () => {
      const { container } = render(<Harness />);
      const root = container; // the app root: a child of body
      await open();
      expect(root).toHaveAttribute("aria-hidden", "true");
      expect(screen.getByRole("dialog")).toBeVisible();
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(root).not.toHaveAttribute("aria-hidden"));
    });

    it("leaves a live region alone, so a message can still be announced over a dialog", async () => {
      const live = document.createElement("div");
      live.setAttribute("data-keep-visible", "");
      document.body.appendChild(live);
      render(<Harness />);
      await open();
      expect(live).not.toHaveAttribute("aria-hidden");
      live.remove();
    });
  });
});
