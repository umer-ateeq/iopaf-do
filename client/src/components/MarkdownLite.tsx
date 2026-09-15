import { Fragment, type ReactNode } from "react";

/**
 * A small markdown renderer for assistant replies.
 *
 * The rich alternative, Streamdown, brings Shiki and Mermaid with it — every
 * syntax grammar and the whole diagram stack, which is how this project ended
 * up shipping ~15 MB of chunks. Copilot answers are headings, prose, bullets
 * and the occasional code fence, so that machinery buys nothing here.
 *
 * Everything is rendered as React elements. There is no
 * dangerouslySetInnerHTML anywhere, so model output cannot inject markup, and
 * link targets are restricted to http(s).
 */

type Token = { text: string; code?: boolean; bold?: boolean; italic?: boolean; href?: string };

/** Split one line into styled runs. Order matters: code wins over emphasis. */
function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  // `code` | [label](url) | **bold** | __bold__ | *italic* | _italic_
  const pattern =
    /(`[^`]+`)|(\[[^\]]+\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line))) {
    if (match.index > last) tokens.push({ text: line.slice(last, match.index) });
    const value = match[0];

    if (value.startsWith("`")) {
      tokens.push({ text: value.slice(1, -1), code: true });
    } else if (value.startsWith("[")) {
      const split = value.indexOf("](");
      const label = value.slice(1, split);
      const url = value.slice(split + 2, -1);
      // Only http(s) may become a link; anything else stays literal text.
      tokens.push(
        /^https?:\/\//i.test(url) ? { text: label, href: url } : { text: value }
      );
    } else if (value.startsWith("**") || value.startsWith("__")) {
      tokens.push({ text: value.slice(2, -2), bold: true });
    } else {
      tokens.push({ text: value.slice(1, -1), italic: true });
    }
    last = match.index + value.length;
  }

  if (last < line.length) tokens.push({ text: line.slice(last) });
  return tokens;
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {tokenize(text).map((token, i) => {
        if (token.code) return <code key={i}>{token.text}</code>;
        if (token.href)
          return (
            <a key={i} href={token.href} target="_blank" rel="noopener noreferrer nofollow">
              {token.text}
            </a>
          );
        if (token.bold) return <strong key={i}>{token.text}</strong>;
        if (token.italic) return <em key={i}>{token.text}</em>;
        return <Fragment key={i}>{token.text}</Fragment>;
      })}
    </>
  );
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;

export function MarkdownLite({ children }: { children: string }) {
  const lines = children.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p${blocks.length}`}>
        <Inline text={paragraph.join(" ")} />
      </p>
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item, i) => (
      <li key={i}>
        <Inline text={item} />
      </li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={`l${blocks.length}`}>{items}</ol>
      ) : (
        <ul key={`l${blocks.length}`}>{items}</ul>
      )
    );
    list = null;
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code block: consume verbatim until the closing fence or the end.
    if (/^\s*```/.test(line)) {
      flushAll();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      blocks.push(
        <pre key={`c${blocks.length}`}>
          <code>{body.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length, 6);
      const Tag = `h${level}` as "h1";
      blocks.push(
        <Tag key={`h${blocks.length}`}>
          <Inline text={heading[2]} />
        </Tag>
      );
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      flushAll();
      blocks.push(<hr key={`r${blocks.length}`} />);
      continue;
    }

    const numbered = NUMBERED.exec(line);
    const bullet = BULLET.exec(line);
    if (numbered || bullet) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(numbered ? numbered[2] : bullet![1]);
      continue;
    }

    // A plain line directly under a list item continues that item.
    if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushAll();
  return <div className="markdown-lite">{blocks}</div>;
}
