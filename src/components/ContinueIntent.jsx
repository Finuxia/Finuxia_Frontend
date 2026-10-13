import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { canStateIntent } from "../lib/continueIntent";
import { formatLongDate, formatLongDateTime } from "../lib/dates";

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
  const cancelRef = useRef(null);
  const inFlight = useRef(false); // a ref, not the `busy` state: two clicks in one instant are both handled before the state has changed

  // The dialog: focus goes to its safe button when it opens, and Escape closes it (unless a save is in flight).
  useEffect(() => {
    if (!confirming) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && !busy && setConfirming(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming, busy]);

  if (!canStateIntent(billing)) return null;

  const endsAt = formatLongDateTime(billing.access.endsAt);
  const since = formatLongDate(billing.notContinuingSince);

  const say = async (willContinue) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await api.setContinueIntent(willContinue);
      await refreshBilling();
      setConfirming(false);
      addToast(willContinue ? "Noted: you may continue. Nothing about your access has changed." : "Noted. Your access is unchanged.");
    } catch (err) {
      addToast(err.message || "Could not save that. Please try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <section aria-label="Your access" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your access</p>
      <p className="mt-1 font-semibold text-navy">
        {billing.plan.name}: access until {endsAt}
      </p>

      {billing.notContinuingSince ? (
        <div data-testid="not-continuing" className="mt-3 flex flex-col gap-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
          <p>
            {since ? `On ${since} you told us` : "You told us"} you don't plan to continue. Your access still runs until {endsAt}, and
            nothing more will be charged.
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
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 text-xs font-semibold text-slate-500 underline hover:text-navy"
        >
          I don't plan to continue
        </button>
      )}

      {confirming && (
        <div
          // The backdrop dismisses on a click, a mouse affordance only: the keyboard path is the
          // Escape handler in the effect above, and focus moves into the dialog when it opens.
          // `role="presentation"` states what this element is — a visual overlay, not a control.
          // Without it jsx-a11y reports the click handler as an interactive element with no
          // keyboard support, which is a fair complaint about the markup even though the behaviour
          // is covered (FE-12). The dismiss checks the event target rather than relying on the
          // dialog to stop propagation, so a click inside is ignored here instead of cancelled there.
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && !busy && setConfirming(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="continue-intent-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 id="continue-intent-title" className="text-lg font-bold text-navy">
              You don't plan to continue?
            </h2>
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
                ref={cancelRef}
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
          </div>
        </div>
      )}
    </section>
  );
}
