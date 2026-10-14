/**
 * Thin REST client for the Finuxia backend.
 * Base URL comes from VITE_API_URL (see .env). Auth is carried by httpOnly
 * cookies the server sets (JavaScript never sees the tokens); every request
 * sends them with `credentials: "include"`, and state-changing requests echo the
 * readable CSRF cookie in `X-CSRF-Token`.
 */
import { messageForStatus, parseRetryAfter } from "./apiErrors";
import { reportError } from "./errorReporting";

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");
const CSRF_COOKIE = "fx_csrf";
const LEGACY_TOKEN_KEY = "advisorpilot.token";

// Older versions kept the JWT in localStorage (readable by any script); drop it.
export function clearLegacyToken() {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

// Everything this app caches in the browser (client list, calendar events, tasks,
// groups…) is namespaced "advisorpilot." — wiped on logout / session expiry so the
// next person at a shared computer can't read the previous advisor's client data.
export function clearLocalData() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("advisorpilot."))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore storage errors
  }
}

function readCookie(name) {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

let onSessionExpired = () => {};
export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn || (() => {});
}

// One refresh at a time — concurrent 401s all wait on the same request.
let refreshing = null;
function refreshSession() {
  if (!refreshing) {
    refreshing = fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": readCookie(CSRF_COOKIE) },
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

const NO_REFRESH_PATHS = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/logout"];

// The id of the most recent API response (OPS-01 / OPS-08). The backend puts one on every log line
// for a request and returns it in X-Request-ID, so attaching it to a UI error report makes a
// frontend crash and its server-side cause one lookup instead of two unconnected facts.
//
// Deliberately only the most recent, not a history: it exists to answer "what was the app just
// doing when this broke", and a UI error almost always follows the request that caused it.
let lastResponseRequestId = "";

export function lastRequestId() {
  return lastResponseRequestId;
}

/** Testing seam. */
export function resetLastRequestId() {
  lastResponseRequestId = "";
}

// fetch + cookies + CSRF header, and one silent refresh-and-retry on a 401.
async function authedFetch(path, init = {}) {
  const send = async () => {
    const method = (init.method || "GET").toUpperCase();
    const headers = { ...(init.headers || {}) };
    if (method !== "GET" && method !== "HEAD") {
      const csrf = readCookie(CSRF_COOKIE);
      if (csrf) headers["X-CSRF-Token"] = csrf;
    }
    const response = await fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: "include" });
    // Every request in this client funnels through here, so this is the one place it needs doing.
    // Guarded because a network failure and some test doubles give a response with no headers.
    try {
      const id = response?.headers?.get?.("X-Request-ID");
      if (id) lastResponseRequestId = id;
    } catch {
      // A missing or exotic headers object is not worth failing a request over.
    }
    return response;
  };
  let res = await send();
  if (res.status === 401 && !NO_REFRESH_PATHS.some((p) => path.startsWith(p))) {
    if (await refreshSession()) {
      res = await send();
    } else {
      // The refresh can lose a race with another tab that rotated the cookie a
      // moment earlier; the browser now holds the new cookies, so try once more
      // before treating the session as over.
      res = await send();
      if (res.status === 401) onSessionExpired();
    }
  }
  return res;
}

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, data?: any, retryAfter?: number | null, path?: string }} [options]
   */
  constructor(message, { status, data, retryAfter = null, path = "" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    // Seconds the server asked us to wait (Retry-After on a 429), the machine-readable `code` it sent, and the request path.
    this.retryAfter = retryAfter;
    this.code = data?.code || "";
    this.path = path;
    // The parsed error body — e.g. a 409 on a client edit carries `client`, the server's latest copy.
    this.data = data;
    /** Set by the Google Calendar reads on a 409: the connection needs to be made again. @type {boolean | undefined} */
    this.needsReconnect = undefined;
  }
}

// DRF validation errors nest arbitrarily deep — a plain field is
// {field: ["msg"]}, but a list field (e.g. guestEmails) comes back keyed by
// index: {guestEmails: {"0": ["Enter a valid email address."]}}. Object.values
// alone stops one level too shallow and hands back that inner object itself,
// which stringifies to the literal text "[object Object]" in a toast — dig
// until an actual string is found instead.
function firstErrorMessage(data) {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = firstErrorMessage(item);
      if (found) return found;
    }
    return null;
  }
  if (data && typeof data === "object") {
    for (const value of Object.values(data)) {
      const found = firstErrorMessage(value);
      if (found) return found;
    }
    return null;
  }
  return null;
}

