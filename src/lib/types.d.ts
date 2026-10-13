/**
 * The shapes the API returns, written down once. They mirror the backend's `to_primitives()` (src/<context>/domain/entities.py); when the backend
 * changes a response, change it here and `npm run typecheck` shows every place in src/lib that no longer fits. Only shapes that were checked against the
 * backend are here; the rest of the API is typed as `any` until it is. JavaScript files use these through JSDoc:
 *
 *   @returns {Promise<import("./types").Ticket>}   (inside a JSDoc block above the method)
 */

export type ISODateTime = string;
export type ISODate = string; // "2026-01-31"

/** The signed-in advisor (GET /api/auth/me → { user }). */
export interface User {
  id: number;
  name: string;
  email: string;
  username: string;
  subscriptionUntil: ISODateTime | null;
  subscriptionActive: boolean;
  emailVerified: boolean;
  hasAvatar: boolean;
  licensedProvinces: string[];
  quebecSectors: string[];
  companiesRepresented: string[];
  supervisorRequired: boolean;
  supervisorName: string;
  supervisorTitle: string;
  supervisorEmail: string;
  supervisorPhone: string;
  agencyName: string;
  professionalTitle: string;
  businessEmail: string;
  businessPhone: string;
  agentCode: string;
  businessBranchName: string;
  licenceNumbers: string;
  ownershipRelationship: string;
  compensationModel: string;
  additionalCompensationEligible: boolean;
  standingDisclosure: string;
}

export interface SessionResponse {
  user: User;
}

/**
 * A client record. It is stored as a JSON document, so only what the sync depends on is written down: `id` (a string like "c_<hex>"; older records:
 * a number) and `version`, the optimistic-lock counter a PATCH must send back.
 */
export interface Client {
  id: string | number;
  version: number;
  [field: string]: unknown;
}

/** What a 409 on a client edit carries: the server's latest copy. */
export interface ClientConflict {
  error: string;
  client: Client;
}

/** GET /api/state. */
export interface DailyState {
  doneTasks: Record<string, boolean>;
  groups: unknown[];
}

export interface Reminder {
  id: number;
  title: string;
  note: string;
  dueDate: ISODate | null;
  dueTime: string | null;
  status: "pending" | "completed";
  clientRef: string | null;
  repeat: "none" | "daily" | "every_other_day" | "weekly" | "monthly";
  seriesId: string | null;
  kind: "reminder" | "followup";
  createdAt: ISODateTime | null;
  completedAt: ISODateTime | null;
}

export interface TicketComment {
  id: number;
  authorName: string;
  isAdmin: boolean;
  message: string;
  createdAt: ISODateTime | null;
}

export interface Ticket {
  id: number;
  type: "bug" | "feature";
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  reporterName: string;
  createdAt: ISODateTime | null;
  updatedAt: ISODateTime | null;
  commentCount: number;
  /** Only on a single ticket (GET /api/tickets/<id>). */
  comments?: TicketComment[];
}

export interface FollowUpRule {
  clientRef: string;
  enabled: boolean;
  frequency: "weekly" | "biweekly" | "monthly";
  tone: "friendly" | "professional" | "reminder";
  lastSentAt: ISODateTime | null;
}

export interface Document {
  id: number;
  title: string;
  summary: string;
  keywords: string[];
  fileName: string;
  uploadedByName: string;
  status: "pending" | "approved" | "rejected";
  rejectionNote: string;
  createdAt: ISODateTime | null;
  reviewedAt: ISODateTime | null;
}

/** One page of a long list (GET /api/tickets?limit=50&cursor=...). Which fields come back depends on the endpoint. */
export interface Page<T> {
  results: T[];
  nextCursor: string | null;
}

/** The body of an error response. Which fields exist depends on the endpoint; `code` and `actions` come from the AI gateway. */
export interface ErrorBody {
  error?: string;
  detail?: string;
  code?: string;
  actions?: ("top_up" | "upgrade")[];
  [field: string]: unknown;
}
