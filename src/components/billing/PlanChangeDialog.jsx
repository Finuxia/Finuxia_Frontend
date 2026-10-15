import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import { newIdempotencyKey } from "../../lib/idempotency";
import { accessEndSentence, confirmLabel, dialogTitle, dueNow, overLimitSentence } from "../../lib/planChange";
import Modal, { ModalTitle } from "../ui/Modal";

/**
 * Changing plan, with everything shown BEFORE the customer confirms: the new plan, what is due now, when their access ends afterwards, anything they
 * will lose, and any limit they are over. All of it is the server's own quote (nothing is worked out here), and confirming sends back the amount that was
 * shown: if the price moved in between, the server refuses, nothing is charged, and the new quote is shown to confirm again.
 *
 * An upgrade is an ordinary purchase (the customer is sent to pay, or the demo activates it); a downgrade happens at once, with no payment.
 */
export default function PlanChangeDialog({ plan, onClose }) {
  const { refreshBilling } = useAuth();
  const { addToast } = useToast();
  const [quote, setQuote] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const key = useRef(newIdempotencyKey()); // one per attempt: kept while the outcome is unknown, replaced after a definite answer

  useEffect(() => {
    let cancelled = false;
    api
      .previewPlanChange(plan.id)
      .then((q) => !cancelled && setQuote(q))
      .catch((err) => !cancelled && setLoadError(err.message || "Could not work out this change."));
    return () => {
      cancelled = true;
    };
  }, [plan.id]);

  const confirm = async () => {
    if (inFlight.current || !quote?.canChange) return;
    inFlight.current = true;
    setSubmitting(true);
    setNotice("");
    try {
      const result = await api.changePlan(
        plan.id,
        { expectedAmountCents: quote.amountDueCents, expectedCurrency: quote.currency },
        key.current
      );
      key.current = newIdempotencyKey();
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl; // stays "busy" while the browser leaves
        return;
      }
      await refreshBilling();
      addToast(
        quote.kind === "downgrade"
          ? `You're now on the ${quote.toPlan.name} plan. Your access end is unchanged and nothing was deleted.`
          : `You're now on the ${quote.toPlan.name} plan (test purchase — no real charge, payments aren't connected yet).`
      );
      onClose();
    } catch (err) {
      const code = err.data?.code;
      if (code === "quote_changed" && err.data.quote) {
        key.current = newIdempotencyKey();
        setQuote(err.data.quote);
        setNotice("The price changed since you looked. Please check the new amount below and confirm again.");
      } else if (code === "not_allowed") {
        key.current = newIdempotencyKey();
        setQuote((q) => ({ ...q, canChange: false, blockers: err.data.blockers || [] }));
      } else {
        setNotice(err.message || "Could not make this change.");
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} variant="sheet" panelClassName="max-w-lg">
      <div className="flex flex-col gap-4 p-6">
        <ModalTitle className="text-lg font-bold text-navy">{quote ? dialogTitle(quote) : `Change to ${plan.name}`}</ModalTitle>

        {!quote && !loadError && <p className="text-sm text-slate-500">Working out what this change does…</p>}
        {loadError && (
          <p role="alert" className="text-sm text-av-red">
            {loadError}
          </p>
        )}

        {quote && (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">New plan</dt>
              <dd className="font-semibold text-navy">{quote.toPlan.name}</dd>
              <dt className="text-slate-500">Due now</dt>
              <dd className="font-semibold text-navy">{dueNow(quote)}</dd>
            </dl>
            <p className="text-sm text-slate-600">{accessEndSentence(quote)}</p>
            {quote.kind === "downgrade" && (
              <p className="text-sm text-slate-600">
                This takes effect now. If you would rather keep {quote.fromPlan?.name || "your current plan"} until your access ends, simply
                close this.
              </p>
            )}

            {quote.lost.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-navy">What you will lose</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">
                  {quote.lost.map((x) => (
                    <li key={`${x.kind}-${x.key}`}>
                      {x.label}
                      {x.was || x.becomes ? `: ${x.was} → ${x.becomes}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {quote.overLimits.length > 0 && (
              <div className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2.5 text-sm text-gold-dark">
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle size={14} aria-hidden="true" />
                  You are over this plan's limits
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {quote.overLimits.map((x) => (
                    <li key={x.key}>{overLimitSentence(x)}</li>
                  ))}
                </ul>
                <p className="mt-1">
                  Nothing is deleted. You keep and can use everything you have; you just cannot add more until you are back under the limit.
                </p>
              </div>
            )}

            {!quote.canChange && quote.blockers.length > 0 && (
              <ul role="alert" className="rounded-lg border border-av-red/40 bg-av-red/10 px-3 py-2.5 text-sm text-av-red">
                {quote.blockers.map((b) => (
                  <li key={b.code}>{b.message}</li>
                ))}
              </ul>
            )}
          </>
        )}

        {notice && (
          <p role="alert" className="text-sm text-av-red">
            {notice}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!quote || !quote.canChange || submitting}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Processing..." : quote ? confirmLabel(quote) : "Confirm"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
