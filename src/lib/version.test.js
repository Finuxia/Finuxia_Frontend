import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { shortCommit, APP_VERSION, VERSION_LABEL } from "./version";

describe("the version shown in the footer", () => {
  it("is the product version from package.json, not a commit", () => {
    // What a person means by "which version are we on". vite.config.js injects it, so this also
    // proves the injection works — if `define` broke, this would be empty.
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("is prefixed with v for display", () => {
    expect(VERSION_LABEL).toBe(`v${APP_VERSION}`);
  });

  it("matches package.json exactly, so the footer cannot drift from npm", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(APP_VERSION).toBe(pkg.version);
  });
});

describe("shortCommit, used for the tooltip", () => {
  it("abbreviates a commit SHA to the seven characters git itself uses", () => {
    // so it can be pasted straight into `git show`
    expect(shortCommit("17d186e4a9c3b5d7e1f2a8b6c4d9e0f1a2b3c4d5")).toBe("17d186e");
  });

  it("leaves an already-short SHA alone", () => {
    expect(shortCommit("17d186e")).toBe("17d186e");
  });

  it("is empty for nothing, which is how a local dev build has no commit to report", () => {
    // Deliberately not "unknown" or "dev": a blank is honest, a placeholder is a value somebody
    // might believe. Same reasoning as errorTracking.js and the backend's SENTRY_RELEASE.
    expect([shortCommit(""), shortCommit("   "), shortCommit(undefined), shortCommit(null)]).toEqual(["", "", "", ""]);
  });

  it("does not mangle a value that is not a SHA", () => {
    // A tag or hand-set value has to stay searchable; truncating to 7 would destroy it.
    expect(shortCommit("v2.1.0-rc3")).toBe("v2.1.0-rc3");
  });

  it("truncates a long non-SHA only enough to stay readable", () => {
    expect(shortCommit("release-candidate-2026-10-23-final")).toBe("release-candidat");
  });

  it("is not fooled by a hex-looking string too short to be a SHA", () => {
    expect(shortCommit("abc")).toBe("abc");
  });
});
