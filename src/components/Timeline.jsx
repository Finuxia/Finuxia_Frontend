import { Check } from "lucide-react";
import { PIPELINE_STAGES } from "../lib/pipeline";
import { formatDate } from "../lib/followUp";
import { getStageStatusMeta } from "../lib/stageStatus";

export default function Timeline({ client, onEditStage }) {
  return (
    <ol className="flex flex-col">
      {PIPELINE_STAGES.map((stage, idx) => {
        const stageState = client.stages[stage.id];
        const status = stageState?.status ?? "upcoming";
        const meta = getStageStatusMeta(status);
        const isLast = idx === PIPELINE_STAGES.length - 1;
        const isCurrent = stage.id === client.currentStage;

        return (
          <li key={stage.id} className="relative flex gap-4 pb-8 last:pb-0">
            {!isLast && (
              <span
                className={`absolute left-[15px] top-8 h-full w-0.5 ${
                  status === "completed" ? "bg-av-green" : "bg-slate-200"
                }`}
              />
            )}
            <span
              className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold text-white ${meta.dot} ${meta.border}`}
            >
              {status === "completed" ? <Check size={14} /> : idx + 1}
            </span>
            <button
              onClick={() => onEditStage?.(stage)}
              className="flex-1 rounded-xl px-3 py-1.5 text-left transition hover:bg-slate-50"
            >
              <p className={`text-sm font-semibold ${isCurrent ? "text-navy" : "text-slate-600"}`}>
                {stage.label} <span className={`font-medium ${meta.text}`}>({meta.label})</span>
                {isCurrent && (
                  <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-dark">
                    Current
                  </span>
                )}
              </p>
              {stageState?.date && <p className="text-xs text-slate-400">{formatDate(stageState.date)}</p>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
