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
 * over the other. Nothing takes its layout from these variables, though, so the
 * write happens where it is measured, with no frame to wait for.
 */

import { useLayoutEffect } from "preact/hooks";

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

  const measureCover = (element) => {
    const { width, height } = element.getBoundingClientRect();
    return edge === "left" || edge === "right" ? width : height;
  };

  // Anything a render can change — the row's content, a size prop, a theme
  // variable — is measured in that same commit: a movement starting on the
  // render that grew the row is cut at the row as it now is.
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    writeCover(edge, element, measureCover(element));
  });

  // What no render caused: a font arriving late, content coming from outside, a
  // rotation.
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return undefined;
    }
    const resizeObserver = new ResizeObserver(() => {
      writeCover(edge, element, measureCover(element));
    });
    resizeObserver.observe(element);
    return () => {
      resizeObserver.disconnect();
      writeCover(edge, element, null);
    };
  }, [edge]);
};

const writeCover = (edge, element, size) => {
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
