import { describe, it, expect } from "vitest";
import { shortCommit } from "./version";

describe("shortCommit", () => {
  it("abbreviates a commit SHA to the seven characters git itself uses", () => {
    // so it can be pasted straight into `git show`
    expect(shortCommit("17d186e4a9c3b5d7e1f2a8b6c4d9e0f1a2b3c4d5")).toBe("17d186e");
  });

  it("leaves an already-short SHA alone", () => {
    expect(shortCommit("17d186e")).toBe("17d186e");
  });

  it("is empty for nothing, which is how a local dev build renders", () => {
    // Deliberately not "unknown" or "dev": a blank is honest, a placeholder is a value somebody
    // might believe. Same reasoning as errorTracking.js and the backend's SENTRY_RELEASE.
    expect([shortCommit(""), shortCommit("   "), shortCommit(undefined), shortCommit(null)]).toEqual(["", "", "", ""]);
  });

  it("does not mangle a value that is not a SHA", () => {
    // A tag or hand-set version has to stay searchable; truncating to 7 would destroy it.
    expect(shortCommit("v2.1.0-rc3")).toBe("v2.1.0-rc3");
  });

  it("truncates a long non-SHA only enough to keep the footer from wrapping", () => {
    expect(shortCommit("release-candidate-2026-10-23-final")).toBe("release-candidat");
  });

  it("is not fooled by a hex-looking string that is too short to be a SHA", () => {
    expect(shortCommit("abc")).toBe("abc");
  });
});