// The one place a refused response becomes an ApiError: the server's own sentence if it sent one (a sensible fallback
// per status if not), and the Retry-After wait on a 429 (see lib/apiErrors.js).
function apiErrorFrom(status, data, path, retryAfterHeader) {
  const retryAfter = parseRetryAfter(retryAfterHeader);
  const sent = data?.error || data?.detail || firstErrorMessage(data);
  return new ApiError(messageForStatus(status, sent, { retryAfter, path }), { status, data, retryAfter, path });
}

// The same, from a fetch Response whose body is not read yet (file downloads and previews).
async function apiErrorFromResponse(res, path) {
  let data = null;
  try {
    data = JSON.parse(await res.text());
  } catch {
    // not JSON
  }
  return apiErrorFrom(res.status, data, path, res.headers.get("Retry-After"));
}

/**
 * @param {string} path
 * @param {{ method?: string, body?: unknown, headers?: Record<string, string>, auth?: boolean }} [options]
 *   `auth` is ACCEPTED AND IGNORED. Several call sites pass `{ auth: false }` meaning "do not
 *   send credentials", and this function has never honoured it — every request sends
 *   `credentials: "include"` regardless. It is in this type only so those existing call sites
 *   type-check while the real question is settled on SCRUM-115: either make it work, or take it
 *   off the call sites. Do not add new uses of it.
 * @returns {Promise<any>} the parsed JSON body (null for a 204); the public methods below narrow it with their own return types.
 */
async function request(path, { method = "GET", body, headers: extraHeaders } = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };

  let res;
  try {
    res = await authedFetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the server. Is the backend running?", { status: 0 });
  }

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) throw apiErrorFrom(res.status, data, path, res.headers.get("Retry-After"));

  return data;
}

// Multipart (file upload) POST — no Content-Type header, so the browser sets
// the correct multipart boundary itself.
async function requestMultipart(path, formData) {
  let res;
  try {
    res = await authedFetch(path, { method: "POST", body: formData });
  } catch {
    throw new ApiError("Can't reach the server. Is the backend running?", { status: 0 });
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) throw apiErrorFrom(res.status, data, path, res.headers.get("Retry-After"));
  return data;
}

