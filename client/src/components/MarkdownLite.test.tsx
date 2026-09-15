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

describe("MarkdownLite nested lists", () => {
  // Observed in production: the Copilot answers with a numbered outline whose
  // items carry indented sub-bullets. Treating each sub-bullet as a new list
  // split the outline into one <ol> per item, so the numbering restarted at
  // "1." on every line.
  const outline = [
    "1. Defined maturity levels",
    "   - Each capability has discrete levels",
    "   - Levels are ordered",
    "2. Evidence requirements per level",
    "   - Assessors expect specific artifacts",
    "3. Evidence gating",
  ].join("\n");

  it("keeps one ordered list instead of one per item", () => {
    expect(render(outline).match(/<ol>/g) ?? []).toHaveLength(1);
  });

  it("keeps all three numbered items at the top level", () => {
    // Assert the exact shape: counting </li><li> transitions would also match
    // the nested items, which is what made an earlier version of this test lie.
    expect(render(outline)).toContain(
      "<ol>" +
        "<li>Defined maturity levels<ul>" +
          "<li>Each capability has discrete levels</li>" +
          "<li>Levels are ordered</li>" +
        "</ul></li>" +
        "<li>Evidence requirements per level<ul>" +
          "<li>Assessors expect specific artifacts</li>" +
        "</ul></li>" +
        "<li>Evidence gating</li>" +
      "</ol>"
    );
  });

  it("nests the sub-bullets inside their parent item", () => {
    const html = render(outline);
    expect(html).toMatch(/<li>Defined maturity levels<ul>/);
    expect(html).toContain("<li>Each capability has discrete levels</li>");
    expect(html).toContain("<li>Levels are ordered</li>");
  });

  it("survives a blank line between items without restarting", () => {
    const html = render("1. first\n\n2. second\n\n3. third");
    expect(html.match(/<ol>/g) ?? []).toHaveLength(1);
    expect((html.match(/<li>/g) ?? []).length).toBe(3);
  });

  it("starts a new list when prose separates two lists", () => {
    const html = render("- a\n- b\n\nSome prose here\n\n- c");
    expect((html.match(/<ul>/g) ?? []).length).toBe(2);
    expect(html).toContain("<p>Some prose here</p>");
  });

  it("returns to the outer list after a nested block", () => {
    const html = render("1. one\n   - inner\n2. two");
    expect(html.match(/<ol>/g) ?? []).toHaveLength(1);
    expect(html).toContain("<li>two</li>");
  });
});
