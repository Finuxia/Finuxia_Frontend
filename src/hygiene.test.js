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

  it("no source file reads an environment variable other than the API address", () => {
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
    expect([...found]).toEqual(["VITE_API_URL"]);
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

  it("no page builds a payment amount or sends a return address to the server", () => {
    expect(read("src/lib/api.js")).toMatch(
      /purchasePlan: \(planId\) => request\("\/api\/billing\/purchase", \{ method: "POST", body: \{ planId \} \}\)/
    );
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
