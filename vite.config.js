import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Lets scripts/check-bundle.mjs read which chunk imports which, to keep the public pages free of the signed-in app.
    manifest: true,
    rollupOptions: {
      output: {
        // The framework changes rarely: its own file stays cached across releases of the app code.
        manualChunks: { react: ["react", "react-dom", "react-router-dom"] },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    // VITE_API_URL: the API client reads it at import time; tests talk to the mock server at this address.
    // TZ: the suite used to run in whatever zone the machine had, so a date bug could pass in CI and fail on
    // a laptop, or the reverse. Pinned to a CANADIAN zone rather than UTC on purpose: every advisor using
    // this is behind UTC, and UTC is the one setting in which an off-by-one-day bug is invisible. A test
    // that needs a different zone can set it itself.
    env: { VITE_API_URL: "http://api.test", TZ: "America/Edmonton" },
    css: false,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "lcov"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx", "src/test/**", "src/**/*.test.{js,jsx}", "src/data/**"],
      // A floor, not a goal: one point under what the merged tree measures, so a real drop trips it and an
      // unrelated refactor does not. Measured 69.90/65.91/61.52/70.90 (statements/branches/functions/lines)
      // on 2026-10-15, with Vitest 5 and the time zone pinned. Neither side of the SEC-10 / TEST-07 merge
      // could be used as-is: one predated the coverage engine upgrade, the other predated the new tests.
      thresholds: { statements: 68, branches: 64, functions: 60, lines: 69 },
    },
  },
});
