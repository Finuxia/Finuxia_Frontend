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
    // The API client reads this at import time; tests talk to the mock server at this address.
    env: { VITE_API_URL: "http://api.test" },
    css: false,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "lcov"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx", "src/test/**", "src/**/*.test.{js,jsx}", "src/data/**"],
      // A floor, not a goal: set just under what the first real tests cover, so coverage can only go up.
      // Raise it as tests are added (see README, "Testing").
      // A floor, not a target: raised with FE-05's suite, and measured at 53/82/55/53 when it was set.
      thresholds: { statements: 25, branches: 70, functions: 35, lines: 25 },
    },
  },
});
