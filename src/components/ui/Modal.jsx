import { createContext, useContext, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * The one dialog primitive. Every modal in the app is a <Modal>, so the accessibility behaviour exists once:
 *
 *   - role="dialog" and aria-modal="true", named by its title (<ModalTitle>) or by `ariaLabel`
 *   - focus moves into the dialog when it opens (to the first field marked autofocus, else the first focusable
 *     element, else the dialog itself), Tab / Shift+Tab stay inside it, and focus goes back to whatever opened it
 *     when it closes
 *   - Escape closes it (only the topmost, when dialogs are stacked)
 *   - the page behind it does not scroll, and is hidden from screen readers while it is open
 *
 *   <Modal onClose={close} variant="sheet" panelClassName="max-w-lg">
 *     <ModalTitle className="text-lg font-semibold">Add client</ModalTitle>
 *     ...
 *   </Modal>
 *
 * `variant`: "center" (a card in the middle), "sheet" (rises from the bottom on a phone, a card from sm up) or "drawer"
 * (a full-height panel on the right).
 * `dismissOnBackdrop`: a click on the dark area closes it (default); pass false for dialogs that need an answer.
 * `panelClassName`: the panel's own size and shape (width, max height, rounding); the white card, shadow and animation are here.
 * `zIndex`: a Tailwind z-index class (a higher one for a dialog that may appear over another).
 */
const TitleContext = createContext(null);

export function ModalTitle({ as: Tag = "h2", children, ...props }) {
  const id = useContext(TitleContext);
  return (
    <Tag id={id} {...props}>
      {children}
    </Tag>
  );
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const focusableIn = (root) =>
  [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true");

// Dialogs currently open, oldest first: only the last one reacts to Escape.
const stack = [];
let scrollLocks = 0;
let savedOverflow = "";

function lockScroll() {
  if (scrollLocks++ === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
}
function unlockScroll() {
  if (--scrollLocks === 0) document.body.style.overflow = savedOverflow;
}

export default function Modal({
  onClose,
  children,
  variant = "center",
  panelClassName = "max-w-md rounded-2xl",
  zIndex = "z-50",
  dismissOnBackdrop = true,
  ariaLabel,
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pressedOnBackdrop = useRef(false);
  // Whatever had focus when the dialog was first rendered: it gets focus back on close. (Read during render, before React's
  // autoFocus on a field moves it.)
  const openerRef = useRef(null);
  if (openerRef.current === null) openerRef.current = document.activeElement;

  useEffect(() => {
    const panel = panelRef.current;
    const opener = openerRef.current;
    const token = {};
    stack.push(token);
    lockScroll();

    // Hide everything else from assistive technology while the dialog is open.
    const hidden = [];
    for (const el of document.body.children) {
      if (el.contains(panel) || el.hasAttribute("aria-hidden") || el.hasAttribute("data-keep-visible")) continue;
      el.setAttribute("aria-hidden", "true");
      hidden.push(el);
    }

    // A field that asked for focus (React's autoFocus) already has it; otherwise the first control, else the dialog itself.
    if (!panel.contains(document.activeElement)) (panel.querySelector("[data-autofocus]") || focusableIn(panel)[0] || panel).focus();

    const onKeyDown = (e) => {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusableIn(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === firstEl || document.activeElement === panel)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      } else if (!panel.contains(document.activeElement)) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      stack.splice(stack.indexOf(token), 1);
      unlockScroll();
      hidden.forEach((el) => el.removeAttribute("aria-hidden"));
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
    };
  }, []);

  const placement =
    {
      sheet: "justify-center items-end p-0 sm:items-center sm:p-4",
      drawer: "justify-end items-stretch p-0",
      center: "justify-center items-center p-4",
    }[variant] || "justify-center items-center p-4";

  return createPortal(
    <TitleContext.Provider value={titleId}>
      {/* The overlay closes on a click that both starts and ends on the dark area (not on a drag out of a text field).
          role="presentation" states what this element is: a visual overlay, not a control. Without it jsx-a11y reports
          the click handler as an interactive element with no keyboard support. The keyboard route is the Escape
          handler in the effect above, and focus is moved into the dialog on open, so the behaviour is covered. */}
      <div
        role="presentation"
        className={`fixed inset-0 ${zIndex} flex bg-navy/50 backdrop-blur-sm animate-fade-in ${placement}`}
        onMouseDown={(e) => {
          pressedOnBackdrop.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (dismissOnBackdrop && pressedOnBackdrop.current && e.target === e.currentTarget) onClose?.();
          pressedOnBackdrop.current = false;
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabel ? undefined : titleId}
          aria-label={ariaLabel}
          tabIndex={-1}
          className={`w-full bg-white shadow-2xl outline-none animate-slide-up ${panelClassName}`}
        >
          {children}
        </div>
      </div>
    </TitleContext.Provider>,
    document.body
  );
}
