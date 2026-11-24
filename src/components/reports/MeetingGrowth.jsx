import { useMemo, useState } from "react";
import { MEETING_TYPES, countsByMonthAndType, growth, monthShortLabel } from "../../lib/chartPipeline";

// Literal class names (Tailwind only keeps what it can see written out), one pair per type: the bar and the dot in the legend and on the chip.
const COLORS = {
  CP: { bar: "fill-gold", dot: "bg-gold" },
  FC1: { bar: "fill-navy", dot: "bg-navy" },
  FC2: { bar: "fill-av-blue", dot: "bg-av-blue" },
  FC3: { bar: "fill-av-green", dot: "bg-av-green" },
  Strategy: { bar: "fill-av-amber", dot: "bg-av-amber" },
  Closing: { bar: "fill-av-red", dot: "bg-av-red" },
  "Policy Delivery": { bar: "fill-slate-500", dot: "bg-slate-500" },
  Other: { bar: "fill-slate-300", dot: "bg-slate-300" },
};

const DEFAULT_TYPES = ["CP", "FC1"];
const W = 560;
const H = 220;
const PAD = { top: 18, right: 8, bottom: 30, left: 30 };

function describeChange(type, previous, current, previousKey, currentKey) {
  const { change, percent } = growth(previous, current);
  const sign = change > 0 ? "+" : "";
  const how = percent === null ? (change > 0 ? "new" : "no change") : `${sign}${percent}%`;
  return `${type}: ${previous} in ${monthShortLabel(previousKey)}, ${current} in ${monthShortLabel(currentKey)} (${how})`;
}

/**
 * How the number of meetings grows from month to month, for the meeting types the person picks (CP and FC1 to begin with).
 * `events` already includes the month before the report's range, so even "This month" has last month to compare with.
 */
export default function MeetingGrowth({ events, monthKeys, connected }) {
  const [selected, setSelected] = useState(DEFAULT_TYPES);
  const counts = useMemo(() => countsByMonthAndType(events), [events]);

  const toggle = (type) => setSelected((now) => (now.includes(type) ? now.filter((t) => t !== type) : [...now, type]));
  // Always in the order a client moves through them, whatever order they were ticked in.
  const types = MEETING_TYPES.filter((t) => selected.includes(t));
  const valueOf = (month, type) => counts[month]?.[type] || 0;

  if (!connected) {
    return <p className="py-4 text-center text-sm text-slate-400">Connect Google Calendar to see how your meetings grow.</p>;
  }

  const previousKey = monthKeys.length > 1 ? monthKeys[monthKeys.length - 2] : null;
  const currentKey = monthKeys[monthKeys.length - 1];
  const max = Math.max(1, ...monthKeys.flatMap((m) => types.map((t) => valueOf(m, t))));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const groupW = plotW / Math.max(monthKeys.length, 1);
  const barW = types.length ? Math.min(28, (groupW * 0.8) / types.length) : 0;
  const y = (v) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [...new Set([0, Math.ceil(max / 2), max])];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Meeting types">
        {MEETING_TYPES.map((type) => {
          const on = selected.includes(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggle(type)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                on ? "border-navy bg-navy text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${COLORS[type].dot}`} aria-hidden="true" />
              {type}
            </button>
          );
        })}
      </div>

      {types.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Pick at least one meeting type.</p>
      ) : (
        <>
          {previousKey && (
            <ul className="flex flex-col gap-1 text-sm text-slate-600">
              {types.map((type) => {
                const previous = valueOf(previousKey, type);
                const current = valueOf(currentKey, type);
                const up = current > previous;
                const down = current < previous;
                return (
                  <li key={type} className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${COLORS[type].dot}`} aria-hidden="true" />
                    <span className={up ? "text-av-green" : down ? "text-av-red" : ""}>
                      {describeChange(type, previous, current, previousKey, currentKey)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Meetings per month for ${types.join(", ")}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-slate-100" />
                <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-slate-400 text-[10px]">
                  {t}
                </text>
              </g>
            ))}
            {monthKeys.map((month, i) => {
              const groupX = PAD.left + i * groupW + (groupW - barW * types.length) / 2;
              return (
                <g key={month}>
                  {types.map((type, j) => {
                    const v = valueOf(month, type);
                    return (
                      <g key={type}>
                        <rect
                          x={groupX + j * barW}
                          y={y(v)}
                          width={Math.max(barW - 2, 1)}
                          height={PAD.top + plotH - y(v)}
                          rx="2"
                          className={COLORS[type].bar}
                        />
                        {v > 0 && (
                          <text
                            x={groupX + j * barW + (barW - 2) / 2}
                            y={y(v) - 4}
                            textAnchor="middle"
                            className="fill-navy text-[10px] font-semibold"
                          >
                            {v}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  <text x={PAD.left + i * groupW + groupW / 2} y={H - 10} textAnchor="middle" className="fill-slate-500 text-[10px]">
                    {monthShortLabel(month)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* The same numbers as text, for screen readers and for anyone who wants the exact figure. */}
          <table className="sr-only">
            <caption>Meetings per month</caption>
            <thead>
              <tr>
                <th>Month</th>
                {types.map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthKeys.map((m) => (
                <tr key={m}>
                  <th>{monthShortLabel(m)}</th>
                  {types.map((t) => (
                    <td key={t}>{valueOf(m, t)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
