import Modal, { ModalTitle } from "../ui/Modal";
import { useEffect, useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { useGoogleCalendar } from "../../context/GoogleCalendarContext";
import { useToast } from "../../context/ToastContext";

/**
 * Global watcher: whenever the server-side Google Calendar connection drops
 * to "expired" or "revoked" it surfaces a friendly reconnect prompt. Mounted
 * once in the app shell so any screen that hits it gets the same recovery
 * path. Dismissable — cached meetings stay visible behind it, so it never
 * blocks work.
 *
 * This should be rare: the connection is a refresh token held on the
 * backend, not a per-session browser token, so it only shows up on a real
 * disconnection (Google access revoked, or the refresh token itself expired).
 */
export default function ReconnectModal() {
  const { status, connect, disconnect } = useGoogleCalendar();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Auto-open on transition into "expired"/"revoked"; auto-close once reconnected.
  useEffect(() => {
    if (status === "expired" || status === "revoked") setOpen(true);
    if (status === "connected") setOpen(false);
  }, [status]);

  if (!open || (status !== "expired" && status !== "revoked")) return null;

  const handleReconnect = async () => {
    setBusy(true);
    try {
      await connect();
      // Unreachable in practice — connect() is a full-page redirect to
      // Google, so nothing after the await runs in this tab.
    } catch (err) {
      addToast(err.message || "Could not reconnect");
      setBusy(false);
    }
  };

  const handleDismiss = () => setOpen(false);

  const handleDisconnect = () => {
    disconnect();
    setOpen(false);
  };

  return (
    <Modal onClose={handleDismiss} panelClassName="max-w-sm rounded-2xl p-6" zIndex="z-[60]" dismissOnBackdrop={false}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-av-amber/10 text-av-amber">
          <CalendarClock size={20} />
        </div>
        <button
          onClick={handleDismiss}
          className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>
      </div>

      <ModalTitle className="text-lg font-semibold text-navy">
        {status === "revoked" ? "Google Calendar access was revoked" : "Google Calendar session expired"}
      </ModalTitle>
      <p className="mt-1 text-sm text-slate-500">
        Your meetings are still shown from your last sync, but reconnect to keep them up to date and add new events.
      </p>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          onClick={handleDisconnect}
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
        >
          Disconnect
        </button>
        <button onClick={handleDismiss} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100">
          Later
        </button>
        <button
          onClick={handleReconnect}
          disabled={busy}
          className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-60"
        >
          {busy ? "Reconnecting..." : "Reconnect"}
        </button>
      </div>
    </Modal>
  );
}
