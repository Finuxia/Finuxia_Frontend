import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { CalendarClock, Lock, LogOut, LifeBuoy } from "lucide-react";
import Logo from "../components/layout/Logo";
import PaymentHistory from "../components/billing/PaymentHistory";
import PlanCards from "../components/billing/PlanCards";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatLongDate } from "../lib/dates";
import { createAttemptKeys, isRetryable } from "../lib/idempotency";

/**
 * Where an account goes when its access is running out or over: the plans, with the real checkout, and (for an account that has paid before) its
 * payments with their receipts, which stay available after access ends. Only paid plans are offered here (a free plan would not restore access). When plans cannot be bought online yet, the way forward is the support contact, which comes from
 * configuration (served with the plans), never from this file.
 */
export default function Subscribe() {
  const { user, billing, logout, refreshBilling, refreshUser } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [purchasingId, setPurchasingId] = useState(null);
  // One key per plan being bought, kept until the attempt's outcome is known (see lib/idempotency), as on the Plans & Billing page.
  const attemptKeys = useRef(createAttemptKeys());
  const inFlight = useRef(false);

  const loadPlans = () => {
    setLoading(true);
    setError(null);
    return api
      .getBillingPlans()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    loadPlans();
  }, []);

  const active = user?.subscriptionActive !== false;
  // When access ends is the server's own record (billing.access); the user record's date is only the fallback while it loads.
  const endsOn = formatLongDate(billing?.access?.endsAt ?? user?.subscriptionUntil);
  const left = billing?.access?.daysLeft ?? null;
  const paidBefore = billing?.plan?.priceCents > 0;

  const plans = (data?.plans || []).filter((p) => p.priceCents > 0);
  const purchasesOpen = data?.purchasesOpen !== false;
  const stripeConfigured = Boolean(data?.stripeConfigured);
  const supportEmail = data?.supportEmail || "";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const buy = async (plan) => {
    if (inFlight.current) return; // a second click before the first request returned
    inFlight.current = true;
    setPurchasingId(plan.id);
    try {
      const result = await api.purchasePlan(plan.id, attemptKeys.current.keyFor(plan.id));
      attemptKeys.current.settle(plan.id);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl; // the page stays "busy" while the browser leaves
        return;
      }
      if (result.mock) {
        await Promise.all([refreshBilling(), refreshUser()]);
        addToast(`You're now on the ${plan.name} plan (test purchase: no real charge, Stripe isn't connected yet).`);
        navigate("/dashboard", { replace: true });
        return;
      }
    } catch (err) {
      // A definite answer ends the attempt; an unknown outcome keeps the key so clicking again retries the SAME purchase.
      if (!isRetryable(err)) attemptKeys.current.settle(plan.id);
      addToast(err.message || "Could not start checkout");
    }
    inFlight.current = false;
    setPurchasingId(null);
  };

  const actionFor = (plan) => ({
    onClick: () => buy(plan),
    disabled: purchasingId !== null || !purchasesOpen,
    label:
      purchasingId === plan.id ? "Processing..." : !purchasesOpen ? "Not available yet" : stripeConfigured ? "Buy" : "Get this plan (test)",
  });

  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-4xl">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Logo size={26} plain />
          <span className="text-lg font-bold tracking-tight text-navy">
            Fin<span className="text-gold-dark">uxia</span>
          </span>
        </div>

        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-gold-dark">
            {active ? <CalendarClock size={22} /> : <Lock size={22} />}
          </div>

          {active ? (
            <>
              <h1 className="text-xl font-bold text-navy">{paidBefore ? "Your access" : "You're on the free trial"}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {endsOn ? (
                  <>
                    Your access runs until <span className="font-semibold text-navy">{endsOn}</span>
                    {left !== null && <> ({left === 1 ? "1 day" : `${left} days`} left)</>}.
                  </>
                ) : (
                  <>Your access has no end date.</>
                )}{" "}
                Buy a plan any time to keep going after that, with nothing lost. Nothing renews by itself.
              </p>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="mt-5 w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light"
              >
                Back to the app
              </button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-navy">{paidBefore ? "Your access has ended" : "Your free trial has ended"}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {endsOn ? <>It ended on {endsOn}. </> : null}
                Access to your clients, meetings, follow-ups and the rest of the app is paused. Nothing you added has been deleted.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Your plans don't renew by themselves. Buy a plan below and everything switches back on right away. Receipts for what you
                paid are further down.
              </p>
            </>
          )}
        </div>

        <div className="mt-8">
          {loading && !data && <p className="text-center text-sm text-slate-400">Loading plans...</p>}
          {error && (
            <div
              role="alert"
              className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-dashed border-av-red/30 bg-white px-6 py-6 text-center text-sm text-av-red"
            >
              <span>{error.message}</span>
              <button
                type="button"
                onClick={loadPlans}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50"
              >
                Try again
              </button>
            </div>
          )}

          {data && !purchasesOpen && (
            <div
              role="status"
              className="mx-auto mb-5 flex max-w-xl flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
            >
              <span className="flex items-center gap-2 font-medium text-navy">
                <LifeBuoy size={15} className="shrink-0 text-gold-dark" />
                Plans can't be bought online yet.
              </span>
              {supportEmail ? (
                <span>
                  To {active ? "subscribe" : "get back in"}, contact us at{" "}
                  <a
                    href={`mailto:${supportEmail}?subject=${encodeURIComponent("Finuxia subscription")}`}
                    className="font-semibold text-navy underline"
                  >
                    {supportEmail}
                  </a>
                  .
                </span>
              ) : (
                <span>
                  To {active ? "subscribe" : "get back in"}, please{" "}
                  <Link to="/support" className="font-semibold text-navy underline">
                    contact support
                  </Link>
                  .
                </span>
              )}
            </div>
          )}

          {data && plans.length > 0 && (
            <PlanCards plans={plans} currentPlanKey={billing?.status === "active" ? billing?.plan?.key : undefined} actionFor={actionFor} />
          )}
        </div>

        <div className="mx-auto mt-8 max-w-3xl">
          <PaymentHistory title="Your payments and receipts" />
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mx-auto mt-6 flex items-center justify-center gap-2 text-sm font-medium text-slate-500 transition hover:text-navy"
        >
          <LogOut size={15} />
          Log out
        </button>
      </div>
    </div>
  );
}
