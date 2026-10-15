import { http, HttpResponse } from "msw";

export const API = "http://api.test";

// The user the default handlers sign in as.
export const testUser = {
  id: 1,
  name: "Test Advisor",
  email: "advisor@example.com",
  username: "advisor",
  hasAvatar: false,
  subscriptionActive: true,
};

export const testBilling = {
  plan: { key: "professional", name: "Professional" },
  status: "active",
  moduleKeys: ["sales_package_prep", "documents"],
  accessEndsAt: null,
  currentPeriodEnd: null,
  access: { status: "unlimited", warning: "none", endsAt: null, daysLeft: null, valid: true, warnDays: 14 },
};

const packageDocumentKeys = [
  "agentDisclosureForm",
  "reasonWhyLetter",
  "fna",
  "financialStrategy",
  "illustration1",
  "illustration2",
  "supervisionForm",
];

// Defaults every test starts from: a signed-in advisor with no clients. A test overrides what it cares
// about with `server.use(http.get(...))`; anything it does not override still answers, so a component never
// hits a real network (an unhandled request fails the test, see setup.js).
export const defaultHandlers = [
  http.get(`${API}/api/auth/me`, () => HttpResponse.json({ user: testUser })),
  http.get(`${API}/api/billing/me`, () => HttpResponse.json(testBilling)),
  http.get(`${API}/api/clients`, () => HttpResponse.json([])),
  http.get(`${API}/api/state`, () => HttpResponse.json({ doneTasks: {}, groups: [] })),
  // What the layout and the providers ask for on every page.
  http.get(`${API}/api/billing/ai-usage`, () =>
    HttpResponse.json({
      aiIncluded: true,
      mode: "unlimited",
      period: null,
      credits: { included: null, extra: 0, total: null, used: 0, inFlight: 0, remaining: null },
      percentUsed: null,
      warning: null,
      blocked: null,
      byFeature: [],
      wallet: { balanceCents: 1000 },
      recentUsage: [],
    })
  ),
  http.get(`${API}/api/billing/payments`, () => HttpResponse.json({ results: [], nextCursor: null })),
  http.get(`${API}/api/followups/rules/:ref`, ({ params }) =>
    HttpResponse.json({ clientRef: params.ref, enabled: false, frequency: "monthly", tone: "friendly" })
  ),
  http.put(`${API}/api/state`, () => HttpResponse.json({})),
  http.get(`${API}/api/billing/plans`, () => HttpResponse.json({ plans: [], stripeConfigured: false, purchasesOpen: true })),
  http.get(`${API}/api/sales-packages/companies`, () => HttpResponse.json([])),
  http.get(`${API}/api/sales-packages/companies/:id/products`, () => HttpResponse.json([])),
  // Uploaded package previews are binary PDF responses (not JSON status objects).
  ...packageDocumentKeys.map((docKey) =>
    http.get(
      `${API}/api/sales-packages/packages/:packageId/documents/${docKey}`,
      () =>
        new HttpResponse("%PDF-1.7\n% Finuxia test preview\n", {
          headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="preview.pdf"' },
        })
    )
  ),
  http.get(`${API}/api/tickets`, () => HttpResponse.json([])),
  http.get(`${API}/api/reminders`, () => HttpResponse.json([])),
  http.get(`${API}/api/booking/requests`, () => HttpResponse.json([])),
  http.get(`${API}/api/calendar-connect/status`, () =>
    HttpResponse.json({ configured: true, connected: false, status: "disconnected", googleEmail: null })
  ),
  http.get(`${API}/api/drive/status`, () => HttpResponse.json({ connected: false, status: "disconnected", googleEmail: null })),
  http.get(`${API}/api/zoom-connect/status`, () => HttpResponse.json({ connected: false, status: "disconnected", googleEmail: null })),
  http.post(`${API}/api/auth/logout`, () => new HttpResponse(null, { status: 204 })),
];
