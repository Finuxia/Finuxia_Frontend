import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { canStateIntent } from "../../lib/accessCopy";
import { api } from "../../lib/api";
import { formatLongDate, formatLongDateTime } from "../../lib/dates";
import Modal, { ModalTitle } from "../ui/Modal";

/**
 * "I don't plan to continue": a statement, and nothing more. Nothing renews by itself, so there is nothing to cancel and no charge to stop;
 * saying so only tells us (and stops the reminders). It never shortens the access already paid for, and it can be taken back at any time
 * before access ends, at no cost. Before the customer confirms, the dialog says exactly when access ends, that nothing more will be charged,
 * and that their data is kept. Whether to offer it, and when access ends, come from the server (`billing.access`).
 */
export default function ContinueIntent() {
  const { billing, refreshBilling } = useAuth();
  const { addToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!canStateIntent(billing)) return null;

  const access = billing.access;
  const endsAt = formatLongDateTime(access.endsAt);
  const since = formatLongDate(billing.notContinuingSince);

  const say = async (willContinue) => {
    setBusy(true);
    try {
      await api.setContinueIntent(willContinue);
      await refreshBilling();
      setConfirming(false);
      addToast(willContinue ? "Noted: you may continue. Nothing about your access has changed." : "Noted. Your access is unchanged.");
    } catch (err) {
      addToast(err.message || "Could not save that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 text-sm">
      {billing.notContinuingSince ? (
        <div data-testid="not-continuing" className="flex flex-col gap-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
          <p>
            {since ? `On ${since} you told us` : "You told us"} you don't plan to continue. Your access still runs until {endsAt}, and nothing
            more will be charged.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => say(true)}
            className="self-start text-xs font-semibold text-navy underline disabled:opacity-60"
          >
            {busy ? "Saving..." : "I've changed my mind"}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="text-xs font-semibold text-slate-500 underline hover:text-navy">
          I don't plan to continue
        </button>
      )}

      {confirming && (
        <Modal onClose={() => !busy && setConfirming(false)} panelClassName="max-w-md rounded-2xl p-6">
          <ModalTitle className="text-lg font-bold text-navy">You don't plan to continue?</ModalTitle>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm text-slate-600">
            <li>
              Your access continues until <span className="font-semibold text-navy">{endsAt}</span>.
            </li>
            <li>Nothing further will be charged: plans are paid for once and never renew.</li>
            <li>Everything you've added is kept.</li>
            <li>You can change your mind any time before then, at no cost.</li>
          </ul>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50"
            >
              Not now
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => say(false)}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              {busy ? "Saving..." : "Confirm"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
