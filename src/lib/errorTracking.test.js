/**
 * Error tracking (OPS-01).
 *
 * Almost all of this is about `scrubEvent` and `scrubBreadcrumb`, because they stand between a UI
 * crash report and a third party receiving a customer's data — or, worse here, a working
 * credential: `/reset-password?uid=..&token=..` carries a live password-reset token in the query
 * string, so any URL that leaves this app has to be cut at the `?`.
 *
 * They are plain functions over plain objects, so none of this needs the SDK or a network.
 */
import { http, HttpResponse } from "msw";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { API } from "../test/handlers";
import { server } from "../test/server";
import { api } from "./api";
import {
  DROPPED_BODY,
  REDACTED,
  initErrorTracking,
  makeReporter,
  reportPayload,
  scrubBreadcrumb,
  scrubEvent,
  stripQuery,
} from "./errorTracking";
import { reportError, resetErrorReporting, setErrorReporter } from "./errorReporting";
import { lastRequestId, resetLastRequestId } from "./api";

// `api` is the exported object of endpoint functions; `lastRequestId` is a module-level getter.

beforeEach(() => {
  resetErrorReporting();
  resetLastRequestId();
});

describe("stripQuery", () => {
  it("removes a password reset token from a URL", () => {
    expect(stripQuery("https://finuxia.com/reset-password?uid=14&token=abc123")).toBe(
      "https://finuxia.com/reset-password"
    );
  });

  it("removes a fragment as well, because a token can be put there too", () => {
    expect(stripQuery("https://finuxia.com/verify-email#token=abc123")).toBe(
      "https://finuxia.com/verify-email"
    );
  });

  it("leaves a plain path alone", () => {
    expect(stripQuery("/clients/41")).toBe("/clients/41");
  });

  it("passes through anything that is not a string", () => {
    expect(stripQuery(undefined)).toBe(undefined);
    expect(stripQuery(null)).toBe(null);
  });
});

describe("scrubEvent: the request", () => {
  it("never sends a request body", () => {
    const event = scrubEvent({ request: { method: "POST", data: { password: "hunter2" } } });
    expect(event.request.data).toBe(DROPPED_BODY);
  });

  it("cuts the query string off the request URL", () => {
    const event = scrubEvent({
      request: { url: "https://api.finuxia.com/api/auth/reset?token=abc123", query_string: "token=abc123" },
    });
    expect(event.request.url).toBe("https://api.finuxia.com/api/auth/reset");
    expect(event.request.query_string).toBeUndefined();
  });

  it("drops headers and cookies entirely", () => {
    const event = scrubEvent({
      request: { headers: { Authorization: "Bearer secret" }, cookies: { fx_csrf: "secret" } },
    });
    expect(event.request.headers).toBeUndefined();
    expect(event.request.cookies).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain("secret");
  });
});

describe("scrubEvent: the user", () => {
  it("reduces the user to an internal id", () => {
    const event = scrubEvent({
      user: { id: 14, email: "advisor@example.com", username: "advisor", ip_address: "203.0.113.4" },
    });
    expect(event.user).toEqual({ id: 14 });
  });

  it("empties a user that has no id rather than keeping the email", () => {
    const event = scrubEvent({ user: { email: "advisor@example.com" } });
    expect(event.user).toEqual({});
  });
});

describe("scrubEvent: our own attached data", () => {
  it("redacts sensitive keys and keeps useful ones", () => {
    const event = scrubEvent({
      extra: { payment_id: 91, client_email: "jane@example.com", auth_token: "abc", attempt: 2 },
    });
    expect(event.extra.payment_id).toBe(91);
    expect(event.extra.attempt).toBe(2);
    expect(event.extra.client_email).toBe(REDACTED);
    expect(event.extra.auth_token).toBe(REDACTED);
  });

  it("reaches into nested structures", () => {
    const event = scrubEvent({ extra: { payload: { clients: [{ full_name: "Jane Roe", stage: "New" }] } } });
    expect(event.extra.payload.clients[0].full_name).toBe(REDACTED);
    expect(event.extra.payload.clients[0].stage).toBe("New");
  });

  it("matches key names case insensitively", () => {
    const event = scrubEvent({ extra: { API_KEY: "secret", Email: "a@b.c" } });
    expect(event.extra.API_KEY).toBe(REDACTED);
    expect(event.extra.Email).toBe(REDACTED);
  });

  it("does not recurse forever on a self-referencing object", () => {
    const loop = { stage: "New" };
    loop.self = loop;
    expect(scrubEvent({ extra: loop })).not.toBeNull();
  });

  it("cuts the page URL in contexts", () => {
    const event = scrubEvent({ contexts: { page: { url: "https://finuxia.com/reset-password?token=abc" } } });
    expect(event.contexts.page.url).toBe("https://finuxia.com/reset-password");
  });
});

