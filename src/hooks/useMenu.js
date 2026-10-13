import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * The standard menu-button pattern for a dropdown whose items are links or buttons.
 *
 *   const menu = useMenu({ align: "left" });
 *   <button {...menu.triggerProps}>Clients</button>
 *   {menu.open && createPortal(<div {...menu.menuProps} aria-label="Clients"> <a {...menu.itemProps}>..</a> </div>, document.body)}
 *
 * Trigger: aria-haspopup / aria-expanded / aria-controls; Enter, Space and ArrowDown open it with the first item focused,
 * ArrowUp opens it on the last. Menu: ArrowDown / ArrowUp move (wrapping), Home / End jump, Escape closes and puts focus
 * back on the trigger, Tab closes. It still closes on an outside click, on scroll and on resize, as before.
 */
export default function useMenu({ align = "left" } = {}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const focusOnOpen = useRef("first");
  const menuId = useId();

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const openMenu = useCallback(
    (which = "first") => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setPos(align === "right" ? { top: r.bottom + 6, right: window.innerWidth - r.right } : { top: r.bottom + 6, left: r.left });
      focusOnOpen.current = which;
      setOpen(true);
    },
    [align]
  );

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onScrollOrResize = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open]);

  // Once the menu is in the page, move focus to the first (or last) item.
  useEffect(() => {
    if (!open) return;
    const items = menuRef.current ? [...menuRef.current.querySelectorAll('[role="menuitem"]')] : [];
    (focusOnOpen.current === "last" ? items[items.length - 1] : items[0])?.focus();
  }, [open, pos]);

  const triggerProps = {
    ref: triggerRef,
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "aria-controls": open ? menuId : undefined,
    onClick: () => (open ? close() : openMenu("first")),
    onKeyDown: (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        openMenu("first");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        openMenu("last");
      }
    },
  };

  const menuProps = {
    ref: menuRef,
    id: menuId,
    role: "menu",
    onKeyDown: (e) => {
      const items = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
      const at = items.indexOf(document.activeElement);
      const go = (index) => {
        e.preventDefault();
        items[(index + items.length) % items.length]?.focus();
      };
      if (e.key === "ArrowDown") go(at + 1);
      else if (e.key === "ArrowUp") go(at <= 0 ? items.length - 1 : at - 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(items.length - 1);
      else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      } else if (e.key === "Tab") close();
    },
  };

  // Roving focus: items are reachable by arrow keys, not by Tab.
  const itemProps = { role: "menuitem", tabIndex: -1 };

  return { open, pos, close, triggerProps, menuProps, itemProps };
}
