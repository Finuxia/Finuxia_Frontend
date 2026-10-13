import { Calendar } from "lucide-react";
import { listRecentMonths } from "../lib/chartPipeline";

/**
 * Month picker for charts/reports. `value` is a month key ("2026-08"); an empty
 * value means "All time". Defaults to the current month at the call site.
 */
export default function MonthFilter({ value, onChange, months = 12, includeAll = false, className = "" }) {
  const options = listRecentMonths(months);

  return (
    <label className={`inline-flex items-center gap-2 ${className}`}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Calendar size={13} />
        Month
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
      >
        {includeAll && <option value="">All time</option>}
        {options.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