describe("scrubBreadcrumb", () => {
  it("cuts the token out of a navigation breadcrumb", () => {
    const crumb = scrubBreadcrumb({
      category: "navigation",
      data: { from: "/forgot-password", to: "/reset-password?uid=14&token=abc123" },
    });
    expect(crumb.data.to).toBe("/reset-password");
    expect(crumb.data.from).toBe("/forgot-password");
  });

  it("cuts the token out of a fetch breadcrumb and keeps the useful parts", () => {
    const crumb = scrubBreadcrumb({
      category: "fetch",
      data: { url: "https://api.finuxia.com/api/auth/reset?token=abc123", method: "POST", status_code: 500 },
    });
    expect(crumb.data.url).toBe("https://api.finuxia.com/api/auth/reset");
    expect(crumb.data.method).toBe("POST");
    expect(crumb.data.status_code).toBe(500);
  });

  it("strips the arguments off a console breadcrumb, which in a UI often hold a whole client", () => {
    const crumb = scrubBreadcrumb({
      category: "console",
      level: "error",
      message: "failed for client",
      data: { arguments: [{ full_name: "Jane Roe", email: "jane@example.com" }] },
    });
    expect(crumb.data).toBeUndefined();
    expect(JSON.stringify(crumb)).not.toContain("jane@example.com");
  });

  it("survives a breadcrumb with no data", () => {
    expect(scrubBreadcrumb({ category: "navigation" })).toEqual({ category: "navigation" });
    expect(scrubBreadcrumb(null)).toBeNull();
  });

  it("is applied to breadcrumbs carried on the event, in both shapes the SDK uses", () => {
    const asArray = scrubEvent({ breadcrumbs: [{ data: { url: "/a?token=x" } }] });
    expect(asArray.breadcrumbs[0].data.url).toBe("/a");

    const asValues = scrubEvent({ breadcrumbs: { values: [{ data: { url: "/b?token=x" } }] } });
    expect(asValues.breadcrumbs.values[0].data.url).toBe("/b");
  });
});

describe("scrubEvent: safety", () => {
  it("drops anything that is not an event object", () => {
    expect(scrubEvent(null)).toBeNull();
    expect(scrubEvent("not an event")).toBeNull();
  });

  it("passes an event with nothing sensitive through unchanged", () => {
    const event = scrubEvent({ message: "boom", level: "error" });
    expect(event.message).toBe("boom");
    expect(event.level).toBe("error");
  });
});

