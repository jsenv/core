import { getScrollContainer } from "./scroll_container.js";

/**
 * Scrolls el into view (using the native "nearest" block behavior) and then
 * corrects for any sticky element that visually covers el inside its scroll
 * container.
 *
 * After the native scroll, this function iterates the siblings of el (children
 * of el's parent) and checks whether any of them uses `position: sticky` and
 * overlaps el. The largest overlap on each side is used to nudge scrollTop:
 * - sticky-top (top !== auto): subtract overlap so el appears below the header
 * - sticky-bottom (bottom !== auto): add overlap so el appears above the footer
 *
 * If el happens to be covered on both sides at once (extremely unlikely) the
 * correction picks whichever side was covered — the result may not be perfect
 * but avoids an infinite correction loop.
 *
 * @param {Element} el - The element to scroll into view.
 */
export const scrollIntoViewWithStickyAwareness = (el) => {
  el.scrollIntoView({ block: "nearest" });
  const scrollContainer = getScrollContainer(el);
  if (!scrollContainer) {
    return;
  }
  const elRect = el.getBoundingClientRect();
  let topCover = 0;
  let bottomCover = 0;
  for (const sibling of el.parentNode.children) {
    const style = getComputedStyle(sibling);
    if (style.position !== "sticky") {
      continue;
    }
    const rect = sibling.getBoundingClientRect();
    if (style.top !== "auto") {
      // Sticky-top: covers el from above — track the largest overlap.
      const overlap = rect.bottom - elRect.top;
      if (overlap > topCover) {
        topCover = overlap;
      }
    } else if (style.bottom !== "auto") {
      // Sticky-bottom: covers el from below — track the largest overlap.
      // Only checked when top is "auto" so each element is attributed to one
      // side only; both sides are still accumulated across all children.
      const overlap = elRect.bottom - rect.top;
      if (overlap > bottomCover) {
        bottomCover = overlap;
      }
    }
    if (topCover > 0 && bottomCover > 0) {
      // Both sides already have coverage — no point checking further children.
      break;
    }
  }
  if (topCover > 0) {
    scrollContainer.scrollTop -= topCover;
  }
  if (bottomCover > 0) {
    scrollContainer.scrollTop += bottomCover;
  }
};
