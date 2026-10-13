import { toneClasses } from "../../lib/statusMeta";

/**
 * A small pill. The colour comes from a named tone (see lib/statusMeta.js) so the same meaning is always the same colour:
 *
 *   <Badge tone="green">Approved</Badge>
 *   <Badge meta={getTicketStatusMeta(ticket.status)} />      // a { label, tone } from statusMeta
 */
export default function Badge({ tone = "slate", meta, size = "md", className = "", children }) {
  const useTone = meta?.tone ?? tone;
  const sizes = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizes} ${toneClasses(useTone).badge} ${className}`}>
      {children ?? meta?.label}
    </span>
  );
}
