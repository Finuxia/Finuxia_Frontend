import { CheckCircle2 } from "lucide-react";

export function formatPrice(cents, currency, interval) {
  if (cents === 0) return "Free";
  const amount = (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 });
  return `$${amount} ${currency.toUpperCase()}/${interval === "month" ? "mo" : interval === "year" ? "yr" : "one-time"}`;
}

/**
 * The plans as cards: name, price, description, what each includes, and one button. The page decides what the button does and says (buying,
 * changing plan, or not available yet), by answering `actionFor(plan)` with { label, disabled, onClick }.
 *
 *   <PlanCards plans={plans} currentPlanKey="elite" actionFor={(plan) => ({ label: "Subscribe", disabled: false, onClick: () => buy(plan) })} />
 */
export default function PlanCards({ plans, currentPlanKey, actionFor, className = "grid grid-cols-1 gap-4 sm:grid-cols-3" }) {
  return (
    <div className={className}>
      {(plans || []).map((plan) => {
        const isCurrent = plan.key === currentPlanKey;
        const action = actionFor(plan);
        return (
          <div
            key={plan.id}
            className={`flex flex-col gap-4 rounded-2xl border bg-white p-6 shadow-sm ${isCurrent ? "border-gold ring-2 ring-gold/30" : "border-slate-200"}`}
          >
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-navy">{plan.name}</h2>
                {isCurrent && (
                  <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold-dark">Current plan</span>
                )}
              </div>
              <p className="mt-1 text-2xl font-bold text-navy">{formatPrice(plan.priceCents, plan.currency, plan.interval)}</p>
              <p className="mt-1 text-xs text-slate-500">{plan.description}</p>
            </div>

            <ul className="flex flex-1 flex-col gap-1.5">
              {plan.modules.map((m) => (
                <li key={m.key} className="flex items-start gap-1.5 text-sm text-slate-600">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-av-green" />
                  {m.name}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className="rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {action.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