// Authenticated file download — fetches the bytes with the JWT header (a
// plain <a href> can't carry it), then triggers the browser's save dialog.
async function downloadFile(path, fallbackName) {
  let res;
  try {
    res = await authedFetch(path);
  } catch {
    throw new ApiError("Can't reach the server. Is the backend running?", { status: 0 });
  }
  if (!res.ok) throw await apiErrorFromResponse(res, path);

  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || fallbackName || "document.pdf";

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Authenticated fetch of a file as a blob object URL — for inline previews
// (an <iframe> can't send the JWT header, so it can't load the URL itself).
async function fetchBlobUrl(path) {
  let res;
  try {
    res = await authedFetch(path);
  } catch {
    throw new ApiError("Can't reach the server. Is the backend running?", { status: 0 });
  }
  if (!res.ok) throw await apiErrorFromResponse(res, path);
  return URL.createObjectURL(await res.blob());
}

// Multipart POST with upload-progress reporting — fetch() has no upload
// progress event, so this one path uses XMLHttpRequest instead.
function requestMultipartXHR(path, formData, onProgress) {
  const attempt = () => sendMultipartXHR(path, formData, onProgress);
  return attempt().catch(async (err) => {
    if (err.status !== 401) throw err;
    if (await refreshSession()) return attempt();
    // Same refresh-race allowance as authedFetch: one more try with the current cookies.
    return attempt().catch((retryErr) => {
      if (retryErr.status === 401) onSessionExpired();
      throw retryErr;
    });
  });
}

function sendMultipartXHR(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}${path}`);
    xhr.withCredentials = true;
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) xhr.setRequestHeader("X-CSRF-Token", csrf);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onerror = () => reject(new ApiError("Can't reach the server. Is the backend running?", { status: 0 }));
    xhr.onload = () => {
      let data = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(apiErrorFrom(xhr.status, data, path, xhr.getResponseHeader("Retry-After")));
      }
    };
    xhr.send(formData);
  });
}

// Multipart POST that comes back as a file (not JSON) — e.g. a generated PDF
// built server-side from uploaded documents. Combines requestMultipart's
// error handling with downloadFile's blob-save tail.
async function requestMultipartDownload(path, formData, fallbackName) {
  let res;
  try {
    res = await authedFetch(path, { method: "POST", body: formData });
  } catch {
    throw new ApiError("Can't reach the server. Is the backend running?", { status: 0 });
  }
  if (!res.ok) throw await apiErrorFromResponse(res, path);

  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || fallbackName || "document.pdf";

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** The page size the web app asks for (the server's own default; it caps what is asked at 200). */
export const PAGE_SIZE = 50;

/** `path` with the given query parameters; a parameter that is undefined, null or empty is left out. */
export function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

/**
 * One page of a collection, whichever way the server answers: the paginated shape ({ results, nextCursor }) or, from a server that does not
 * paginate yet, the whole plain list (which is then the only page). So the web app and the server can be deployed in either order.
 * @template T
 * @param {unknown} body
 * @returns {{ results: T[], nextCursor: string | null }}
 */
export function toPage(body) {
  if (Array.isArray(body)) return { results: body, nextCursor: null };
  const page = /** @type {{ results?: unknown, nextCursor?: string | null } | null | undefined} */ (body);
  return { results: Array.isArray(page?.results) ? page.results : [], nextCursor: page?.nextCursor || null };
}

// Lists `getAllPages` gave up on at its cap, so a screen can tell a partial list from a complete one. A WeakSet: the marker goes away with the list.
const incompleteLists = new WeakSet();
const markIncomplete = (list) => incompleteLists.add(list);
/** True for a list `getAllPages` returned only part of (it hit its page cap while the server still had more). */
export const isIncompleteList = (list) => Array.isArray(list) && incompleteLists.has(list);
const MAX_PAGES = 200;

export const api = {
  /**
   * One page of a collection (clients, tickets, ...): `getPage("/api/tickets", { cursor })`. Filters and sorting go in `params`.
   * @template T
   * @param {string} path
   * @param {{ limit?: number, cursor?: string | null, [filter: string]: unknown }} [params]
   * @returns {Promise<{ results: T[], nextCursor: string | null }>}
   */
  getPage: async (path, params = {}) => toPage(await request(withQuery(path, { limit: PAGE_SIZE, ...params }))),
  /**
   * Every page of a collection, one request at a time, for the places that need the whole set. `onPage(items, all)` is called after each page, so a
   * caller can show the first page while the rest arrive. Stops with what it has if `isCancelled()` turns true. A server that returns the whole list
   * at once is one page. The cap (`maxPages`, 200 pages = 10,000 items) is a guard against a cursor that never ends, not a limit anyone is expected to meet,
   * and meeting it is NOT silent: the list comes back marked (`isIncompleteList(list)`), the console gets an error and the error tracker an event. A
   * screen that genuinely needs more than that should page on demand with `usePagedList` and a Load more button instead.
   * @template T
   * @param {string} path
   * @param {{ [filter: string]: unknown }} [params]
   * @param {{ onPage?: (items: T[], all: T[]) => void, isCancelled?: () => boolean, maxPages?: number }} [options]
   * @returns {Promise<T[]>}
   */
  getAllPages: async (path, params = {}, { onPage, isCancelled = () => false, maxPages = MAX_PAGES } = {}) => {
    const all = [];
    let cursor = null;
    for (let page = 0; page < maxPages; page += 1) {
      const { results, nextCursor } = await api.getPage(path, { ...params, cursor });
      if (isCancelled()) return all;
      all.push(...results);
      onPage?.(results, all);
      if (!nextCursor) return all;
      cursor = nextCursor;
    }
    // The cap was reached and the server still had more: this list is NOT everything. It is returned (a partial list is more useful than none) but
    // marked, so a screen can say so (`isIncompleteList`), and it is reported where someone will see it.
    markIncomplete(all);
    const error = new Error(
      `${path}: stopped after ${maxPages} pages (${all.length} items) and the server still had more. The list is incomplete.`
    );
    console.error(error.message);
    reportError(error, { errorId: "list-incomplete" });
    return all;
  },

  // auth
  register: (payload) => request("/api/auth/register", { method: "POST", body: payload }),
  login: (identifier, password) => request("/api/auth/login", { method: "POST", body: { identifier, password } }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),
  updateMe: (patch) => request("/api/auth/me", { method: "PATCH", body: patch }),
  updateComplianceProfile: (patch) => request("/api/auth/me/compliance-profile", { method: "PATCH", body: patch }),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append("file", file);
    return requestMultipart("/api/auth/me/avatar", form);
  },
  deleteAvatar: () => request("/api/auth/me/avatar", { method: "DELETE" }),
  avatarUrl: (userId) => `${BASE_URL}/api/auth/avatar/${userId}`,
  forgotPassword: (email) => request("/api/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (uid, token, password) => request("/api/auth/reset-password", { method: "POST", body: { uid, token, password } }),
  changePassword: (currentPassword, newPassword) =>
    request("/api/auth/change-password", { method: "POST", body: { currentPassword, newPassword } }),
  verifyEmail: (uid, token) => request("/api/auth/verify-email", { method: "POST", body: { uid, token } }),
  resendVerification: () => request("/api/auth/resend-verification", { method: "POST" }),

  // clients (owner-scoped collection sync)
  getClients: () => request("/api/clients"),
  /** One page of the advisor's clients, with the server's filters and sort: q, priority, province, stage, followUpDue, sort (-last, joined, ...). */
  getClientsPage: (params) => api.getPage("/api/clients", params),
  createClient: (client) => request("/api/clients", { method: "POST", body: client }),
  patchClient: (ref, body) => request(`/api/clients/${encodeURIComponent(ref)}`, { method: "PATCH", body }),
  deleteClient: (ref) => request(`/api/clients/${encodeURIComponent(ref)}`, { method: "DELETE" }),
  importClients: (clients) => request("/api/clients/import", { method: "POST", body: { clients } }),

  // per-user daily-task state
  getState: () => request("/api/state"),
  putState: (doneTasks) => request("/api/state", { method: "PUT", body: { doneTasks } }),
  putGroups: (groups) => request("/api/state", { method: "PUT", body: { groups } }),

  // tutorial / help content (managed from the Django admin panel)
  getGuides: () => request("/api/guides", { auth: false }),

  // advisor presentations (metadata; PDFs uploaded via admin)
  getPresentations: () => request("/api/presentations"),
  // Authenticated downloads (cookie + silent refresh); the PDFs are part of a paid plan.
  downloadPresentationPdf: (slug, fallbackName) => downloadFile(`/api/presentations/${encodeURIComponent(slug)}/pdf`, fallbackName),
  downloadPresentationVariantPdf: (slug, variantId, fallbackName) =>
    downloadFile(`/api/presentations/${encodeURIComponent(slug)}/variants/${encodeURIComponent(variantId)}/pdf`, fallbackName),

  // support tickets (bug reports / feature requests) — own tickets only;
  // status changes and admin replies happen in the Django admin panel.
  getTickets: () => request("/api/tickets"),
  getTicket: (id) => request(`/api/tickets/${id}`),
  createTicket: (payload) => request("/api/tickets", { method: "POST", body: payload }),
  addTicketComment: (id, message) => request(`/api/tickets/${id}/comments`, { method: "POST", body: { message } }),

  // reminders / to-do list (owner-scoped, never touches meetings/analytics)
  /** Every reminder (read a page at a time; the server never has to build the whole list in one response). */
  getReminders: () => api.getAllPages("/api/reminders"),
  createReminder: (payload) => request("/api/reminders", { method: "POST", body: payload }),
  updateReminder: (id, patch) => request(`/api/reminders/${id}`, { method: "PATCH", body: patch }),
  deleteReminder: (id) => request(`/api/reminders/${id}`, { method: "DELETE" }),
  deleteReminderSeries: (seriesId) => request(`/api/reminders/series/${encodeURIComponent(seriesId)}`, { method: "DELETE" }),
  setReminderStatus: (id, status) => request(`/api/reminders/${id}/status`, { method: "POST", body: { status } }),

  // Automated follow-ups — a per-client rule ("keep emailing them every N
  // days, AI-drafted, until I turn it off"). Sending itself stays a no-op
  // server-side until real SMTP credentials are configured.
  getFollowUpRule: (clientRef) => request(`/api/followups/rules/${encodeURIComponent(clientRef)}`),
  setFollowUpRule: (clientRef, payload) =>
    request(`/api/followups/rules/${encodeURIComponent(clientRef)}`, { method: "PUT", body: payload }),

  // Google Drive (server-held OAuth) — per-advisor connect status + client folders
  getDriveConnectUrl: (nextPath) => request(`/api/drive/connect${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`),
  getDriveStatus: () => request("/api/drive/status"),
  disconnectDrive: () => request("/api/drive/disconnect", { method: "POST" }),
  setDriveRootFolder: (folder) => request("/api/drive/root-folder", { method: "PUT", body: { folder } }),
  resetDriveRootFolder: () => request("/api/drive/root-folder", { method: "DELETE" }),
  openClientDriveFolder: (clientRef, displayName) =>
    request(`/api/drive/clients/${encodeURIComponent(clientRef)}/folder`, {
      method: "POST",
      body: { displayName },
    }),
  // Uploads straight into the client's Drive folder (find-or-created the
  // same way as openClientDriveFolder) and, if the client has an email on
  // file, notifies them it's there.
  uploadClientDriveFile: (clientRef, { displayName, clientEmail, file }) => {
    const form = new FormData();
    form.append("displayName", displayName);
    if (clientEmail) form.append("clientEmail", clientEmail);
    form.append("file", file);
    return requestMultipart(`/api/drive/clients/${encodeURIComponent(clientRef)}/files`, form);
  },

  // Client documents — browse/download approved ones, submit new ones for
  // admin review, and get an AI-suggested topic/summary/keywords for a PDF
  // before submitting.
  getDocuments: () => request("/api/documents"),
  /** Every document the advisor submitted, read a page at a time. */
  getMyDocuments: () => api.getAllPages("/api/documents/mine"),
  submitDocument: ({ title, summary, keywords, file }) => {
    const form = new FormData();
    form.append("title", title);
    form.append("summary", summary);
    form.append("keywords", JSON.stringify(keywords || []));
    form.append("file", file);
    return requestMultipart("/api/documents", form);
  },
  suggestDocument: (file) => {
    const form = new FormData();
    form.append("file", file);
    return requestMultipart("/api/documents/suggest", form);
  },
  downloadDocument: (id, fallbackName) => downloadFile(`/api/documents/${id}/file`, fallbackName),

  // Sales Package Prep (Advisor Assistant) — a 6-step wizard whose draft
  // state is persisted server-side (so it survives navigating away and
  // back), plus master data (companies/products/funds) driving the
  // dropdowns and a final generate step that merges a cover/summary page +
  // AI-drafted Reason Why Letter + the 6 uploaded documents into one PDF.
  getSalesPackageCompanies: () => request("/api/sales-packages/companies"),
  getSalesPackageProducts: (companyId) => request(`/api/sales-packages/companies/${companyId}/products`),
  getSalesPackageFunds: (companyId, investmentType) =>
    request(`/api/sales-packages/companies/${companyId}/funds?investmentType=${encodeURIComponent(investmentType)}`),

  /** Every sales package of the advisor, read a page at a time. */
  getSalesPackages: () => api.getAllPages("/api/sales-packages/packages"),
  createSalesPackage: () => request("/api/sales-packages/packages", { method: "POST" }),
  getSalesPackage: (id) => request(`/api/sales-packages/packages/${id}`),
  saveSalesPackageDraft: (id, data, version) =>
    request(`/api/sales-packages/packages/${id}`, { method: "PUT", body: version ? { data, version } : { data } }),
  deleteSalesPackage: (id) => request(`/api/sales-packages/packages/${id}`, { method: "DELETE" }),
  uploadSalesPackageDocument: (id, docKey, file, onProgress) => {
    const form = new FormData();
    form.append("file", file);
    return requestMultipartXHR(`/api/sales-packages/packages/${id}/documents/${docKey}`, form, onProgress);
  },
  previewSalesPackageDocument: (id, docKey) => fetchBlobUrl(`/api/sales-packages/packages/${id}/documents/${docKey}`),
  downloadReasonWhyLetterPdf: (id) =>
    downloadFile(`/api/sales-packages/packages/${id}/documents/reasonWhyLetter?as=pdf`, "Reason_Why_Letter.pdf"),
  downloadSalesPackageDocument: (id, docKey, fallbackName, generated = false) =>
    downloadFile(`/api/sales-packages/packages/${id}/documents/${docKey}${generated ? "?source=generated" : ""}`, fallbackName),
  confirmSalesPackage: (id) => request(`/api/sales-packages/packages/${id}/confirm`, { method: "POST" }),
  draftReasonWhyLetter: (id) => request(`/api/sales-packages/packages/${id}/reason-why-letter`, { method: "POST" }),
  saveReasonWhyLetter: (id, text, version) =>
    request(`/api/sales-packages/packages/${id}/reason-why-letter`, { method: "PUT", body: version ? { text, version } : { text } }),
  generateAgentDisclosure: (id) => request(`/api/sales-packages/packages/${id}/agent-disclosure`, { method: "POST" }),
  generateSupervisionForm: (id, confirmations) =>
    request(`/api/sales-packages/packages/${id}/supervision-form`, { method: "POST", body: confirmations }),
  generateSalesPackage: (id, fallbackName) =>
    requestMultipartDownload(`/api/sales-packages/packages/${id}/generate`, new FormData(), fallbackName),

  // Billing / subscription plans — modules, plans, purchase (real Stripe
  // Checkout once configured, an instant "mock" purchase until then).
  /** @returns {Promise<import("./types").BillingPlans>} */
  getBillingPlans: () => request("/api/billing/plans"),
  getMyBillingStatus: () => request("/api/billing/me"),
  // The advisor's AI use this billing period, in credits: used / remaining, when they start again, what each feature used, the wallet and the
  // recent calls, a warning level and, when the account cannot pay for the next AI action, the blocked state with the ways out.
  getAiUsage: () => request("/api/billing/ai-usage"),
  // Adds credit to the AI wallet. The key makes a double click or a retry after a slow reply act once (SEC-08); the return pages are ours.
  topUpWallet: (amountCents, idempotencyKey) =>
    request("/api/billing/wallet/topup", {
      method: "POST",
      body: {
        amountCents,
        successUrl: `${window.location.origin}/profile?tab=ai-usage&topup=success`,
        cancelUrl: `${window.location.origin}/profile?tab=ai-usage&topup=canceled`,
      },
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    }),
  // "I do not intend to continue" (true takes it back). Only a statement: it changes no access, plan or feature, charges nothing, and
  // can be reversed until access ends; the answer is the billing status.
  setContinueIntent: (willContinue) => request("/api/billing/intent", { method: "PUT", body: { willContinue } }),
  // What changing to this plan would do, worked out by the server from its own prices before anything happens (BIL-11): the kind, the amount due
  // now, the new access end, what would be lost, which limits the account is over, and whether the change is allowed at all.
  /** @param {number} planId @returns {Promise<import("./types").PlanChangeQuote>} */
  previewPlanChange: (planId) => request(`/api/billing/plan-change/preview?planId=${encodeURIComponent(planId)}`),
  // Makes the change the customer saw and confirmed. The amount they were shown is sent back and checked by the server (a changed price is a 409
  // `quote_changed` with the new quote); the key makes a double click or a retry after a slow reply act once.
  /** @param {number} planId @param {{ expectedAmountCents: number, expectedCurrency: string }} seen @param {string} [idempotencyKey] */
  changePlan: (planId, { expectedAmountCents, expectedCurrency }, idempotencyKey) =>
    request("/api/billing/plan-change", {
      method: "POST",
      body: { planId, expectedAmountCents, expectedCurrency },
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    }),
  // Nothing about where to return, and nothing about the amount, is sent from here: the server builds the return pages from its own
  // configuration and always charges the plan's own price. It still accepts a successUrl from an older bundle and ignores it for a
  // purchase, so sending one was only dead weight. The idempotency key (SEC-08) stays: it makes a double click, or a retry after a slow
  // reply, act once instead of leaving a second pending payment behind.
  /** @param {number} planId @param {string} [idempotencyKey] @returns {Promise<import("./types").PurchaseResponse>} */
  purchasePlan: (planId, idempotencyKey) =>
    request("/api/billing/purchase", {
      method: "POST",
      body: { planId },
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    }),
  // The receipt (a PDF made by the server) of one of the customer's own payments that succeeded; saved through the browser's download.
  /** @param {number} paymentId @param {string} [fallbackName] */
  downloadReceipt: (paymentId, fallbackName) => downloadFile(`/api/billing/payments/${paymentId}/receipt`, fallbackName || "receipt.pdf"),

  // Booking (Calendly-style) — an advisor's shared availability, their
  // (possibly several) named booking links, and the request queue are all
  // authenticated; the /public/* endpoints power the client-facing page.
  getBookingAvailability: () => request("/api/booking/availability"),
  updateBookingAvailability: (payload) => request("/api/booking/availability", { method: "PUT", body: payload }),

  getBookingLinks: () => request("/api/booking/links"),
  createBookingLink: (payload) => request("/api/booking/links", { method: "POST", body: payload }),
  updateBookingLink: (id, payload) => request(`/api/booking/links/${id}`, { method: "PATCH", body: payload }),
  deleteBookingLink: (id) => request(`/api/booking/links/${id}`, { method: "DELETE" }),

  /** Every booking request, read a page at a time. */
  getBookingRequests: () => api.getAllPages("/api/booking/requests"),
  approveBookingRequest: (id) => request(`/api/booking/requests/${id}/approve`, { method: "POST" }),
  cancelBookingRequest: (id) => request(`/api/booking/requests/${id}/cancel`, { method: "POST" }),
  rescheduleBookingRequest: (id, date, time) => request(`/api/booking/requests/${id}/reschedule`, { method: "POST", body: { date, time } }),
  setBookingRequestGoogleEvent: (id, googleEventId) =>
    request(`/api/booking/requests/${id}/google-event`, { method: "PUT", body: { googleEventId } }),

  // Server-side Calendar connection (see src.calendar_connect) — separate
  // from the browser-held one; this is what lets a booking auto-confirm and
  // land on the advisor's calendar instantly, no one logged in required.
  getCalendarConnectUrl: (nextPath) => request(`/api/calendar-connect/connect${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`),
  getCalendarConnectStatus: () => request("/api/calendar-connect/status"),
  disconnectCalendarConnect: () => request("/api/calendar-connect/disconnect", { method: "POST" }),

  // Calendar event data — proxied through the server-side connection above,
  // so the browser never needs its own Google token/login at all.
  /** @param {{ timeMin?: string, timeMax?: string, maxResults?: number }} [params] */
  getCalendarEvents: ({ timeMin, timeMax, maxResults } = {}) => {
    const params = new URLSearchParams();
    if (timeMin) params.set("timeMin", timeMin);
    if (timeMax) params.set("timeMax", timeMax);
    if (maxResults) params.set("maxResults", String(maxResults));
    const qs = params.toString();
    return request(`/api/calendar-connect/events${qs ? `?${qs}` : ""}`);
  },
  createCalendarEvent: ({ summary, description, startISO, endISO, clientId, attendees }) =>
    request("/api/calendar-connect/events", {
      method: "POST",
      body: { summary, description, startISO, endISO, clientId, attendees },
    }),
  updateCalendarEvent: (eventId, patch) =>
    request(`/api/calendar-connect/events/${encodeURIComponent(eventId)}`, { method: "PATCH", body: patch }),
  deleteCalendarEvent: (eventId) => request(`/api/calendar-connect/events/${encodeURIComponent(eventId)}`, { method: "DELETE" }),
  queryCalendarFreeBusy: (timeMin, timeMax) => request("/api/calendar-connect/freebusy", { method: "POST", body: { timeMin, timeMax } }),

  // Server-side Zoom connection (see src.zoom_connect) — same shape as the
  // Calendar connection above; only needed when a booking link's location
  // is set to Zoom.
  getZoomConnectUrl: (nextPath) => request(`/api/zoom-connect/connect${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`),
  getZoomStatus: () => request("/api/zoom-connect/status"),
  disconnectZoom: () => request("/api/zoom-connect/disconnect", { method: "POST" }),

  getPublicBookingInfo: (slug) => request(`/api/booking/public/${encodeURIComponent(slug)}`, { auth: false }),
  getPublicBookingSlots: (slug, date, viewerTz) =>
    request(
      `/api/booking/public/${encodeURIComponent(slug)}/slots?date=${encodeURIComponent(date)}${
        viewerTz ? `&viewerTz=${encodeURIComponent(viewerTz)}` : ""
      }`,
      { auth: false }
    ),
  requestBooking: (slug, payload) => request(`/api/booking/public/${encodeURIComponent(slug)}/request`, { method: "POST", body: payload }),
};

// The full shareable link for an advisor's booking page.
export function bookingPublicUrl(slug) {
  return `${window.location.origin}/book/${encodeURIComponent(slug)}`;
}

export { BASE_URL };
