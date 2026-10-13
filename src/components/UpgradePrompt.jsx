import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

/** "This isn't in your plan": the existing upgrade prompt, shared by the plan gate and by any refusal that means the same. */
export default function UpgradePrompt({ moduleName, message }) {
  const what = moduleName || "This feature";
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-gold-dark">
        <Lock size={24} />
      </div>
      <div>
        <p className="text-lg font-semibold text-navy">{moduleName ? `${moduleName} isn't included in your current plan` : message || "This isn't included in your current plan"}</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">Upgrade to a plan that includes {what === "This feature" ? "it" : moduleName} to use this page.</p>
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
