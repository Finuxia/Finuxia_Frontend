import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/**
 * Wraps a page that requires a specific plan module. Shows the page once
 * the account's plan includes it; otherwise shows an upgrade prompt instead
 * — mirrors what the backend itself enforces (HasModuleAccess), so this is
 * about a clean UI, not the actual security boundary.
 */
export default function ModuleGate({ moduleKey, moduleName, children }) {
  const { billing, billingStatus, refreshBilling, hasModule } = useAuth();

  if (!billing && billingStatus === "error") {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
        <p className="text-lg font-semibold text-navy">We couldn't check your plan</p>
        <p className="max-w-sm text-sm text-slate-500">Check your connection and try again.</p>
        <button
          type="button"
          onClick={refreshBilling}
          className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
        >
          Try again
        </button>
      </div>
    );
  }

  // Billing status hasn't loaded yet: say so rather than flash a locked page (or nothing).
  if (!billing) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-gold" />
        Checking your plan…
      </div>
    );
  }

  if (hasModule(moduleKey)) return children;

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-gold-dark">
        <Lock size={24} />
      </div>
      <div>
        <p className="text-lg font-semibold text-navy">{moduleName} isn't included in your current plan</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">Upgrade to a plan that includes {moduleName} to use this page.</p>
      </div>
      <Link
        to="/billing"
        className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
      >
        View Plans
      </Link>
    </div>
  );
}
