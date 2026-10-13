// The one place that says how a status looks. Every status is a label and a TONE; the tone says the colour, so "bad" is the same red on every screen
// and a status map is no longer copied into each page.

const TONES = {
  blue: { badge: "bg-av-blue/10 text-av-blue", dot: "bg-av-blue" },
  amber: { badge: "bg-av-amber/10 text-av-amber", dot: "bg-av-amber" },
  green: { badge: "bg-av-green/10 text-av-green", dot: "bg-av-green" },
  red: { badge: "bg-av-red/10 text-av-red", dot: "bg-av-red" },
  purple: { badge: "bg-av-purple/10 text-av-purple", dot: "bg-av-purple" },
  slate: { badge: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
};

/** The classes of a tone ({ badge, dot }); an unknown tone reads as slate. */
export function toneClasses(tone) {
  return TONES[tone] ?? TONES.slate;
}

const make = (table, fallback) => (key) => table[key] ?? table[fallback];

export const TICKET_STATUS = {
  open: { label: "Open", tone: "blue" },
  in_progress: { label: "In Progress", tone: "amber" },
  resolved: { label: "Resolved", tone: "green" },
  closed: { label: "Closed", tone: "slate" },
};
export const TICKET_TYPE = {
  bug: { label: "Bug", tone: "red" },
  feature: { label: "Feature", tone: "purple" },
};
export const DOCUMENT_STATUS = {
  pending: { label: "Pending review", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
};
export const BOOKING_REQUEST_STATUS = {
  pending: { label: "Pending", tone: "amber" },
  confirmed: { label: "Confirmed", tone: "green" },
  cancelled: { label: "Cancelled", tone: "slate" },
};

/** Each returns { label, tone } for a status; an unknown status reads as the table's first (the starting state). */
export const getTicketStatusMeta = make(TICKET_STATUS, "open");
export const getTicketTypeMeta = make(TICKET_TYPE, "bug");
export const getDocumentStatusMeta = make(DOCUMENT_STATUS, "pending");
export const getBookingRequestStatusMeta = make(BOOKING_REQUEST_STATUS, "pending");
/** A payment as our own ledger records it. */
export const PAYMENT_STATUS = {
  succeeded: { label: "Paid", tone: "green" },
  pending: { label: "Waiting for payment", tone: "amber" },
  failed: { label: "Failed", tone: "red" },
  expired: { label: "Not completed", tone: "slate" },
  refunded: { label: "Refunded", tone: "slate" },
};
/**
 * Not built with `make`, because the fallback is different in kind: a status our ledger adds later should show its own word in a neutral colour
 * rather than being reported as some known status it is not.
 */
export const paymentStatusMeta = (status) =>
  PAYMENT_STATUS[status] ?? { label: status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown", tone: "slate" };
