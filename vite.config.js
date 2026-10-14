import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
    // The API client reads this at import time; tests talk to the mock server at this address.
    env: { VITE_API_URL: "http://api.test" },
    css: false,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "lcov"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx", "src/test/**", "src/**/*.test.{js,jsx}", "src/data/**"],
      // A floor, not a goal: raised with TEST-07's security tests. Measured 2026-10-15 at
      // 72.19/83.73/61.25/72.19 (statements/branches/functions/lines); keep each floor just below it.
      thresholds: { statements: 71, branches: 82, functions: 60, lines: 71 },
    },
  },
});
