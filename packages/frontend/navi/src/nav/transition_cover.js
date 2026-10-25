/**
 * What covers the box a route movement plays in, from INSIDE the document: a
 * sticky row of tabs above a `<RouteTravel>`, a header pinned to the top of a
 * scroller. The element says it is there, this measures what it takes and
 * publishes it under --navi-transition-cover-* — the slot transition_window.js
 * declares and explains, and which nothing but the element covering the box can
 * fill: the safe area answers for what is pinned to the WINDOW's edges, and a
 * sticky row is none of those.
 *
 * The pictures of a transition are drawn in the top layer, above every z-index
 * of the document, so a band left uncounted here is a band the pictures slide
 * over instead of being cut at.
 *
 * Same shape as the room a fixed bar gives back (layout/fixed_bar/
 * fixed_bar_space.js): measured rather than declared, and the largest of the
 * elements sharing an edge rather than their sum — during a route movement the
 * outgoing and the incoming row are both mounted, pinned to the same edge, one
 * over the other.
 *
 * A page that fits the free band takes its height from these variables too
 * (docs/safe_area.md), so they are written when a layout may follow. A size a
 * render caused is written where it is measured, in that commit: a movement
 * starting on that render is cut at the row as it now is, and the page sized
 * from it moves in the frame the row does. A size no render caused waits for
 * the frame its resize produced, as a fixed bar's does: written from inside a
 * resize callback, it resizes the page there, and the browser reports a
 * ResizeObserver loop for every observer of what that moved.
 */

import { useLayoutEffect, useRef } from "preact/hooks";

import { installTransitionWindowCss } from "./transition_window.js";

const sizeMapByEdge = new Map();
// What is currently on <html> for each edge (absent = the variable is not set).
// Several elements sharing an edge means most calls compute the same largest
// size again, and a size that has not changed is a style recalculation of the
// whole document for nothing.
const writtenValueByEdge = new Map();

/**
 * @param {import("preact").RefObject<Element>} elementRef - The element
 *   covering the box.
 * @param {"top"|"right"|"bottom"|"left"} [edge="top"] - Which side of the box
 *   it covers. Its size across that edge is what gets published; the edge's own
 *   band (the safe area, the fixed bars) is already counted, so an element
 *   states its own size and nothing else.
 */
export const useTransitionCover = (elementRef, edge = "top") => {
  installTransitionWindowCss();

  // The element observed, followed from commit to commit: the ref can point at
  // another element than the one there at mount (a row swapped for another, one
  // drawn later), and the one it no longer points at must stop counting.
  const observedRef = useRef(null);
  const stopObserving = () => {
    const observed = observedRef.current;
    if (!observed) {
      return;
    }
    observedRef.current = null;
    observed.resizeObserver.disconnect();
    writeCover(observed.edge, observed.element, null);
  };

  // Anything a render can change — the row's content, a size prop, a theme
  // variable — is measured in that same commit: a movement starting on the
  // render that grew the row is cut at the row as it now is.
  useLayoutEffect(() => {
    const element = elementRef.current;
    const observed = observedRef.current;
    if (observed && (observed.element !== element || observed.edge !== edge)) {
      stopObserving();
    }
    if (!element) {
      return;
    }
    if (!observedRef.current) {
      // What no render caused: a font arriving late, content coming from
      // outside, a rotation.
      const resizeObserver = new ResizeObserver(() => {
        requestCover(edge, element, measureCover(element, edge));
      });
      resizeObserver.observe(element);
      observedRef.current = { element, edge, resizeObserver };
    }
    writeCover(edge, element, measureCover(element, edge));
  });
  useLayoutEffect(() => stopObserving, []);
};

const measureCover = (element, edge) => {
  const { width, height } = element.getBoundingClientRect();
  return edge === "left" || edge === "right" ? width : height;
};

// The sizes a resize said, written in the frame it produced (see the top of
// this file). A write for the same element in between is newer and wins.
const pendingCoverByElement = new Map();
let pendingCoverFrame = null;
const requestCover = (edge, element, size) => {
  pendingCoverByElement.set(element, { edge, size });
  if (pendingCoverFrame !== null) {
    return;
  }
  pendingCoverFrame = requestAnimationFrame(() => {
    pendingCoverFrame = null;
    const pendingCovers = [...pendingCoverByElement];
    pendingCoverByElement.clear();
    for (const [pendingElement, pending] of pendingCovers) {
      writeCover(pending.edge, pendingElement, pending.size);
    }
  });
};

const writeCover = (edge, element, size) => {
  pendingCoverByElement.delete(element);
  let sizeMap = sizeMapByEdge.get(edge);
  if (!sizeMap) {
    sizeMap = new Map();
    sizeMapByEdge.set(edge, sizeMap);
  }
  if (size === null) {
    sizeMap.delete(element);
  } else {
    sizeMap.set(element, size);
  }
  let largestSize = 0;
  for (const coverSize of sizeMap.values()) {
    if (coverSize > largestSize) {
      largestSize = coverSize;
    }
  }
  const property = `--navi-transition-cover-${edge}`;
  const { style } = document.documentElement;
  if (sizeMap.size === 0) {
    // Back to the zero the sheet declares, rather than a zero written over it:
    // a page with no sticky row must read what navi says, not what the last one
    // left behind.
    if (writtenValueByEdge.has(edge)) {
      writtenValueByEdge.delete(edge);
      style.removeProperty(property);
    }
    return;
  }
  const value = `${largestSize}px`;
  if (writtenValueByEdge.get(edge) === value) {
    return;
  }
  writtenValueByEdge.set(edge, value);
  style.setProperty(property, value);
};
