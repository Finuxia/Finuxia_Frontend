import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { forgetPlanBeforeCheckout, planBeforeCheckout, purchaseConfirmed } from "../lib/checkout";

/**
 * Where the payment provider sends the customer back to: /billing/success and /billing/cancel.
 *
 * Nothing here believes the URL. Anyone can open /billing/success, and the provider's redirect proves nothing (the
 * payment can still be processing, or fail). So the success page asks the server for the account's real billing
 * status, again every few seconds, and only says "confirmed" once the server shows an active paid plan that is not the
 * one the account had before checkout. If that does not happen in time it says so honestly and offers to check again.
 * The cancel page likewise only reports the plan the server says the account is on (loaded when the app started).
 */
export default function PaymentReturn({ outcome, intervalMs = 2000, maxAttempts = 15 }) {
  const { billing, refreshBilling } = useAuth();
  const [phase, setPhase] = useState("checking"); // checking | confirmed | pending | error
  const [round, setRound] = useState(0);
  const refreshRef = useRef(refreshBilling);
  refreshRef.current = refreshBilling;

  useEffect(() => {
    if (outcome !== "success") return undefined;
    let cancelled = false;
    let timer;
    const before = planBeforeCheckout();
    setPhase("checking");

    const attempt = async (n) => {
      const status = await refreshRef.current(); // asks the server; null if it could not
      if (cancelled) return;
      if (purchaseConfirmed(status, before)) {
        forgetPlanBeforeCheckout();
        setPhase("confirmed");
      } else if (n >= maxAttempts) {
        setPhase(status ? "pending" : "error");
      } else {
        timer = setTimeout(() => attempt(n + 1), intervalMs);
      }
    };
    attempt(1);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [outcome, intervalMs, maxAttempts, round]);

  const checkAgain = useCallback(() => setRound((r) => r + 1), []);
  const planName = billing?.plan?.name;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div role="status" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {outcome === "cancel" ? (
          <>
            <XCircle className="mx-auto text-slate-400" size={36} />
            <h1 className="mt-3 text-xl font-semibold text-navy">Checkout cancelled</h1>
            <p className="mt-2 text-sm text-slate-500">
              {planName ? `Your plan hasn't changed: you're on ${planName}.` : "Your plan hasn't changed."}
            </p>
            <Actions primary={{ to: "/billing", label: "Back to plans" }} />
          </>
        ) : phase === "confirmed" ? (
          <>
            <CheckCircle2 className="mx-auto text-av-green" size={36} />
            <h1 className="mt-3 text-xl font-semibold text-navy">You're all set</h1>
            <p className="mt-2 text-sm text-slate-500">Your payment is confirmed{planName ? ` and you're now on ${planName}` : ""}.</p>
            <Actions primary={{ to: "/dashboard", label: "Continue to the app" }} />
          </>
        ) : phase === "checking" ? (
          <>
            <Loader2 className="mx-auto animate-spin text-gold-dark" size={36} />
            <h1 className="mt-3 text-xl font-semibold text-navy">Confirming your payment…</h1>
            <p className="mt-2 text-sm text-slate-500">This usually takes a few seconds. Please don't pay again.</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto text-slate-400" size={36} />
            <h1 className="mt-3 text-xl font-semibold text-navy">We haven't received confirmation yet</h1>
            <p className="mt-2 text-sm text-slate-500">
              {phase === "error"
                ? "We couldn't reach the server to check. "
                : "If you completed the payment, it can take a few minutes to arrive; your plan updates by itself when it does. "}
              Please don't pay again.
            </p>
            <Actions primary={{ onClick: checkAgain, label: "Check again" }} secondary={{ to: "/billing", label: "Back to plans" }} />
          </>
        )}
      </div>
    </div>
  );
}

function Actions({ primary, secondary }) {
  const base = "rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm";
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
      {primary.to ? (
        <Link to={primary.to} className={`${base} bg-navy text-white hover:bg-navy-light`}>
          {primary.label}
        </Link>
      ) : (
        <button type="button" onClick={primary.onClick} className={`${base} bg-navy text-white hover:bg-navy-light`}>
          {primary.label}
        </button>
      )}
      {secondary && (
        <Link to={secondary.to} className="text-sm font-semibold text-slate-700 underline">
          {secondary.label}
        </Link>
      )}
    </div>
  );
}
