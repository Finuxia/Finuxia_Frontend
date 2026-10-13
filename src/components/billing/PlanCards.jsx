import { CheckCircle2 } from "lucide-react";
import { describeTerm, priceLine } from "../../lib/planTerm";
import PlanDescription from "./PlanDescription";

/**
 * The plans as cards: logo, name, price and how long one purchase lasts, description, what each includes, and one button. The page decides what the
 * button does and says (buying, or not available yet), by answering `actionFor(plan)` with { label, disabled, onClick }.
 *
 *   <PlanCards plans={plans} currentPlanKey="elite" actionFor={(plan) => ({ label: "Buy", disabled: false, onClick: () => buy(plan) })} />
 */
export default function PlanCards({ plans, currentPlanKey, actionFor, className = "grid grid-cols-1 gap-4 sm:grid-cols-3" }) {
  return (
    <div className={className}>
      {(plans || []).map((plan) => {
        const isCurrent = plan.key === currentPlanKey;
        const action = actionFor(plan);
        const term = plan.priceCents > 0 ? describeTerm(plan.accessDuration) : "";
        return (
          <div
            key={plan.id}
            className={`flex flex-col gap-4 rounded-2xl border bg-white p-6 shadow-sm ${isCurrent ? "border-gold ring-2 ring-gold/30" : "border-slate-200"}`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {plan.logoUrl && <PlanLogo plan={plan} />}
                  <h2 className="truncate text-lg font-bold text-navy">{plan.name}</h2>
                </div>
                {isCurrent && (
                  <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold-dark">
                    Current plan
                  </span>
                )}
              </div>
              <p className="mt-1 text-2xl font-bold text-navy">{priceLine(plan)}</p>
              {term && <p className="text-xs font-medium text-slate-500">One payment. Access for {term}; it does not renew by itself.</p>}
              <PlanDescription plan={plan} />
            </div>

            {(plan.modules.length > 0 || (plan.includes || []).length > 0) && (
              <ul className="flex flex-1 flex-col gap-1.5">
                {plan.modules.map((m) => (
                  <li key={m.key} className="flex items-start gap-1.5 text-sm text-slate-600">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-av-green" />
                    {m.name}
                  </li>
                ))}
                {(plan.includes || []).map((item) => (
                  <li key={item.key} className="flex items-start gap-1.5 text-sm text-slate-600">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-av-green" />
                    <span>
                      {item.label}: <span className="font-medium text-navy">{item.summary}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className="mt-auto rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {action.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// The picture is decorative next to the plan's name, so it has no text of its own for a screen reader to repeat. The server's address is relative
// to the API, so it is joined to the API's base.
function PlanLogo({ plan }) {
  const base = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");
  const src = /^https?:\/\//i.test(plan.logoUrl) ? plan.logoUrl : `${base}${plan.logoUrl}`;
  return <img src={src} alt="" width={28} height={28} loading="lazy" className="h-7 w-7 shrink-0 rounded object-contain" />;
}
