/**
 * Finds the element that is too wide for the page and says which one it is.
 *
 * A page that overflows horizontally is a bug wherever it happens, and on
 * Chrome Android it is a catastrophic one: the layout viewport inflates to the
 * content and `position: fixed` centering goes with it (see
 * docs/safe_area.md#a-document-wider-than-the-screen). The remedy there is a
 * wrapper in `overflow-x: clip`, and it works — at the price of making the
 * cause invisible: nothing sticks out anymore, so nothing says a fixed width, a
 * `min-width` or an unbreakable string is still oversized. This puts the
 * signal back, without giving up the net.
 *
 * What counts as "too wide" is measured against the box that clips, not
 * against the document: with `clip` there is no scrollable overflow to read
 * (`scrollWidth` reports none), so the rectangles of the descendants are what
 * tells.
 *
 * Two things are deliberately not reported, because they cannot reach the
 * document:
 * - anything inside a box that clips or scrolls on its own — a wide table in
 *   its `overflow-x: auto` container is doing exactly what it should;
 * - anything out of flow in the viewport's own coordinates (`position: fixed`,
 *   the top layer), which contributes nothing to the document's overflow.
 */

import { getElementSignature } from "@jsenv/dom";

// Subpixel layout rounds rectangles up on boxes that fit exactly.
const OVERFLOW_TOLERANCE = 1;

const css = /* css */ `
  [data-navi-overflow-x] {
    outline: 2px dashed #e74c3c;
    outline-offset: -2px;
  }
`;

/**
 * @param {object} [options]
 * @param {Element} [options.root] The box the content must fit in. Left out,
 *   the wrapper an app puts around everything it draws (`overflow-x: clip`,
 *   docs/safe_area.md) when there is one, found down the boxes that are the
 *   only thing their parent draws — `<body>`, the mount point, the shell —
 *   and `<body>` otherwise. Measured from `<body>`, that wrapper would hold
 *   its own overflow and hide everything inside it.
 * @param {boolean} [options.highlight=true] Outline the culprits on screen.
 * @param {(overflows: Array<{element: Element, overflow: number, side: "left"|"right"}>) => void} [options.onDetect]
 *   Replaces the default console warning.
 * @returns {() => void} Stops watching.
 */
export const detectHorizontalOverflow = ({
  root,
  highlight = true,
  onDetect = warnOverflows,
} = {}) => {
  // Looked for at each detection rather than once: the wrapper is drawn by the
  // app, often after this is called at load.
  const resolveRoot = () => root || findPageWrapper() || document.body;
  let styleEl = null;
  if (highlight) {
    styleEl = document.createElement("style");
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  let highlightedSet = new Set();
  const detect = () => {
    const overflows = findOverflows(resolveRoot());
    if (highlight) {
      const nextHighlightedSet = new Set();
      for (const { element } of overflows) {
        element.setAttribute("data-navi-overflow-x", "");
        nextHighlightedSet.add(element);
      }
      for (const element of highlightedSet) {
        if (!nextHighlightedSet.has(element)) {
          element.removeAttribute("data-navi-overflow-x");
        }
      }
      highlightedSet = nextHighlightedSet;
    }
    if (overflows.length) {
      onDetect(overflows);
    }
  };

  // Measuring inside a resize callback is what makes the loop; wait for the
  // frame that resize produced.
  let frame = null;
  const requestDetect = () => {
    if (frame !== null) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = null;
      detect();
    });
  };

  // Resize catches the window narrowing and the content growing (the root gets
  // taller); mutations catch a wide element arriving without changing the
  // root's size.
  const observedRoot = root || document.body;
  const resizeObserver = new ResizeObserver(requestDetect);
  resizeObserver.observe(observedRoot);
  const mutationObserver = new MutationObserver(requestDetect);
  mutationObserver.observe(observedRoot, { subtree: true, childList: true });
  requestDetect();

  return () => {
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    for (const element of highlightedSet) {
      element.removeAttribute("data-navi-overflow-x");
    }
    highlightedSet.clear();
    if (styleEl) {
      styleEl.remove();
    }
  };
};

const warnOverflows = (overflows) => {
  for (const { element, overflow, side } of overflows) {
    console.warn(
      `${getElementSignature(element)} overflows the page by ${Math.round(
        overflow,
      )}px on the ${side}. Look for a width in px, a min-width, or an unbreakable string; if it is meant to be wider than the screen, give it its own "overflow-x: auto".`,
      element,
    );
  }
};

const findOverflows = (root) => {
  const rootRect = root.getBoundingClientRect();
  const rootStyle = getComputedStyle(root);
  // Only the end side is watched: what sticks out there is what the document
  // grows to hold, and what inflates the layout viewport. Past the start edge
  // the content is simply unreachable, and that is where the offscreen
  // patterns (a label parked at `left: -9999px`) live.
  const side = rootStyle.direction === "rtl" ? "left" : "right";
  const overflows = [];
  const collect = (parentEl) => {
    for (const el of parentEl.children) {
      const style = getComputedStyle(el);
      if (!isInDocumentFlow(el, style)) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        continue;
      }
      const overflow =
        side === "right"
          ? rect.right - rootRect.right
          : rootRect.left - rect.left;
      if (overflow > OVERFLOW_TOLERANCE) {
        // The outermost box that sticks out is the one to fix; its children
        // stick out because it does.
        overflows.push({ element: el, overflow, side });
        continue;
      }
      // A box holding its own horizontal overflow cannot leak into the page,
      // whatever it holds — a wide table in its own scroll box is right.
      if (style.overflowX !== "visible") {
        continue;
      }
      collect(el);
    }
  };
  collect(root);
  return overflows;
};

// Whether the box can make the document overflow at all: nothing hidden,
// nothing laid out against the viewport (position: fixed, the top layer).
const isInDocumentFlow = (el, style) => {
  if (style.display === "none" || style.position === "fixed") {
    return false;
  }
  if (
    el.hasAttribute("popover") ||
    // An idle PopupGroup is a box of the page (see popup_group.jsx).
    (el.tagName === "DIALOG" && !el.hasAttribute("navi-popup-group"))
  ) {
    return false;
  }
  return true;
};

// The box wrapping all the app draws: down from <body>, through boxes that are
// the only thing their parent draws, the first one holding its own horizontal
// overflow. Only that chain: a box clipping beside others (a slider, a
// carousel) clips its own part of the page on purpose, and is no wrapper.
const findPageWrapper = () => {
  let parentEl = document.body;
  while (parentEl) {
    let onlyChild = null;
    for (const el of parentEl.children) {
      if (!isInDocumentFlow(el, getComputedStyle(el))) {
        continue;
      }
      if (onlyChild) {
        return null;
      }
      onlyChild = el;
    }
    if (!onlyChild) {
      return null;
    }
    if (getComputedStyle(onlyChild).overflowX !== "visible") {
      return onlyChild;
    }
    parentEl = onlyChild;
  }
  return null;
};
