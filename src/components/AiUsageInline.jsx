import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { warningMessage } from "../lib/aiUsage";

/** The inline warning at 80% / 95% / used-up for the advisor's AI credits, where AI is used. Renders nothing below 80%. */
export default function AiUsageInline({ usage, className = "" }) {
  const message = warningMessage(usage);
  if (!message) return null;
  const urgent = usage.warning === "critical" || usage.warning === "exhausted";
  return (
    <div
      role="status"
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
        urgent ? "border-av-red/40 bg-av-red/10 text-av-red" : "border-gold/40 bg-gold/10 text-gold-dark"
      } ${className}`}
    >
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <span className="flex-1">
        {message}{" "}
        <Link to="/profile?tab=ai-usage" className="font-semibold underline">
          See your AI usage
        </Link>
      </span>
    </div>
  );
}
