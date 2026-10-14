import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { ApiError, api, clearLocalData, requestForTests, setSessionExpiredHandler } from "./api";

afterEach(() => setSessionExpiredHandler(null));

describe("the API client", () => {
  it("sends credentials, parses JSON and returns null for a 204", async () => {
    server.use(http.get(`${API}/api/clients`, () => HttpResponse.json([{ id: 1 }])));
    expect(await api.getClients()).toEqual([{ id: 1 }]);
    server.use(http.post(`${API}/api/auth/logout`, () => new HttpResponse(null, { status: 204 })));
    expect(await api.logout()).toBeNull();
  });

  it("echoes the CSRF cookie on state-changing requests only", async () => {
    document.cookie = "fx_csrf=token-123; path=/";
    const seen = {};
    server.use(
      http.get(`${API}/api/clients`, ({ request }) => {
        seen.get = request.headers.get("x-csrf-token");
        return HttpResponse.json([]);
      }),
      http.put(`${API}/api/state`, ({ request }) => {
        seen.put = request.headers.get("x-csrf-token");
        return HttpResponse.json({});
      })
    );
    await api.getClients();
    await api.putState({});
    expect(seen).toEqual({ get: null, put: "token-123" });
  });

  describe("errors", () => {
    it("uses the server's error sentence", async () => {
      server.use(http.get(`${API}/api/clients`, () => HttpResponse.json({ error: "Nope." }, { status: 403 })));
      const err = await api.getClients().catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect([err.message, err.status]).toEqual(["Nope.", 403]);
    });

    it("digs the first message out of nested validation errors, never '[object Object]'", async () => {
      server.use(
        http.get(`${API}/api/clients`, () => HttpResponse.json({ guestEmails: { 0: ["Enter a valid email address."] } }, { status: 400 }))
      );
      const err = await api.getClients().catch((e) => e);
      expect(err.message).toBe("Enter a valid email address.");
    });

    it("keeps the body on the error, e.g. the server's copy on a 409 conflict", async () => {
      server.use(
        http.patch(`${API}/api/clients/1`, () =>
          HttpResponse.json({ error: "Changed elsewhere", client: { id: 1, version: 5 } }, { status: 409 })
        )
      );
      const err = await api.patchClient(1, { first: "A", version: 4 }).catch((e) => e);
      expect(err.status).toBe(409);
      expect(err.data.client.version).toBe(5);
    });

    it("falls back to a friendly message for a body that is not JSON, not 'Request failed (500)'", async () => {
      server.use(http.get(`${API}/api/clients`, () => new HttpResponse("<html>boom</html>", { status: 500 })));
      const err = await api.getClients().catch((e) => e);
      expect(err.message).toBe("Something went wrong on our side. Please try again in a moment.");
    });

    it("says the server cannot be reached when the network fails", async () => {
      server.use(http.get(`${API}/api/clients`, () => HttpResponse.error()));
      const err = await api.getClients().catch((e) => e);
      expect([err.status, err.message]).toEqual([0, "Can't reach the server. Is the backend running?"]);
    });
  });

  describe("session refresh", () => {
    it("on a 401 refreshes once and retries the request transparently", async () => {
      let calls = 0;
      let refreshes = 0;
      server.use(
        http.get(`${API}/api/clients`, () => (++calls === 1 ? new HttpResponse(null, { status: 401 }) : HttpResponse.json([{ id: 7 }]))),
        http.post(`${API}/api/auth/refresh`, () => {
          refreshes += 1;
          return HttpResponse.json({});
        })
      );
      expect(await api.getClients()).toEqual([{ id: 7 }]);
      expect([calls, refreshes]).toEqual([2, 1]);
    });

    it("concurrent 401s share ONE refresh request", async () => {
      let refreshes = 0;
      const failedOnce = new Set();
      server.use(
        http.get(`${API}/api/clients`, () => {
          if (!failedOnce.has("clients")) {
            failedOnce.add("clients");
            return new HttpResponse(null, { status: 401 });
          }
          return HttpResponse.json([]);
        }),
        http.get(`${API}/api/state`, () => {
          if (!failedOnce.has("state")) {
            failedOnce.add("state");
            return new HttpResponse(null, { status: 401 });
          }
          return HttpResponse.json({});
        }),
        http.post(`${API}/api/auth/refresh`, async () => {
          refreshes += 1;
          await new Promise((r) => setTimeout(r, 30));
          return HttpResponse.json({});
        })
      );
      await Promise.all([api.getClients(), api.getState()]);
      expect(refreshes).toBe(1);
    });

    it("when the refresh fails the session is over: the handler runs and the 401 reaches the caller", async () => {
      const expired = vi.fn();
      setSessionExpiredHandler(expired);
      server.use(
        http.get(`${API}/api/clients`, () => new HttpResponse(null, { status: 401 })),
        http.post(`${API}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 }))
      );
      const err = await api.getClients().catch((e) => e);
      expect(err.status).toBe(401);
      expect(expired).toHaveBeenCalledTimes(1);
    });

    it("never tries to refresh a failed login (a wrong password is just a 401)", async () => {
      let refreshes = 0;
      server.use(
        http.post(`${API}/api/auth/login`, () => HttpResponse.json({ error: "Invalid credentials" }, { status: 401 })),
        http.post(`${API}/api/auth/refresh`, () => {
          refreshes += 1;
          return HttpResponse.json({});
        })
      );
      const err = await api.login("a@b.c", "wrong").catch((e) => e);
      expect([err.message, refreshes]).toEqual(["Invalid credentials", 0]);
    });
  });
});

describe("public requests (auth: false)", () => {
  const publicCalls = {
    "the guides": () => api.getGuides(),
    "a public booking page": () => api.getPublicBookingInfo("my-link"),
    "a public booking page's free times": () => api.getPublicBookingSlots("my-link", "2026-10-20", "Europe/London"),
  };
  const urls = {
    "the guides": `${API}/api/guides`,
    "a public booking page": `${API}/api/booking/public/my-link`,
    "a public booking page's free times": `${API}/api/booking/public/my-link/slots`,
  };

  it.each(Object.keys(publicCalls))("%s are asked for without the browser's cookies", async (name) => {
    let seen = null;
    server.use(
      http.get(urls[name], ({ request }) => {
        seen = request.credentials;
        return HttpResponse.json({});
      })
    );
    await publicCalls[name]();
    expect(seen).toBe("omit");
  });

  it("an ordinary call still sends them", async () => {
    let seen = null;
    server.use(
      http.get(`${API}/api/clients`, ({ request }) => {
        seen = request.credentials;
        return HttpResponse.json([]);
      })
    );
    await api.getClients();
    expect(seen).toBe("include");
  });

  it("a 401 on a public page is just a 401: no refresh is tried and nobody is signed out", async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    let refreshes = 0;
    server.use(
      http.get(`${API}/api/booking/public/my-link`, () => HttpResponse.json({ detail: "nope" }, { status: 401 })),
      http.post(`${API}/api/auth/refresh`, () => {
        refreshes += 1;
        return HttpResponse.json({});
      })
    );
    const err = await api.getPublicBookingInfo("my-link").catch((e) => e);
    expect([err.status, refreshes, expired.mock.calls.length]).toEqual([401, 0, 0]);
  });

  it("no CSRF header goes with it either, even if a token cookie is present", async () => {
    document.cookie = "fx_csrf=abc123";
    let header = "unset";
    server.use(
      http.post(`${API}/api/anything`, ({ request }) => {
        header = request.headers.get("X-CSRF-Token");
        return HttpResponse.json({});
      })
    );
    await requestForTests("/api/anything", { method: "POST", body: {}, auth: false });
    expect(header).toBeNull();
    await requestForTests("/api/anything", { method: "POST", body: {} }); // the same call with credentials DOES carry it, so the check above can fail
    expect(header).toBe("abc123");
    document.cookie = "fx_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });

  it("an option the function does not support is refused instead of silently doing nothing", async () => {
    await expect(requestForTests("/api/clients", { credentials: "omit" })).rejects.toThrow(/unsupported option credentials/);
    await expect(requestForTests("/api/clients", { auht: false })).rejects.toThrow(/unsupported option auht/);
  });
});

describe("refusals the API layer now keeps intact", () => {
  it("a 429 carries the Retry-After wait and says how long to wait", async () => {
    server.use(
      http.get(`${API}/api/clients`, () =>
        HttpResponse.json(
          { detail: "Request was throttled. Expected available in 25 seconds." },
          { status: 429, headers: { "Retry-After": "25" } }
        )
      )
    );
    const err = await api.getClients().catch((e) => e);
    expect([err.status, err.retryAfter, err.message]).toEqual([429, 25, "Too many requests. Try again in 25 seconds."]);
  });

  it("a login 429 reads as a lockout", async () => {
    server.use(
      http.post(`${API}/api/auth/login`, () =>
        HttpResponse.json({ detail: "Request was throttled." }, { status: 429, headers: { "Retry-After": "900" } })
      )
    );
    const err = await api.login("a@b.c", "x").catch((e) => e);
    expect([err.retryAfter, err.message, err.path]).toEqual([900, "Too many attempts. Try again in 15 minutes.", "/api/auth/login"]);
  });

  it("a 429 without Retry-After still has a sentence", async () => {
    server.use(http.get(`${API}/api/clients`, () => new HttpResponse(null, { status: 429 })));
    const err = await api.getClients().catch((e) => e);
    expect([err.retryAfter, err.message]).toEqual([null, "Too many requests. Please wait a moment and try again."]);
  });

  it("keeps the server's sentence and its code for a quota refusal", async () => {
    server.use(
      http.post(`${API}/api/sales-packages/packages/1/reason-why-letter`, () =>
        HttpResponse.json(
          { error: "Your AI wallet balance is too low for this. Top up in Profile.", code: "ai_credit_exhausted", actions: ["top_up"] },
          { status: 402 }
        )
      )
    );
    const err = await api.draftReasonWhyLetter(1).catch((e) => e);
    expect([err.status, err.code, err.message, err.data.actions]).toEqual([
      402,
      "ai_credit_exhausted",
      "Your AI wallet balance is too low for this. Top up in Profile.",
      ["top_up"],
    ]);
  });

  it("uses a friendly fallback, not 'Request failed (N)', when the server sent no message", async () => {
    server.use(http.get(`${API}/api/clients`, () => new HttpResponse("", { status: 502 })));
    expect((await api.getClients().catch((e) => e)).message).toMatch(/our side/);
  });

  it("file uploads report refusals the same way", async () => {
    server.use(http.post(`${API}/api/auth/me/avatar`, () => new HttpResponse(null, { status: 429, headers: { "Retry-After": "10" } })));
    const err = await api.uploadAvatar(new File(["x"], "a.png", { type: "image/png" })).catch((e) => e);
    expect([err.status, err.retryAfter, err.message]).toEqual([429, 10, "Too many requests. Try again in 10 seconds."]);
  });
});

describe("starting a purchase", () => {
  it("sends only the plan: no amount, and no return address (the server builds those from its own record and configuration)", async () => {
    let body;
    server.use(
      http.post(`${API}/api/billing/purchase`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ checkoutUrl: "https://checkout.example/x" });
      })
    );
    await api.purchasePlan(7);
    expect(body).toEqual({ planId: 7 });
  });
});

describe("setContinueIntent", () => {
  it("PUTs willContinue and nothing else", async () => {
    let seen;
    server.use(
      http.put(`${API}/api/billing/intent`, async ({ request }) => {
        seen = { method: request.method, body: await request.json() };
        return HttpResponse.json({ notContinuingSince: null });
      })
    );
    await api.setContinueIntent(false);
    expect(seen).toEqual({ method: "PUT", body: { willContinue: false } });
    await api.setContinueIntent(true);
    expect(seen.body).toEqual({ willContinue: true });
  });
});

describe("clearLocalData", () => {
  it("removes only this app's cached data", () => {
    localStorage.setItem("advisorpilot.clients.x", "1");
    localStorage.setItem("advisorpilot.tasks.x", "1");
    localStorage.setItem("someone-elses-key", "keep");
    clearLocalData();
    expect(localStorage.getItem("advisorpilot.clients.x")).toBeNull();
    expect(localStorage.getItem("advisorpilot.tasks.x")).toBeNull();
    expect(localStorage.getItem("someone-elses-key")).toBe("keep");
  });
});
