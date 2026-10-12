import { NEEDS } from "../../lib/salesPackageOptions";
import { StepCard, inputClass } from "./shared";

export default function NeedsStep({ data, patch }) {
  const toggleNeed = (need) => patch({ needs: data.needs.includes(need) ? data.needs.filter((n) => n !== need) : [...data.needs, need] });
  return (
    <StepCard title="Client Needs & Objectives" subtitle="Select all that apply for this client.">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {NEEDS.map((need) => (
          <label
            key={need}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              data.needs.includes(need) ? "border-gold bg-gold/10 text-gold-dark" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <input type="checkbox" checked={data.needs.includes(need)} onChange={() => toggleNeed(need)} className="accent-gold" />
            {need}
          </label>
        ))}
      </div>
      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Other (optional)</span>
        <input className={inputClass} value={data.otherNeed} onChange={(e) => patch({ otherNeed: e.target.value })} />
      </label>
    </StepCard>
  );
}