describe("the request id ties the two halves together", () => {
  it("picks up X-Request-ID from a response and tags the event with it", async () => {
    server.use(
      http.get(`${API}/api/clients`, () =>
        HttpResponse.json([], { headers: { "X-Request-ID": "abc123def456" } })
      )
    );

    await api.getClients();

    expect(lastRequestId()).toBe("abc123def456");
    expect(scrubEvent({ message: "boom" }).tags.request_id).toBe("abc123def456");
  });

  it("picks the id up from a failed request too, which is the case that matters most", async () => {
    server.use(
      http.get(`${API}/api/clients`, () =>
        HttpResponse.json({ error: "Nope." }, { status: 500, headers: { "X-Request-ID": "failed-req-9" } })
      )
    );

    await api.getClients().catch(() => {});

    expect(lastRequestId()).toBe("failed-req-9");
  });

  it("adds no request id when no API call has been made yet", () => {
    expect(scrubEvent({ message: "boom" }).tags?.request_id).toBeUndefined();
  });

  it("leaves the previous id in place when a response carries no header", async () => {
    server.use(
      http.get(`${API}/api/clients`, () => HttpResponse.json([], { headers: { "X-Request-ID": "req-1" } }))
    );
    await api.getClients();

    server.use(http.get(`${API}/api/state`, () => HttpResponse.json({})));
    await api.getUserState?.().catch(() => {});

    expect(lastRequestId()).toBe("req-1");
  });

  it("keeps other tags when it adds the request id", async () => {
    server.use(
      http.get(`${API}/api/clients`, () => HttpResponse.json([], { headers: { "X-Request-ID": "req-1" } }))
    );
    await api.getClients();

    const event = scrubEvent({ tags: { boundary: "route" } });
    expect(event.tags.boundary).toBe("route");
    expect(event.tags.request_id).toBe("req-1");
  });

  it("survives a network failure, where there is no response to read a header from", async () => {
    server.use(http.get(`${API}/api/clients`, () => HttpResponse.error()));
    await api.getClients().catch(() => {});
    expect(lastRequestId()).toBe("");
  });
});

describe("initErrorTracking", () => {
  it("does nothing and loads no SDK without a DSN", async () => {
    // VITE_SENTRY_DSN is not set in the test environment, which is the point: the suite must never
    // be able to talk to a real Sentry project.
    await expect(initErrorTracking()).resolves.toBe(false);
  });
});

describe("what gets attached to a reported error", () => {
  it("tags the reference the customer reads off the recovery screen", () => {
    const { tags } = reportPayload({ errorId: "a1b2c3d4", boundary: "route" });
    expect(tags.error_id).toBe("a1b2c3d4");
    expect(tags.boundary).toBe("route");
  });

  it("cuts the query off the route tag too, because that is where reset tokens live", () => {
    expect(reportPayload({ route: "/reset-password?uid=14&token=abc123" }).tags.route).toBe("/reset-password");
  });

  it("carries the React component stack, truncated", () => {
    const { contexts } = reportPayload({ componentStack: "x".repeat(9000) });
    expect(contexts.react.componentStack.length).toBe(4000);
  });

  it("attaches nothing for an empty context rather than a set of undefined tags", () => {
    expect(reportPayload()).toEqual({ tags: {}, contexts: {} });
  });

  it("passes the error and the payload straight through to the sender", () => {
    const sent = [];
    const error = new Error("boom");
    makeReporter((e, payload) => sent.push([e, payload]))(error, { errorId: "a1b2c3d4" });

    expect(sent).toHaveLength(1);
    expect(sent[0][0]).toBe(error);
    expect(sent[0][1].tags.error_id).toBe("a1b2c3d4");
  });
});

describe("errors thrown before the reporter is installed", () => {
  it("are buffered and flushed once it arrives", () => {
    // The window this covers is real: the SDK is a dynamic import, so an error in the very first
    // render happens before any reporter exists.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const early = new Error("thrown during the first render");
    reportError(early, { boundary: "app" });

    const seen = [];
    setErrorReporter((error, context) => seen.push([error, context]));

    expect(seen).toHaveLength(1);
    expect(seen[0][0]).toBe(early);
    expect(seen[0][1].boundary).toBe("app");
    consoleError.mockRestore();
  });

  it("are capped, so an app failing in a loop cannot grow the buffer without limit", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 25; i += 1) reportError(new Error(`boom ${i}`), {});

    const seen = [];
    setErrorReporter((error) => seen.push(error));

    expect(seen).toHaveLength(10);
    consoleError.mockRestore();
  });

  it("go straight to the reporter once one is installed, without buffering", () => {
    const seen = [];
    setErrorReporter((error) => seen.push(error));
    const error = new Error("boom");
    reportError(error, {});
    expect(seen).toEqual([error]);
  });

  it("do not break the recovery screen when the reporter itself throws", () => {
    setErrorReporter(() => {
      throw new Error("the reporter is broken");
    });
    expect(() => reportError(new Error("boom"), {})).not.toThrow();
  });
});
