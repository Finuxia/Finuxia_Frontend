export const TICKET_STATUS_META = {
  open: { label: "Open", badge: "bg-av-blue/10 text-av-blue", dot: "bg-av-blue" },
  in_progress: { label: "In Progress", badge: "bg-av-amber/10 text-av-amber", dot: "bg-av-amber" },
  resolved: { label: "Resolved", badge: "bg-av-green/10 text-av-green", dot: "bg-av-green" },
  closed: { label: "Closed", badge: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
};

export function getTicketStatusMeta(status) {
  return TICKET_STATUS_META[status] ?? TICKET_STATUS_META.open;
}

export const TICKET_TYPE_META = {
  bug: { label: "Bug", badge: "bg-av-red/10 text-av-red" },
  feature: { label: "Feature", badge: "bg-av-purple/10 text-av-purple" },
};

export function getTicketTypeMeta(type) {
  return TICKET_TYPE_META[type] ?? TICKET_TYPE_META.bug;
}
