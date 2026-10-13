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
        else if (/\.(jsx?|mjs)$/.test(name) && !/\.test\./.test(name)) for (const m of read(path).matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)) found.add(m[1]);
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
    expect(read("src/components/Layout.jsx")).not.toContain("scrollbar-none");
  });

  it("the cancel-subscription API helper with no caller is gone", () => {
    expect(read("src/lib/api.js")).not.toContain("cancelSubscription");
  });
});
