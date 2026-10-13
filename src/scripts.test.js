import { readFileSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_EMAIL_DOMAINS,
  VENDOR_ADDRESSES,
  personalEmails,
} from "../scripts/emailCheck.mjs";

describe("the email check on what we ship", () => {
  it("finds a person's address", () => {
    expect(personalEmails('const a = "someone@gmail.com";')).toEqual([
      "someone@gmail.com",
    ]);
    expect(personalEmails("mailto:A.B+tag@Yahoo.CA?subject=x")).toEqual([
      "a.b+tag@yahoo.ca",
    ]);
  });

  it("allows our own domain and the placeholder ones", () => {
    expect(
      personalEmails(
        "info@finuxia.com you@example.com jane.doe@email.com advisor@domain.ca x@example.org",
      ),
    ).toEqual([]);
  });

  it("allows a subdomain of an allowed domain, but not a look-alike", () => {
    expect(personalEmails("help@support.finuxia.com")).toEqual([]);
    expect(
      personalEmails(
        "help@notfinuxia.com help@finuxia.com.evil.io help@example.com.au",
      ),
    ).toEqual([
      "help@example.com.au",
      "help@finuxia.com.evil.io",
      "help@notfinuxia.com",
    ]);
  });

  it("reports each address once", () => {
    expect(personalEmails("a@gmail.com a@gmail.com A@GMAIL.COM")).toEqual([
      "a@gmail.com",
    ]);
  });

  it("is quiet about text with no address, and about things that only look like one", () => {
    expect(personalEmails("")).toEqual([]);
    expect(
      personalEmails("import x from '@scope/package'; const y = a@b;"),
    ).toEqual([]);
  });

  it("accepts the few addresses that live inside a bundled library, and only those", () => {
    expect(personalEmails(VENDOR_ADDRESSES.join(" "))).toEqual([]);
    expect(personalEmails("fedor@indutny.com someone.else@gmail.com")).toEqual([
      "someone.else@gmail.com",
    ]);
    expect(personalEmails("fedor@indutny.org")).toEqual(["fedor@indutny.org"]); // a near miss is not the library's address
    expect(VENDOR_ADDRESSES.length).toBeLessThan(5); // a long list would mean the check has stopped meaning anything
  });

  it("the allowlist is short and has no free-mail provider", () => {
    expect(ALLOWED_EMAIL_DOMAINS.length).toBeLessThan(8);
    for (const free of ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"])
      expect(ALLOWED_EMAIL_DOMAINS).not.toContain(free);
  });
});

describe("no personal address is compiled into the source", () => {
  const walk = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const path = `${dir}/${name}`;
      if (statSync(path).isDirectory()) return walk(path);
      return /\.(jsx?|html|json)$/.test(name) && !/\.test\./.test(name)
        ? [path]
        : [];
    });

  it("none of the source files, or index.html, contains one", () => {
    for (const file of [...walk("src"), "index.html"])
      expect(personalEmails(readFileSync(file, "utf8")), file).toEqual([]);
  });
});
