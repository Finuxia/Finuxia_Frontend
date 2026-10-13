import { AlertTriangle, CalendarClock, CheckCircle2, Infinity as InfinityIcon } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { accessCopy } from "../../lib/accessCopy";

const TONES = {
  ok: { box: "border-slate-200 bg-white", icon: CheckCircle2, iconClass: "text-av-green" },
  soon: { box: "border-amber-300 bg-amber-50", icon: CalendarClock, iconClass: "text-amber-700" },
  urgent: { box: "border-av-red/40 bg-av-red/5", icon: AlertTriangle, iconClass: "text-av-red" },
  ended: { box: "border-av-red/40 bg-av-red/5", icon: AlertTriangle, iconClass: "text-av-red" },
};

/**
 * Where the customer's access stands: the plan they are on, exactly when access ends (or that it does not), and a warning well before the end.
 * Everything comes from the server's own records (`billing.access`); nothing renews by itself, so the card says so plainly.
 */
export default function AccessCard() {
  const { billing } = useAuth();
  const plan = billing?.plan;
  const copy = accessCopy(billing?.access);
  if (!plan || !copy) return null;
  const tone = TONES[copy.tone];
  const Icon = copy.headline === "Your access does not end." ? InfinityIcon : tone.icon;

  return (
    <section aria-label="Your access" className={`rounded-2xl border p-5 shadow-sm ${tone.box}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your access</p>
      <p className="text-lg font-bold text-navy">{plan.name}</p>
      <p role="status" className="mt-2 flex items-start gap-2 text-sm font-medium text-navy">
        <Icon size={16} className={`mt-0.5 shrink-0 ${tone.iconClass}`} aria-hidden="true" />
        <span>
          {copy.headline}
          {copy.detail && <span className="block font-normal text-slate-600">{copy.detail}</span>}
        </span>
      </p>
      <p className="mt-3 text-xs text-slate-500">
        Plans are paid for once, with a single payment. Nothing renews automatically and no card is kept on file. Buying again never adds
        up: you keep whichever end date is later.
      </p>
    </section>
  );
}
