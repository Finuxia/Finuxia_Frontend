import { useEffect, useState } from "react";
import { Sparkles, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import AccessCard from "../components/billing/AccessCard";
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
  }, [addToast]);

  const currentPlanKey = billing?.plan?.key;
  const isLegacy = currentPlanKey === "legacy";

  const handlePurchase = async (plan) => {
    setPurchasingId(plan.id);
    try {
      const result = await api.purchasePlan(plan.id);
      if (result.mock) {
        await refreshBilling();
        addToast(`You're now on the ${plan.name} plan (test purchase — no real charge, payments aren't connected yet).`);
      } else if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl; // the page stays "busy" while the browser leaves
        return;
      }
    } catch (err) {
      addToast(err.message || "Could not start checkout");
    }
    setPurchasingId(null);
  };

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

      <AccessCard />

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
