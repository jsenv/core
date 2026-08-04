/**
 * A table of contents read off the document instead of written by hand.
 *
 * Every demo had its own: a nested list of links, maintained alongside the
 * sections it points at and quietly wrong whenever one was renamed, reordered
 * or removed. The headings already say all of it — their text, their nesting,
 * and (through the anchor link inside them) where they are — so this walks them
 * and builds the tree.
 *
 * Not exported from the package: it answers "what is in this document", which
 * is a demo's question, not an application's.
 *
 * A MutationObserver rather than a one-off scan, because a demo's sections are
 * rendered by the same render this sits in — half of them do not exist yet when
 * it first runs — and several appear later still (a section behind a "Render"
 * button, a heading inside a slide). Re-reading the document is cheap next to
 * getting it wrong.
 */

import { useEffect, useRef, useState } from "preact/hooks";

import { Link } from "../nav/link/link.jsx";

const css = /* css */ `
  .navi_document_toc {
    margin: 0;
    padding-left: 20px;
    line-height: 1.9;
  }
  .navi_document_toc ul {
    margin: 0;
    padding-left: 20px;
    list-style: circle;
  }
  /* Deeper entries read as detail of the one above rather than as siblings of
     it — same shape the hand-written tables of contents had. */
  .navi_document_toc ul a {
    color: #555;
    font-size: 0.9rem;
  }
`;

/**
 * @param {object} props
 * @param {string} [props.rootSelector="body"] - What to read the headings from.
 * @param {number} [props.from=2] - The first heading level to list. 2 by
 *   default: an h1 is the page's own name, not a section of it.
 * @param {number} [props.to=3] - The last one. Deeper headings are ignored
 *   rather than nested forever — a table of contents that lists everything is
 *   the document again.
 */
export const DocumentToc = ({ rootSelector = "body", from = 2, to = 3 }) => {
  import.meta.css = css;
  const ref = useRef();
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    const root = document.querySelector(rootSelector);
    if (!root) {
      return null;
    }
    const read = () => {
      setEntries((previous) => {
        // Its own block is skipped: a table of contents naming the block it
        // sits in tells the reader where they already are.
        const own = findOwnBlock(ref.current, root);
        const next = readHeadings(root, from, to, own);
        // The observer fires on every render of every section; replacing the
        // state each time would re-render this list (and re-trigger the
        // observer) for nothing.
        return sameEntries(previous, next) ? previous : next;
      });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
    };
  }, [rootSelector, from, to]);

  return (
    <ol ref={ref} className="navi_document_toc">
      {renderLevel(entries, from)}
    </ol>
  );
};

// The block the table of contents lives in — the nearest ancestor that holds a
// heading, which is the one that heading names. Found by walking rather than by
// matching a class, because what wraps a section differs from one document to
// the next (a <section>, a .demo-section, a plain div).
//
// The walk stops before the root on purpose: a table of contents sitting
// directly in the document belongs to no block in particular, and taking the
// root would skip every heading there is.
const findOwnBlock = (tocElement, root) => {
  let candidate = tocElement?.parentElement;
  while (candidate && candidate !== root) {
    if (candidate.querySelector(HEADING_SELECTOR)) {
      return candidate;
    }
    candidate = candidate.parentElement;
  }
  return null;
};

// Where a link to this heading would point, if anywhere.
//
// Its own id first, then the one on the anchor link inside it — demos put
// `<Link anchor href="#x">` in their headings, and that link is what owns the
// id (see any demo's own Heading helper). Failing both, the id of the block the
// heading names: a section written as `<div id="basic"><h2>Basic form</h2>…` is
// extremely common, and jumping to the block is jumping to the heading.
//
// That last fallback only applies when the heading is the FIRST one in that
// block — otherwise every heading of a long wrapper would claim the wrapper's
// own id and they would all link to the same place.
const readHeadingId = (heading) => {
  if (heading.id) {
    return heading.id;
  }
  const anchor = heading.querySelector("[id]");
  if (anchor) {
    return anchor.id;
  }
  const container = heading.parentElement?.closest("[id]");
  if (container && container.querySelector(HEADING_SELECTOR) === heading) {
    return container.id;
  }
  return "";
};
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";

// Without the anchor affordance: the "#" a heading shows on hover is part of
// its text content and would otherwise be listed as part of its name.
const readHeadingText = (heading) => {
  const clone = heading.cloneNode(true);
  for (const anchor of clone.querySelectorAll("a")) {
    anchor.remove();
  }
  return clone.textContent.trim();
};

const readHeadings = (root, from, to, ignoredContainer) => {
  const selector = [];
  for (let level = from; level <= to; level++) {
    selector.push(`h${level}`);
  }
  const entries = [];
  for (const heading of root.querySelectorAll(selector.join(","))) {
    if (ignoredContainer && ignoredContainer.contains(heading)) {
      continue;
    }
    const text = readHeadingText(heading);
    if (!text) {
      continue;
    }
    entries.push({
      // May be empty: a heading nothing can link to is still part of what is in
      // the document, and leaving it out would silently misdescribe the page —
      // it is listed, just not as a link (see renderLevel).
      id: readHeadingId(heading),
      level: Number(heading.tagName.slice(1)),
      text,
    });
  }
  return entries;
};

const sameEntries = (a, b) => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((entry, index) => {
    const other = b[index];
    return (
      entry.id === other.id &&
      entry.level === other.level &&
      entry.text === other.text
    );
  });
};

// A key that survives an id-less heading: two of them would otherwise share the
// empty string.
const entryKey = (entry, index) => entry.id || `${entry.level}-${index}`;

// Walks the flat list into a nested one: a heading deeper than the level being
// rendered belongs to the entry above it, whatever the gap between the two
// levels (an h4 under an h2 with no h3 in between still nests once).
const renderLevel = (entries, level) => {
  const items = [];
  let index = 0;
  while (index < entries.length) {
    const entry = entries[index];
    if (entry.level < level) {
      break;
    }
    if (entry.level > level) {
      index++;
      continue;
    }
    let end = index + 1;
    while (end < entries.length && entries[end].level > level) {
      end++;
    }
    const children = entries.slice(index + 1, end);
    items.push(
      // Link, not a bare <a>: it is what the hand-written tables of contents
      // used, and what makes an entry follow the same visited/active/readonly
      // treatment as every other link in the page. Plain text when there is
      // nothing to link to — the entry still says what is in the document.
      <li key={entryKey(entry, index)}>
        {entry.id ? (
          <Link href={`#${entry.id}`}>{entry.text}</Link>
        ) : (
          <span>{entry.text}</span>
        )}
        {children.length > 0 && <ul>{renderLevel(children, level + 1)}</ul>}
      </li>,
    );
    index = end;
  }
  return items;
};
