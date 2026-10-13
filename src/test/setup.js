import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

// A busy machine (or a full suite running in parallel) can take longer than the default 1 s to settle a multi-step flow.
configure({ asyncUtilTimeout: 4000 });

// A request nobody mocked is a bug in the test (or an unexpected call in the code): fail loudly, never reach a network.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  document.cookie.split("; ").forEach((c) => {
    const name = c.split("=")[0];
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
});

afterAll(() => server.close());
