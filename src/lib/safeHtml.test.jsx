import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { htmlToReact, safeHref } from "./safeHtml";

const html = (source) => {
  const { container } = render(<div>{htmlToReact(source)}</div>);
  return container.firstChild.innerHTML;
};

describe("htmlToReact", () => {
  it("keeps the formatting a plan description uses", () => {
    expect(
      html(
        "<h3>Included</h3><p>Everything in <strong>Pro</strong>, <em>plus</em> <u>more</u>.<br>Next</p><ul><li>One</li></ul><ol><li>A</li></ol>"
      )
    ).toBe(
      "<h3>Included</h3><p>Everything in <strong>Pro</strong>, <em>plus</em> <u>more</u>.<br>Next</p><ul><li>One</li></ul><ol><li>A</li></ol>"
    );
  });

  it("a link keeps only an allowed address and always gets rel", () => {
    expect(html('<a href="https://example.com/a" onclick="x()" target="_blank" style="color:red">Go</a>')).toBe(
      '<a href="https://example.com/a" rel="noopener noreferrer nofollow">Go</a>'
    );
    expect(html('<a href="mailto:sales@example.com">Mail</a>')).toContain('href="mailto:sales@example.com"');
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    "&#106;avascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox(1)",
    "//evil.example/x",
    "http:evil.example",
    "https:/evil.example",
    "ftp://example.com",
    "/relative",
    "",
  ])("a link to %j is just its text", (href) => {
    const out = html(`<a href="${href}">click</a>`);
    expect(out).toBe("click");
  });

  it.each([
    ["<script>alert(1)</script>ok", "ok"],
    ["<style>body{display:none}</style>ok", "ok"],
    ["<iframe src=//evil></iframe>ok", "ok"],
    ["<svg onload=alert(1)><circle/></svg>ok", "ok"],
    ["<img src=x onerror=alert(1)>ok", "ok"],
    ['<p onclick="alert(1)" style="x:y">hi</p>', "<p>hi</p>"],
    ["<b onmouseover=alert(1)>x</b>", "<b>x</b>"],
    ["<form action=//evil><input name=x><button>go</button></form>", "go"],
    ["<!-- <script>alert(1)</script> -->ok", "ok"],
    ["<object data=x></object>ok", "ok"],
    ["<textarea><script>alert(1)</script></textarea>ok", "ok"],
  ])("%s -> %s", (source, expected) => {
    expect(html(source)).toBe(expected);
  });

  it("escaped markup stays text and is never turned back into markup", () => {
    expect(html("&lt;img src=x onerror=alert(1)&gt;")).toBe("&lt;img src=x onerror=alert(1)&gt;");
    expect(html("1 < 2 and 3 > 2")).toBe("1 &lt; 2 and 3 &gt; 2");
  });

  it("nothing it builds can run: no script, no event handler, no style, no image", () => {
    const hostile = [
      '<img src=x onerror=alert(1)><script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(1)">x</a>',
      "<svg><script>alert(1)</script></svg><math><mi>x</mi></math>",
      '<p style="background:url(javascript:alert(1))" onclick=x>a</p><iframe srcdoc="<script>alert(1)</script>"></iframe>',
    ];
    for (const source of hostile) {
      const { container } = render(<div>{htmlToReact(source)}</div>);
      expect(container.querySelector("script, img, iframe, svg, style, object, embed")).toBeNull();
      for (const el of container.querySelectorAll("*")) {
        for (const attr of el.getAttributeNames()) expect(["href", "rel"]).toContain(attr);
      }
    }
  });

  it("a link keeps the spaces in its address and loses only control characters", () => {
    const { container } = render(<div>{htmlToReact('<a href="https://example.com/a b&#9;c">x</a>')}</div>);
    expect(container.querySelector("a").getAttribute("href")).toBe("https://example.com/a bc");
  });

  it.each([
    ["script", "<script>SECRET</script>ok"],
    ["style", "<style>SECRET</style>ok"],
    ["iframe", "<iframe>SECRET</iframe>ok"],
    ["object", "<object>SECRET</object>ok"],
    ["template", "<template>SECRET</template>ok"],
    ["noscript", "<noscript>SECRET</noscript>ok"],
    ["title", "<title>SECRET</title>ok"],
    ["textarea", "<textarea>SECRET</textarea>ok"],
    ["svg", "<svg>SECRET</svg>ok"],
    ["math", "<math>SECRET</math>ok"],
  ])("the contents of <%s> never come out as text", (_tag, source) => {
    expect(html(source)).toBe("ok");
  });

  it("an embed (which has no contents) and a stray head element leave nothing behind but the text around them", () => {
    expect(html("<embed src=x>ok")).toBe("ok");
    expect(html('<embed src="javascript:alert(1)">ok')).toBe("ok");
    expect(html("<head><title>SECRET</title></head>ok")).toBe("ok");
  });

  it("deep nesting is capped", () => {
    const out = html("<blockquote>".repeat(40) + "deep" + "</blockquote>".repeat(40));
    expect((out.match(/<blockquote>/g) || []).length).toBeLessThanOrEqual(8);
    expect(out).toContain("deep");
  });

  it("nothing and empty give nothing", () => {
    expect(htmlToReact(null)).toBeNull();
    expect(htmlToReact("")).toBeNull();
    expect(htmlToReact(undefined)).toBeNull();
  });
});

describe("safeHref", () => {
  it("allows http, https and mailto, removes control characters, and refuses the rest", () => {
    expect(safeHref("https://example.com")).toBe("https://example.com");
    expect(safeHref("  HTTP://example.com ")).toBe("HTTP://example.com");
    expect(safeHref("https://exa\nmple.com")).toBe("https://example.com");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("ja\x00vascript:alert(1)")).toBeNull();
    expect(safeHref(null)).toBeNull();
    expect(safeHref("")).toBeNull();
  });
});
