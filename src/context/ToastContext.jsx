import { createContext, useCallback, useContext, useState } from "react";
import { createPortal } from "react-dom";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // The types go on the arrow itself, not on `addToast`: JSDoc above the `const` describes the variable,
  // which here is whatever useCallback returns, so the parameters would stay unchecked.
  const addToast = useCallback(
    /**
     * `action` adds a button to the toast, and keeps it a little longer so there is time to use it.
     * @param {string} message
     * @param {{ action?: { label: string, onClick: () => void } }} [options]
     */
    (message, { action } = {}) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, action }]);
      setTimeout(
        () => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        },
        action ? 8000 : 3000
      );
    },
    []
  );
  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* A live region, so screen readers announce a message without it taking focus. It sits outside the app's root
          (portal) and is marked data-keep-visible, so an open dialog does not hide it from assistive technology. */}
      {createPortal(
        <div
          data-keep-visible
          role="status"
          aria-label="Notifications"
          aria-live="polite"
          aria-atomic="false"
          className="fixed bottom-5 right-5 z-100 flex flex-col gap-2"
        >
          {toasts.map((t) => (
            <div key={t.id} className="animate-slide-up rounded-lg bg-navy px-4 py-3 text-sm font-medium text-white shadow-lg">
              {t.message}
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action.onClick();
                    dismiss(t.id);
                  }}
                  className="ml-3 font-semibold text-gold underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
