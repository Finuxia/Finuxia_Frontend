/**
 * How statuses look, in one place: a status has a label and a tone, and a tone is a colour treatment drawn from the brand
 * tokens in tailwind.config.js. Before this, the documents page and the booking-requests page each had their own copy of
 * the same map.
 */
import { CheckCircle2, Clock, XCircle } from "lucide-react";

/** Tone -> the classes of a pill (background + text). */
export const TONES = {
  blue: "bg-av-blue/10 text-av-blue",
  green: "bg-av-green/10 text-av-green",
  amber: "bg-av-amber/10 text-av-amber",
  red: "bg-av-red/10 text-av-red",
  purple: "bg-av-purple/10 text-av-purple",
  slate: "bg-slate-100 text-slate-500",
};

/** Tone -> the solid colour of a dot. */
export const DOTS = {
  blue: "bg-av-blue",
  green: "bg-av-green",
  amber: "bg-av-amber",
  red: "bg-av-red",
  purple: "bg-av-purple",
  slate: "bg-slate-400",
};

const meta = (label, tone, extra = {}) => ({ label, tone, badge: TONES[tone], dot: DOTS[tone], ...extra });

/** A booking request (the advisor's review queue). */
export const BOOKING_STATUS = {
  pending: meta("Pending", "amber"),
  confirmed: meta("Confirmed", "green"),
  cancelled: meta("Cancelled", "slate"),
};
export const bookingStatusMeta = (status) => BOOKING_STATUS[status] ?? BOOKING_STATUS.pending;

/** A submitted library document. */
export const DOCUMENT_STATUS = {
  pending: meta("Pending review", "amber", { icon: Clock }),
  approved: meta("Approved", "green", { icon: CheckCircle2 }),
  rejected: meta("Rejected", "red", { icon: XCircle }),
};
export const documentStatusMeta = (status) => DOCUMENT_STATUS[status] ?? DOCUMENT_STATUS.pending;

/** A support ticket's status and type. */
export const TICKET_STATUS = {
  open: meta("Open", "blue"),
  in_progress: meta("In Progress", "amber"),
  resolved: meta("Resolved", "green"),
  closed: meta("Closed", "slate"),
};
export const ticketStatusMeta = (status) => TICKET_STATUS[status] ?? TICKET_STATUS.open;

export const TICKET_TYPE = {
  bug: meta("Bug", "red"),
  feature: meta("Feature", "purple"),
};
export const ticketTypeMeta = (type) => TICKET_TYPE[type] ?? TICKET_TYPE.bug;

/** A payment as our own ledger records it. Anything new shows its own word, in a neutral colour. */
export const PAYMENT_STATUS = {
  succeeded: meta("Paid", "green"),
  pending: meta("Waiting for payment", "amber"),
  failed: meta("Failed", "red"),
  expired: meta("Not completed", "slate"),
  refunded: meta("Refunded", "slate"),
};
export const paymentStatusMeta = (status) =>
  PAYMENT_STATUS[status] ?? meta(status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown", "slate");
