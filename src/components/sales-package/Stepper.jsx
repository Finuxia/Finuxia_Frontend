import { CheckCircle2, AlertTriangle } from "lucide-react";

export default function Stepper({ steps, current, statuses, onSelect }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3">
        {steps.map((label, i) => {
          const st = statuses[i];
          const isCurrent = i === current;
          const circle = isCurrent
            ? "bg-navy text-white"
            : st === "complete"
              ? "bg-av-green text-white"
              : st === "incomplete"
                ? "bg-amber-100 text-amber-700 ring-1 ring-amber-400"
                : "bg-slate-100 text-slate-400";
          const text = isCurrent
            ? "text-navy"
            : st === "complete"
              ? "text-av-green"
              : st === "incomplete"
                ? "text-amber-600"
                : "text-slate-400";
          return (
            <button key={label} type="button" onClick={() => onSelect(i)} className="flex shrink-0 items-center gap-2 px-2">
              <span
                className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${circle}`}
              >
                {st === "complete" && !isCurrent ? (
                  <CheckCircle2 size={15} />
                ) : st === "incomplete" && !isCurrent ? (
                  <AlertTriangle size={13} />
                ) : (
                  i + 1
                )}
                {isCurrent && st === "incomplete" && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-400" />
                )}
                {isCurrent && st === "complete" && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-av-green" />
                )}
              </span>
              <span className={`whitespace-nowrap text-sm font-medium ${text}`}>{label}</span>
              {i < steps.length - 1 && <span className="mx-2 h-px w-6 shrink-0 bg-slate-200" />}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4 px-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-av-green" /> Complete
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Incomplete
        </span>
      </div>
    </div>
  );
}
