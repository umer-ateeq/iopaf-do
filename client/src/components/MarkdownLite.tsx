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
/** Captures indentation so a sub-bullet becomes a child rather than a new list. */
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const NUMBERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const RULE = /^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/;

type ListNode = { ordered: boolean; indent: number; items: ItemNode[] };
type ItemNode = { text: string; child?: ListNode };

/** Render a list and any nested list inside its items. */
function renderList(list: ListNode, key: string): ReactNode {
  const items = list.items.map((item, i) => (
    <li key={i}>
      <Inline text={item.text} />
      {item.child ? renderList(item.child, `${key}-${i}`) : null}
    </li>
  ));
  return list.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
}

export function MarkdownLite({ children }: { children: string }) {
  const lines = children.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  let paragraph: string[] = [];
  // Open lists from outermost to innermost, so an indented marker can attach
  // to the item above it instead of starting a sibling list.
  let stack: ListNode[] = [];

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
    if (stack.length) blocks.push(renderList(stack[0], `l${blocks.length}`));
    stack = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  const addListItem = (indent: number, ordered: boolean, text: string) => {
    flushParagraph();

    // Close any list indented deeper than this marker.
    while (stack.length > 1 && indent < stack[stack.length - 1].indent) stack.pop();

    const current = stack[stack.length - 1];

    if (!current) {
      stack = [{ ordered, indent, items: [{ text }] }];
      return;
    }

    // Deeper than the open list: nest inside its most recent item.
    if (indent > current.indent + 1) {
      const parentItem = current.items[current.items.length - 1];
      if (parentItem.child && parentItem.child.ordered === ordered) {
        parentItem.child.items.push({ text });
        stack.push(parentItem.child);
      } else {
        const child: ListNode = { ordered, indent, items: [{ text }] };
        parentItem.child = child;
        stack.push(child);
      }
      return;
    }

    // Same level. A different marker type at the top level starts a new list;
    // nested, it replaces the child so numbering does not restart mid-list.
    if (current.ordered !== ordered) {
      if (stack.length === 1) {
        flushList();
        stack = [{ ordered, indent, items: [{ text }] }];
      } else {
        stack.pop();
        addListItem(indent, ordered, text);
      }
      return;
    }

    current.items.push({ text });
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
      // A blank line inside a list is a loose list, not the end of it; only
      // prose is flushed so numbering survives the gap.
      flushParagraph();
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

    if (RULE.test(line)) {
      flushAll();
      blocks.push(<hr key={`r${blocks.length}`} />);
      continue;
    }

    const numbered = NUMBERED.exec(line);
    if (numbered) {
      addListItem(numbered[1].length, true, numbered[3]);
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      addListItem(bullet[1].length, false, bullet[2]);
      continue;
    }

    // An indented plain line under a list item continues that item's text.
    if (stack.length && /^\s{2,}\S/.test(line)) {
      const open = stack[stack.length - 1];
      const item = open.items[open.items.length - 1];
      item.text += ` ${line.trim()}`;
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushAll();
  return <div className="markdown-lite">{blocks}</div>;
}
