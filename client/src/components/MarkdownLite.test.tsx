import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownLite } from "./MarkdownLite";

/**
 * This renderer replaced Streamdown for Copilot replies, which removed Shiki
 * and Mermaid — and with them ~900 KB from the main bundle. It therefore has
 * to handle what the Copilot actually produces, and it has to be safe with
 * model output, which is untrusted text.
 */
const render = (md: string) => renderToStaticMarkup(<MarkdownLite>{md}</MarkdownLite>);

describe("MarkdownLite", () => {
  it("renders headings", () => {
    expect(render("## Evidence needed")).toContain("<h2>Evidence needed</h2>");
    expect(render("#### Deep")).toContain("<h4>Deep</h4>");
  });

  it("renders bullet and numbered lists", () => {
    const ul = render("- first\n- second");
    expect(ul).toContain("<ul>");
    expect(ul).toContain("<li>first</li>");
    expect(ul).toContain("<li>second</li>");

    const ol = render("1. one\n2. two");
    expect(ol).toContain("<ol>");
    expect(ol).toContain("<li>one</li>");
  });

  it("renders emphasis and inline code", () => {
    expect(render("**L4** maturity")).toContain("<strong>L4</strong>");
    expect(render("_partial_ coverage")).toContain("<em>partial</em>");
    expect(render("set `max-age=0`")).toContain("<code>max-age=0</code>");
  });

  it("renders fenced code blocks verbatim", () => {
    const html = render("```\nSELECT 1;\nSELECT 2;\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("SELECT 1;\nSELECT 2;");
  });

  it("joins wrapped prose into one paragraph and splits on blank lines", () => {
    const html = render("one line\nsame para\n\nnew para");
    expect(html).toContain("<p>one line same para</p>");
    expect(html).toContain("<p>new para</p>");
  });

  it("escapes markup in model output instead of injecting it", () => {
    const html = render("Consider <script>alert(1)</script> and <img src=x onerror=y>");
    // The characters may appear as visible text; what matters is that no live
    // element or attribute is produced, so the brackets must stay escaped.
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=y&gt;");
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img/i);
  });

  it("links only http(s) targets and leaves anything else as text", () => {
    const safe = render("see [the standard](https://example.com/iso)");
    expect(safe).toContain('href="https://example.com/iso"');
    expect(safe).toContain('rel="noopener noreferrer nofollow"');

    // A javascript: target must never become an href. It stays literal text,
    // which is inert, so assert on the attribute rather than the substring.
    const unsafe = render("see [click](javascript:alert(1))");
    expect(unsafe).not.toMatch(/href="javascript:/i);
    expect(unsafe).not.toContain("<a ");
    expect(unsafe).toContain("[click]");
  });

  it("handles an unterminated code fence without losing the rest", () => {
    const html = render("intro\n```\nstill open");
    expect(html).toContain("<p>intro</p>");
    expect(html).toContain("still open");
  });

  it("renders an empty string without throwing", () => {
    expect(() => render("")).not.toThrow();
  });
});
