/**
 * The shapes the API returns, written down once. They mirror the backend's `to_primitives()` / `to_document()`
 * (src/<context>/domain/entities.py); when the backend changes a response, change it here and `npm run typecheck` shows
 * every place in src/lib that no longer fits. JavaScript files use them through JSDoc:
 *
 *   // @returns {Promise<import("./types").User>}  (written as a JSDoc block in the .js file)
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

/** A client record. `id` is a string like "c_<hex>" (older records: a number). `version` is the optimistic-lock counter. */
export interface Client {
  id: string | number;
  version: number;
  first: string;
  last: string;
  phone: string;
  email: string;
  telegram: string;
  referredBy: string;
  preferredContact: string;
  job: string;
  dateOfBirth: string;
  instagram: string;
  province: string;
  priority: "High" | "Medium" | "Low" | string;
  color: string;
  joined: ISODate | "";
  followUpDate: ISODate | "";
  nextFollowUp: string;
  lastContact: string;
  lastContactDate: ISODate | "";
  currentStage: string;
  interests: string[];
  stages: Record<string, { status: string; data: Record<string, unknown>; files: unknown[]; date?: string }>;
  meeting: { date: string; time?: string; googleEventId?: string } | null;
  files: unknown[];
  notes: { id: string; text: string; date: ISODate }[];
}

/** What a 409 on a client edit carries: the server's latest copy. */
export interface ClientConflict {
  error: string;
  client: Client;
}

export interface DailyState {
  doneTasks: Record<string, boolean>;
  groups: { id: string; name: string; color: string; memberIds: (string | number)[] }[];
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
  comments?: TicketComment[];
}

export interface PlanModule {
  key: string;
  name: string;
  description: string;
}

export interface Plan {
  id: number;
  key: string;
  name: string;
  /** One plain line. */
  description: string;
  /** The formatted description, already cleaned by the server to a fixed set of tags. The only HTML the app renders as HTML. */
  descriptionHtml?: string;
  /** Address of the plan's picture (served by the API); null when it has none. */
  logoUrl?: string | null;
  priceCents: number;
  currency: string;
  /** The older, coarse term label ("month", "year", "one_time", or ""). New code reads `accessDuration`. */
  interval: string;
  accessDuration?: AccessDuration;
  isDefault: boolean;
  modules: PlanModule[];
  includes?: PlanInclude[];
}

export interface PlansResponse {
  plans: Plan[];
  stripeConfigured: boolean;
  purchasesOpen: boolean;
}

/** How long one purchase of a plan grants access for. Exactly one of the numbers (or `until`) is set, matching `kind`. */
export interface AccessDuration {
  kind: "never" | "days" | "months" | "years" | "until_date";
  days: number | null;
  months: number | null;
  years: number | null;
  /** The last day of access, as a calendar date (YYYY-MM-DD), for `until_date`. */
  until: string | null;
}

/** What a plan includes beyond its modules, already in words. */
export interface PlanInclude {
  key: string;
  label: string;
  summary: string;
}

/** The state of the account's access, worked out by the server from its own records. */
export interface AccessSummary {
  status: "unlimited" | "valid" | "lapsing" | "lapsed";
  /** How loudly to warn: nothing, "soon", "urgent", or "ended". */
  warning: "none" | "soon" | "urgent" | "ended";
  endsAt: ISODateTime | null;
  /** Whole days left (0 on the last day); null when access has no end. */
  daysLeft: number | null;
  /** Whether access works right now (staff are never cut off, whatever the state says). */
  valid: boolean;
  warnDays: number;
}

/** GET /api/billing/me: which plan the account is on, which modules it unlocks, and exactly when its access ends. */
export interface BillingStatus {
  plan: Plan | null;
  status: "active" | "trialing" | "past_due" | "canceled" | string;
  moduleKeys: string[];
  /** When access ends (null: never). `currentPeriodEnd` is the same value under its older name. */
  accessEndsAt?: ISODateTime | null;
  currentPeriodEnd: ISODateTime | null;
  access?: AccessSummary | null;
}

/** One row of GET /api/billing/payments: a payment as our own ledger holds it. */
export interface Payment {
  id: number;
  date: ISODateTime;
  planName: string | null;
  /** The exact whole number of the currency's smallest unit (cents). */
  amountCents: number;
  currency: string;
  amountDisplay: string;
  status: "succeeded" | "pending" | "failed" | "refunded" | "expired" | string;
  /** A demo purchase made before payments were connected: no money moved, no receipt. */
  isMock: boolean;
  /** The access this payment bought (end null: it does not end); null when nothing was granted. */
  accessWindow: { start: ISODateTime; end: ISODateTime | null } | null;
  receiptNumber: string | null;
  receiptAvailable: boolean;
}

/** GET /api/billing/plans. */
export interface BillingPlans {
  plans: Plan[];
  stripeConfigured: boolean;
  /** False until payments are connected (and no demo mode): plans cannot be bought online yet. */
  purchasesOpen: boolean;
  /** The support contact for a customer who cannot buy online. From server configuration; empty if none is set. */
  supportEmail: string;
}

export interface PurchaseResponse {
  mock?: boolean;
  checkoutUrl?: string;
  subscription?: BillingStatus;
}

/** GET /api/billing/ai-usage: this billing period's AI allowance, in credits (never tokens). */
export interface AiUsage {
  plan: string | null;
  aiIncluded: boolean;
  unlimited: boolean;
  period: { start: ISODateTime; end: ISODateTime; resetsAt: ISODateTime };
  credits: { included: number; extra: number; total: number; used: number; inFlight: number; remaining: number } | null;
  percentUsed: number | null;
  warning: "exhausted" | "critical" | "high" | null;
  byFeature: { feature: string; label: string; calls: number; credits: number }[];
  wallet: { balanceCents: number };
  recentUsage: { feature: string; label: string; costCents: number; credits: number; createdAt: ISODateTime }[];
  restriction: { switchedOff: boolean; switchedOffMessage: string; disabled: boolean; disabledFeatures: string[] };
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

/** The body of an error response. Which fields exist depends on the endpoint; `code` and `actions` come from the AI gateway. */
export interface ErrorBody {
  error?: string;
  detail?: string;
  code?: string;
  actions?: ("top_up" | "upgrade" | "contact_support")[];
  [field: string]: unknown;
}

/** One page of a collection: the items, and the cursor to ask for the next page with (null on the last). */
export interface Page<T> {
  results: T[];
  nextCursor: string | null;
}

/** What a plan change would do (GET /api/billing/plan-change/preview): worked out by the server, the same assessment the change itself makes. */
export interface PlanChangeQuote {
  kind: "upgrade" | "downgrade";
  canChange: boolean;
  blockers: { code: string; message: string }[];
  fromPlan: { id: number; key: string; name: string; priceCents: number; currency: string } | null;
  toPlan: { id: number; key: string; name: string; priceCents: number; currency: string };
  /** Whole cents, from the server's own plan price. 0 means nothing is due. */
  amountDueCents: number;
  currency: string;
  currentAccessEndsAt: ISODateTime | null;
  newAccessEndsAt: ISODateTime | null;
  /** False when what the account already has lasts longer than the new plan's window would: the change buys features, not extra time. */
  addsTime: boolean;
  lost: { kind: string; key: string; label: string; was: string; becomes: string }[];
  overLimits: { key: string; label: string; limit: number; used: number }[];
}
