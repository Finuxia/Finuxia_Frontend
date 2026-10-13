import { useEffect, useRef, useState } from "react";
import { Sparkles, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { createAttemptKeys, isRetryable } from "../lib/idempotency";
import AccessCard from "../components/billing/AccessCard";
import ContinueIntent from "../components/ContinueIntent";
import PaymentHistory from "../components/billing/PaymentHistory";
import PlanCards from "../components/billing/PlanCards";

/**
 * Plans & Billing. Every plan is a single payment that buys a stretch of access (nothing renews), so this page is about three things: when
 * your access ends, which plan to buy next, and what you have paid. All of it is read from our own records, not from the payment provider.
 */
export default function Billing() {
  const { billing, refreshBilling } = useAuth();
  const { addToast } = useToast();
  const [plans, setPlans] = useState(null);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  // False in production until payments are connected: paid plans can't be bought yet.
  const [purchasesOpen, setPurchasesOpen] = useState(true);
  const [purchasingId, setPurchasingId] = useState(null);

  useEffect(() => {
    api
      .getBillingPlans()
      .then((res) => {
        setPlans(res.plans);
        setStripeConfigured(res.stripeConfigured);
        setPurchasesOpen(res.purchasesOpen !== false);
      })
      .catch(() => addToast("Could not load plans"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one read of the plans when the page opens; addToast is not stable and must not re-fetch
  }, []);

  const currentPlanKey = billing?.plan?.key;
  const isLegacy = currentPlanKey === "legacy";

  // One key per plan being bought, kept until the attempt's outcome is known (see lib/idempotency).
  const attemptKeys = useRef(createAttemptKeys());
  const inFlight = useRef(false);

  const handlePurchase = async (plan) => {
    if (inFlight.current) return; // a second click before the first request returned
    inFlight.current = true;
    setPurchasingId(plan.id);
    try {
      const result = await api.purchasePlan(plan.id, attemptKeys.current.keyFor(plan.id));
      attemptKeys.current.settle(plan.id);
      if (result.mock) {
        await refreshBilling();
        addToast(`You're now on the ${plan.name} plan (test purchase — no real charge, payments aren't connected yet).`);
      } else if (result.checkoutUrl) {
        // Deliberately left busy, and deliberately not in a `finally`: the browser is on its way to the
        // provider, and a button that springs back to "Buy" during that is a button that can be clicked again.
        window.location.href = result.checkoutUrl;
        return;
      }
    } catch (err) {
      // A definite answer ends the attempt; an unknown outcome (network, 5xx, still in progress)
      // keeps the key so clicking again retries the SAME purchase instead of starting another.
      if (!isRetryable(err)) attemptKeys.current.settle(plan.id);
      addToast(err.message || "Could not start checkout");
    }
    inFlight.current = false;
    setPurchasingId(null);
  };

  /**
   * What each plan's button says and does. The plan the account is already on stays buyable, labelled "Buy again": a plan is one payment for a
   * stretch of access, so buying the same one again is how access is extended (the server keeps whichever end date is later). Every button is
   * disabled while any purchase is in flight, so a second plan cannot be started on top of the first.
   */
  const actionFor = (plan) => {
    const paid = plan.priceCents > 0;
    const closed = paid && !purchasesOpen;
    return {
      onClick: () => handlePurchase(plan),
      disabled: purchasingId !== null || isLegacy || closed,
      label:
        purchasingId === plan.id
          ? "Processing..."
          : closed
            ? "Not available yet"
            : !paid
              ? "Choose"
              : plan.key === currentPlanKey
                ? "Buy again"
                : stripeConfigured
                  ? "Buy"
                  : "Get this plan (test)",
    };
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Plans &amp; Billing</h1>
        <p className="text-sm text-slate-500">When your access ends, the plans you can buy, and what you have paid.</p>
      </div>

      {/* Where access stands, then the statement about continuing. AccessCard owns the account's access
          summary; ContinueIntent is only the "I don't plan to continue" statement and its dialog. */}
      <AccessCard />
      <ContinueIntent />

      {isLegacy && (
        <div className="flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold-dark">
          <ShieldCheck size={16} />
          You joined before plans existed, so your account keeps full access to every module for free — no need to pick a plan.
        </div>
      )}

      {!purchasesOpen && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Sparkles size={14} className="shrink-0 text-gold-dark" />
          Plan purchases aren't open yet. Your access stays as it is — we'll announce when paid plans are available.
        </div>
      )}

      {purchasesOpen && !stripeConfigured && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <Sparkles size={14} className="shrink-0 text-gold-dark" />
          Payments aren't connected yet — "buying" a plan below activates it instantly for testing, with no real charge.
        </div>
      )}

      <section id="plans" aria-label="Plans" className="scroll-mt-20">
        <PlanCards plans={plans} currentPlanKey={currentPlanKey} actionFor={actionFor} />
      </section>

      <PaymentHistory />
    </div>
  );
}
