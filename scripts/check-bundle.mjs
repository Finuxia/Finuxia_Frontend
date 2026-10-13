// Run after `npm run build`: node scripts/check-bundle.mjs
//
// Keeps the first load small and the public pages free of the signed-in application, using the build manifest
// (dist/.vite/manifest.json), which says which file imports which.
//   1. the entry's *static* closure (what every visitor downloads before anything renders) must not contain the
//      signed-in layout, any page of the signed-in app, or the Excel libraries;
//   2. each public page's static closure must not either;
//   3. the entry's gzip size must stay under the budget below. Raise the budget only on purpose, in the same
//      change that adds the weight, and say why.
//   4. no personal email address is in anything we ship (see emailCheck.mjs).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { personalEmails } from "./emailCheck.mjs";

const DIST = "dist";
const ENTRY_GZIP_BUDGET_KB = 90; // 79 kB measured after code splitting (was 166 kB): see README, "Bundle size"

const manifest = JSON.parse(readFileSync(`${DIST}/.vite/manifest.json`, "utf8"));

// The signed-in application's shell (layout, route table, shared pieces) is the chunk named *AuthenticatedApp* (or
// *Layout*); the pages are chunks keyed by their source file.
// A shared chunk is named after its first module, so the layout shows up as "Layout" when something else pulls it in.
const AUTHENTICATED_SHELL = /(AuthenticatedApp|Layout)/;
const FORBIDDEN_SOURCES = [
  "src/pages/SalesPackagePrep.jsx",
  "src/pages/Reports.jsx",
  "src/pages/Import.jsx",
  "src/pages/Dashboard.jsx",
  "src/pages/ClientDetail.jsx",
];
const PUBLIC_PAGES = [
  "src/pages/Login.jsx",
  "src/pages/Register.jsx",
  "src/pages/ForgotPassword.jsx",
  "src/pages/ResetPassword.jsx",
  "src/pages/Privacy.jsx",
  "src/pages/Terms.jsx",
  "src/pages/SupportPublic.jsx",
  "src/pages/BookingPublic.jsx",
  "src/pages/ZoomIntegrationDocs.jsx",
];

function staticClosure(key, seen = new Set()) {
  if (seen.has(key)) return seen;
  seen.add(key);
  for (const next of manifest[key]?.imports || []) staticClosure(next, seen);
  return seen;
}

const problems = [];
const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
const entryClosure = staticClosure(entryKey);

if (!Object.keys(manifest).some((k) => AUTHENTICATED_SHELL.test(k)))
  problems.push("the signed-in app is not a separate chunk (AuthenticatedApp not found; renamed?)");
for (const forbidden of FORBIDDEN_SOURCES) {
  if (!manifest[forbidden]) problems.push(`${forbidden} is not in the build manifest (renamed? update this script)`);
  else if (entryClosure.has(forbidden)) problems.push(`the first-load bundle statically imports ${forbidden}: it must be loaded lazily`);
}
if ([...entryClosure].some((k) => AUTHENTICATED_SHELL.test(k)))
  problems.push("the first-load bundle statically imports the signed-in app shell (layout and routes)");
for (const page of PUBLIC_PAGES) {
  if (!manifest[page]) {
    problems.push(`${page} is not a separate chunk (not lazily loaded?)`);
    continue;
  }
  const closure = staticClosure(page);
  for (const forbidden of FORBIDDEN_SOURCES) {
    if (closure.has(forbidden)) problems.push(`public page ${page} statically pulls in ${forbidden}`);
  }
  if ([...closure].some((k) => AUTHENTICATED_SHELL.test(k)))
    problems.push(`public page ${page} statically pulls in the signed-in app shell`);
  if ([...closure].some((k) => /xlsx|exceljs/i.test(k))) problems.push(`public page ${page} pulls in an Excel library`);
}
if ([...entryClosure].some((k) => /xlsx|exceljs/i.test(k))) problems.push("the first-load bundle includes an Excel library");

// What a visit downloads, gzipped: every chunk in the static closure, plus the stylesheets.
function gzipOf(keys) {
  let bytes = 0;
  const css = new Set();
  for (const key of keys) {
    const entry = manifest[key];
    if (entry?.file?.endsWith(".js")) bytes += gzipSync(readFileSync(`${DIST}/${entry.file}`)).length;
    (entry?.css || []).forEach((c) => css.add(c));
  }
  for (const c of css) bytes += gzipSync(readFileSync(`${DIST}/${c}`)).length;
  return bytes / 1024;
}
const kb = gzipOf(entryClosure);
for (const page of ["src/pages/BookingPublic.jsx", "src/pages/Login.jsx"]) {
  if (manifest[page])
    console.log(
      `  first visit to ${page.replace("src/pages/", "").replace(".jsx", "")}: ${gzipOf(staticClosure(page)).toFixed(1)} kB gzip`
    );
}
console.log(`First-load JS+CSS (gzip): ${kb.toFixed(1)} kB, budget ${ENTRY_GZIP_BUDGET_KB} kB`);
if (kb > ENTRY_GZIP_BUDGET_KB)
  problems.push(`the first-load bundle is ${kb.toFixed(1)} kB gzip, over the ${ENTRY_GZIP_BUDGET_KB} kB budget`);

// Every file the build emitted, searched for addresses that are not ours or obvious placeholders.
function emitted(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) return name === ".vite" ? [] : emitted(path);
    return /\.(js|css|html|json|webmanifest|txt)$/.test(name) ? [path] : [];
  });
}
for (const file of emitted(DIST)) {
  const addresses = personalEmails(readFileSync(file, "utf8"));
  if (addresses.length)
    problems.push(
      `${file} contains an email address that is not ours: ${addresses.join(", ")} (a support contact belongs in server configuration)`
    );
}

if (problems.length) {
  console.error("\nBundle check failed:\n - " + problems.join("\n - "));
  process.exit(1);
}
console.log("Bundle check passed: public pages and the first load exclude the signed-in app.");
