import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  { ignores: ["dist/**", "coverage/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { react, "react-hooks": reactHooks, "jsx-a11y": jsxA11y, "eslint-comments": eslintComments },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      // No prop-types: the app is plain JavaScript and the shared shapes are documented with JSDoc types (src/lib/types.js).
      "react/prop-types": "off",
      // Apostrophes and quotes in JSX text are valid and render correctly; escaping them only makes copy hard to read.
      "react/no-unescaped-entities": "off",
      // Dialogs move focus on open on purpose (the Modal primitive also sets it): autoFocus there is the intended behaviour.
      "jsx-a11y/no-autofocus": "off",
      // A suppression is allowed only with a written reason ("-- why") and only for named rules: no blanket disables.
      "eslint-comments/require-description": ["error", { ignore: [] }],
      "eslint-comments/no-unlimited-disable": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
  {
    // An eslint-disable that no longer suppresses anything is a stale excuse: fail on it.
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  {
    // Tests run under Node (they read process.env, set the time zone, and so on).
    files: ["src/**/*.test.{js,jsx}", "src/test/**"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["scripts/**/*.mjs", "*.config.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { ...globals.node } },
  },
  {
    // The browser suite (TEST-06) drives a real browser but the test code itself runs in Node: it reads
    // process.env for the target, decodes mail files with Buffer, and polls with setTimeout.
    files: ["e2e/**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { ...globals.node } },
  },
];
