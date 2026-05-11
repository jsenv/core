import { useLayoutEffect } from "preact/hooks";

/**
 * CSS Highlight API integration for navi-search-match.
 *
 * Provides a shared `Highlight` instance registered as "navi-search-match"
 * and a `useSearchHighlight` hook that marks matching text ranges on an element.
 *
 * The highlight is not specific to ListItem — any element that wants to mark
 * search match ranges (e.g. Suggestion, custom search results) can use these.
 *
 * CSS to paint the highlight:
 *   ::highlight(navi-search-match) {
 *     color: var(--search-match-color);
 *     background-color: var(--search-match-background-color);
 *   }
 *
 * The `highlight` prop can be:
 *   - an array of [start, end] pairs — applied to all text nodes under the root element
 *   - an object { [domSelector]: [[start, end], …] } — applied to each sub-element
 *     matched by the selector (the format produced by createSearch)
 */

// Module-level shared Highlight instance — created lazily once.
let naviSearchHighlight = null;
export const getNaviSearchHighlight = () => {
  if (!CSS.highlights) {
    return null;
  }
  if (!naviSearchHighlight) {
    naviSearchHighlight = new Highlight();
    CSS.highlights.set("navi-search-match", naviSearchHighlight);
  }
  return naviSearchHighlight;
};

/**
 * useSearchHighlight — registers/unregisters CSS Highlight API ranges for an element.
 *
 * @param {import("preact").RefObject} ref - ref to the root element
 * @param {Array|Object|null|undefined} highlight - ranges to highlight
 * @param {Array} deps - additional dependencies that should retrigger the effect
 *                       (typically [children, hidden] from the consuming component)
 */
export const useSearchHighlight = (ref, highlight, deps = []) => {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !highlight) {
      return undefined;
    }
    return applySearchHighlight(el, highlight);
  }, [highlight, ...deps]);
};

const applySearchHighlight = (el, highlight) => {
  const hl = getNaviSearchHighlight();
  if (!hl) {
    return undefined;
  }

  // Normalise highlight to { root, ranges }[] entries.
  // Flat array → single entry scoped to the whole element.
  const entries = Array.isArray(highlight)
    ? highlight.length === 0
      ? []
      : [{ root: el, ranges: highlight }]
    : Object.entries(highlight).map(([selector, ranges]) => ({
        root: el.querySelector(selector) ?? el,
        ranges,
      }));

  if (entries.length === 0) {
    return undefined;
  }

  const ownRanges = [];
  for (const { root, ranges } of entries) {
    // Collect text nodes under root with cumulative character offsets so that
    // [start, end] ranges (positions in the field string) map directly to
    // the correct DOM text node positions without re-searching.
    const textNodes = [];
    let totalLength = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // Skip text nodes inside aria-hidden elements (icons, decorative content, etc.)
        let parent = node.parentElement;
        while (parent && parent !== root) {
          if (parent.getAttribute("aria-hidden") === "true") {
            return NodeFilter.FILTER_REJECT;
          }
          parent = parent.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push({ node, offset: totalLength });
      totalLength += node.textContent.length;
    }
    for (const [start, end] of ranges) {
      for (const { node: textNode, offset: nodeOffset } of textNodes) {
        const nodeEnd = nodeOffset + textNode.textContent.length;
        if (nodeEnd <= start || nodeOffset >= end) {
          continue;
        }
        const rangeStart = start - nodeOffset;
        const rangeEnd = end - nodeOffset;
        const range = new Range();
        range.setStart(textNode, rangeStart < 0 ? 0 : rangeStart);
        range.setEnd(
          textNode,
          rangeEnd > textNode.textContent.length
            ? textNode.textContent.length
            : rangeEnd,
        );
        hl.add(range);
        ownRanges.push(range);
      }
    }
  }
  return () => {
    for (const range of ownRanges) {
      hl.delete(range);
    }
  };
};
