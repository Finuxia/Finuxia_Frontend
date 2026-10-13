import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Things that were removed on purpose and must not creep back (vitest runs from the project root).
const read = (path) => readFileSync(path, "utf8");

describe("removed dead code stays removed", () => {
  it("the demo client dataset (fabricated personal data) is not in the source", () => {
    expect(existsSync("src/data/demoClients.js")).toBe(false);
  });

  it("the unread VITE_GOOGLE_CLIENT_ID is in no config or documentation", () => {
    for (const file of [".env.example", ".env.production", "README.md", "Dockerfile", ".github/workflows/ci.yml"]) {
      expect(read(file), file).not.toContain("VITE_GOOGLE_CLIENT_ID");
    }
  });

  // Every environment variable the source reads, and nothing else. The list is exact on purpose:
  // the failure this catches is a variable being read in code and never documented, so nobody
  // setting up an environment knows it exists. Adding one here is fine; adding one here WITHOUT
  // adding it to .env.example fails the next test.
  const EXPECTED_ENV_VARS = [
    "VITE_API_URL",
    // Error tracking (OPS-01). All four are inert when VITE_SENTRY_DSN is empty.
    "VITE_SENTRY_DSN",
    "VITE_SENTRY_ENVIRONMENT",
    "VITE_SENTRY_RELEASE",
    "VITE_SENTRY_TRACES_SAMPLE_RATE",
  ];

  const envVarsReadBySource = () => {
    const found = new Set();
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const path = `${dir}/${name}`;
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(jsx?|mjs)$/.test(name) && !/\.test\./.test(name))
          for (const m of read(path).matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)) found.add(m[1]);
      }
    };
    walk("src");
    return [...found];
  };

  it("no source file reads an environment variable outside the known list", () => {
    expect(envVarsReadBySource().sort()).toEqual([...EXPECTED_ENV_VARS].sort());
  });

  it("every environment variable the source reads is documented in .env.example", () => {
    const example = read(".env.example");
    for (const name of envVarsReadBySource()) {
      expect(example, `${name} is read in src/ but missing from .env.example`).toContain(name);
    }
  });

  it("the layout uses no utility class that Tailwind has no definition for (scrollbar-none)", () => {
    expect(read("src/components/layout/Layout.jsx")).not.toContain("scrollbar-none");
  });

  // (A plan change is back as BIL-11: our own local transition, priced by us, not a subscription held at the provider, so previewPlanChange / changePlan
  // and /api/billing/plan-change are no longer on this list.)
  it("nothing in the web app still talks to a provider-held subscription (BIL-09: plans are one-time purchases we record ourselves)", () => {
    const gone = ["openBillingPortal", "getInvoices", "cancelScheduledPlanChange", "cancelSubscription", "reactivateSubscription"];
    const found = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const path = `${dir}/${name}`;
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(jsx?|ts)$/.test(name) && !/\.test\./.test(name)) {
          const text = read(path);
          for (const word of [...gone, "/api/billing/portal", "/api/billing/invoices", "/api/billing/reactivate"])
            if (text.includes(word)) found.push(`${path}: ${word}`);
        }
      }
    };
    walk("src");
    expect(found).toEqual([]);
  });

  it("a purchase sends the plan and nothing else: no amount, and no address to come back to", () => {
    const api = read("src/lib/api.js");
    const call = api.slice(api.indexOf("purchasePlan:"), api.indexOf("downloadReceipt:"));
    expect(call).toContain("body: { planId }");
    // The server builds the return pages from its own configuration and charges the plan's own price.
    // An Idempotency-Key header is fine: it says which attempt this is, not what to charge or where to go.
    expect(call).not.toMatch(/successUrl|cancelUrl|amountCents|priceCents/);
  });

  it("plan descriptions are never put into the page as an HTML string", () => {
    const found = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const path = `${dir}/${name}`;
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.jsx?$/.test(name) && !/\.test\./.test(name) && read(path).includes("dangerouslySetInnerHTML")) found.push(path);
      }
    };
    walk("src");
    expect(found).toEqual([]);
  });
});
