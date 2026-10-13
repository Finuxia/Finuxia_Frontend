import { useEffect, useRef, useState } from "react";
import { Sparkles, ShieldCheck } from "lucide-react";
import { rememberPlanBeforeCheckout } from "../lib/checkout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { createAttemptKeys, isRetryable } from "../lib/idempotency";
import PlanCards from "../components/PlanCards";

export default function Billing() {
  const { billing, refreshBilling } = useAuth();
  const { addToast } = useToast();
  const [plans, setPlans] = useState(null);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  // False in production until payments are connected: paid plans can't be selected yet.
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
        addToast(`You're now on the ${plan.name} plan (test purchase — no real charge, Stripe isn't connected yet).`);
      } else if (result.checkoutUrl) {
        rememberPlanBeforeCheckout(currentPlanKey); // so the return page can tell that the purchase really went through
        window.location.href = result.checkoutUrl;
      }
    } catch (err) {
      // A definite answer ends the attempt; an unknown outcome (network, 5xx, still in progress)
      // keeps the key so clicking again retries the SAME purchase instead of starting another.
      if (!isRetryable(err)) attemptKeys.current.settle(plan.id);
      addToast(err.message || "Could not start checkout");
    } finally {
      inFlight.current = false;
      setPurchasingId(null);
    }
  };

  const actionFor = (plan) => {
    const isCurrent = plan.key === currentPlanKey;
    return {
      onClick: () => handlePurchase(plan),
      disabled: isCurrent || purchasingId === plan.id || isLegacy || (!purchasesOpen && plan.priceCents > 0),
      label: isCurrent
        ? "Active"
        : purchasingId === plan.id
          ? "Processing..."
          : !purchasesOpen && plan.priceCents > 0
            ? "Not available yet"
            : stripeConfigured
              ? "Subscribe"
              : "Get this plan (test)",
    };
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Plans &amp; Billing</h1>
        <p className="text-sm text-slate-500">
          Pick a plan to unlock its modules. Each plan below only affects what your own account can use.
        </p>
      </div>

      {isLegacy && (
        <div className="flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold-dark">
          <ShieldCheck size={16} />
          You joined before plans existed, so your account keeps full access to every module for free — no need to pick a plan.
        </div>
      )}

      {!purchasesOpen && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Sparkles size={14} className="shrink-0 text-gold-dark" />
          Plan purchases aren't open yet. Your current plan stays as it is — we'll announce when paid plans are available.
        </div>
      )}

      {purchasesOpen && !stripeConfigured && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <Sparkles size={14} className="shrink-0 text-gold-dark" />
          Payments aren't connected yet — "purchasing" a plan below activates it instantly for testing, with no real charge.
        </div>
      )}

      <PlanCards plans={plans} currentPlanKey={currentPlanKey} actionFor={actionFor} />
    </div>
  );
}
