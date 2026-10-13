import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PIPELINE_STAGES } from "../lib/pipeline";

const ROW_H = 30;
const LABEL_W = 108;
const BAR_H = 16;
const AXIS_TICKS = 4;

export default function PipelineBarChart({ clients, onSelectStage }) {
  const navigate = useNavigate();
  const [hover, setHover] = useState(null);

  const counts = PIPELINE_STAGES.map((stage) => ({
    stage,
    count: clients.filter((c) => c.currentStage === stage.id).length,
  }));

  const rows = counts.length;
  const CHART_H = rows * ROW_H + 16; // +16 for the axis-label row
  const maxRaw = Math.max(...counts.map((c) => c.count), 1);
  const niceMax = niceCeiling(maxRaw);
  const selectStage = (stageId) => (onSelectStage ? onSelectStage(stageId) : navigate(`/clients?stage=${stageId}`));

  return (
    <div className="relative">
      <svg viewBox={`0 0 560 ${CHART_H}`} className="w-full" role="img" aria-label="Client count by pipeline stage">
        {/* gridlines */}
        {Array.from({ length: AXIS_TICKS + 1 }).map((_, i) => {
          const x = LABEL_W + 4 + ((560 - LABEL_W - 40) / AXIS_TICKS) * i;
          const value = Math.round((niceMax / AXIS_TICKS) * i);
          return (
            <g key={i}>
              <line x1={x} y1={4} x2={x} y2={CHART_H - 4} stroke="#eef0f3" strokeWidth="1" />
              <text x={x} y={CHART_H - 4} dy={12} fontSize="9" fill="#94a3b8" textAnchor="middle">
                {value}
              </text>
            </g>
          );
        })}

        {counts.map(({ stage, count }, i) => {
          const y = i * ROW_H + (ROW_H - BAR_H) / 2;
          const trackX = LABEL_W + 4;
          const trackW = 560 - LABEL_W - 40;
          const barW = niceMax === 0 ? 0 : (count / niceMax) * trackW;
          const isHover = hover === stage.id;

          return (
            <g
              key={stage.id}
              onMouseEnter={() => setHover(stage.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => selectStage(stage.id)}
              className="cursor-pointer"
            >
              <rect x={0} y={i * ROW_H} width={560} height={ROW_H} fill={isHover ? "#f8fafc" : "transparent"} />
              <text x={LABEL_W - 8} y={i * ROW_H + ROW_H / 2} dy={3.5} fontSize="11" textAnchor="end" fill="#475569">
                {stage.short}
              </text>
              <rect x={trackX} y={y} width={trackW} height={BAR_H} rx={4} fill="#f1f5f9" />
              {barW > 0 && (
                <rect
                  x={trackX}
                  y={y}
                  width={Math.max(barW, 6)}
                  height={BAR_H}
                  rx={4}
                  fill={isHover ? "#a8873a" : "#c9a84c"}
                  className="transition-all duration-300"
                />
              )}
              <text x={trackX + Math.max(barW, 6) + 8} y={i * ROW_H + ROW_H / 2} dy={3.5} fontSize="11" fontWeight="600" fill="#0f1c2e">
                {count}
              </text>
            </g>
          );
        })}
      </svg>

      {hover &&
        (() => {
          const idx = counts.findIndex((c) => c.stage.id === hover);
          const { stage, count } = counts[idx];
          const topPct = ((idx + 0.5) / counts.length) * 100;
          return (
            <div
              className="pointer-events-none absolute right-2 -translate-y-1/2 rounded-lg bg-navy px-3 py-1.5 text-xs font-medium text-white shadow-lg"
              style={{ top: `${topPct}%` }}
            >
              {stage.label}: <span className="font-bold text-gold">{count}</span>
            </div>
          );
        })()}
    </div>
  );
}

function niceCeiling(value) {
  if (value <= 4) return 4;
  if (value <= 8) return 8;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const residual = value / magnitude;
  const niceResidual = residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return niceResidual * magnitude;
}
