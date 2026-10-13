import { createElement } from "react";

/**
 * A plan's formatted description, as React elements — never as an HTML string put into the page.
 *
 * The server has already cleaned this HTML against a fixed list of tags (see the backend's rich_text module and docs/decisions/BIL-17). This is
 * a second, independent barrier on this side: the text is parsed into an inert document (nothing in it runs or loads), and only the same
 * allowed tags are rebuilt as React elements. Everything else is dropped, with its contents when it is something that holds code. Text is
 * always a React text node, so it cannot become markup, and the only attribute that ever survives is a link's `href` (http, https or mailto).
 */

const ALLOWED = new Set(["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h3", "h4", "blockquote", "a"]);
// Removed together with everything inside them.
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "template", "noscript", "title", "textarea", "svg", "math"]);
const LINK_SCHEMES = /^(https?:\/\/|mailto:)/i;
const MAX_DEPTH = 8;

/** The href if it is one we allow (control characters removed first, as a browser reads it), else null. */
export function safeHref(value) {
  if (!value) return null;
  // Control characters are dropped by character code (browsers ignore them inside a URL, so "java<tab>script:" is "javascript:").
  const cleaned = Array.from(String(value))
    .filter((ch) => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127)
    .join("")
    .trim();
  return LINK_SCHEMES.test(cleaned) ? cleaned : null;
}

function build(node, depth, key) {
  if (node.nodeType === 3) return node.textContent; // text: a React text node, escaped by React
  if (node.nodeType !== 1) return null; // comments, processing instructions...
  const tag = node.nodeName.toLowerCase();
  if (DROP_WITH_CONTENT.has(tag)) return null;
  const children = buildChildren(node, depth + 1);
  if (!ALLOWED.has(tag) || depth >= MAX_DEPTH) return children; // the tag goes, what it held stays
  if (tag === "br") return createElement("br", { key });
  if (tag === "a") {
    const href = safeHref(node.getAttribute("href"));
    return href ? createElement("a", { key, href, rel: "noopener noreferrer nofollow" }, children) : children;
  }
  return createElement(tag, { key }, children);
}

function buildChildren(parent, depth) {
  return Array.from(parent.childNodes).map((child, i) => build(child, depth, i));
}

/** @param {string | null | undefined} html @returns {import("react").ReactNode} */
export function htmlToReact(html) {
  if (!html || typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, "text/html");
  return buildChildren(doc.body, 0);
}
