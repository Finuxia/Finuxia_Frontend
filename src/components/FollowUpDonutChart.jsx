import { useState } from "react";
import { useNavigate } from "react-router-dom";

const SEGMENTS = [
  { key: "Overdue", label: "Overdue", color: "#EF4444" },
  { key: "Today", label: "Today", color: "#F59E0B" },
  { key: "This week", label: "This Week", color: "#3B82F6" },
  { key: "Later", label: "Later", color: "#CBD5E1" },
];
//test deploy
const SIZE = 200;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 88;
const R_INNER = 56;
const GAP_DEG = 2.2;

export default function FollowUpDonutChart({ clients }) {
  const navigate = useNavigate();
  const [hover, setHover] = useState(null);

  const counts = SEGMENTS.map((seg) => ({
    ...seg,
    count:
      seg.key === "Later"
        ? clients.filter((c) => c.nextFollowUp === "Next month" || c.nextFollowUp === "TBD").length
        : clients.filter((c) => c.nextFollowUp === seg.key).length,
  }));

  const total = counts.reduce((sum, s) => sum + s.count, 0);

  let cursor = -90; // start at 12 o'clock
  const arcs = counts.map((seg) => {
    const fraction = total === 0 ? 0 : seg.count / total;
    const sweep = fraction * 360;
    const start = cursor + (sweep > 0 ? GAP_DEG / 2 : 0);
    const end = cursor + sweep - (sweep > 0 ? GAP_DEG / 2 : 0);
    cursor += sweep;
    return { ...seg, start, end, fraction };
  });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center">
      <div className="relative shrink-0">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={200} height={200} role="img" aria-label="Follow-ups by urgency">
          {arcs.map((seg) =>
            seg.fraction > 0 ? (
              <path
                key={seg.key}
                d={donutSlicePath(seg.start, seg.end)}
                fill={seg.color}
                opacity={hover && hover !== seg.key ? 0.45 : 1}
                className="cursor-pointer transition-opacity duration-150"
                onMouseEnter={() => setHover(seg.key)}
                onMouseLeave={() => setHover(null)}
                onClick={() => navigate(`/follow-ups`)}
              />
            ) : null
          )}
          <circle cx={CX} cy={CY} r={R_INNER - 1} fill="white" />
          <text x={CX} y={CY - 4} textAnchor="middle" fontSize="26" fontWeight="700" fill="#0f1c2e">
            {total}
          </text>
          <text x={CX} y={CY + 16} textAnchor="middle" fontSize="10" fill="#94a3b8">
            follow-ups
          </text>
        </svg>

        {hover && (
          <div className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-navy px-3 py-1.5 text-xs font-medium text-white shadow-lg">
            {counts.find((s) => s.key === hover).label}:{" "}
            <span className="font-bold text-gold">{counts.find((s) => s.key === hover).count}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {counts.map((seg) => (
          <button
            key={seg.key}
            onMouseEnter={() => setHover(seg.key)}
            onMouseLeave={() => setHover(null)}
            onClick={() => navigate(`/follow-ups`)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1 text-left transition hover:bg-slate-50"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="w-20 text-sm text-slate-600">{seg.label}</span>
            <span className="text-sm font-semibold text-navy">{seg.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function polarToCartesian(angleDeg, r) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function donutSlicePath(startDeg, endDeg) {
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  const outerStart = polarToCartesian(startDeg, R_OUTER);
  const outerEnd = polarToCartesian(endDeg, R_OUTER);
  const innerStart = polarToCartesian(endDeg, R_INNER);
  const innerEnd = polarToCartesian(startDeg, R_INNER);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${R_INNER} ${R_INNER} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}
