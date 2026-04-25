import { getScrollContainer } from "./scroll_container.js";

// Scroll el into view accounting for sticky elements that may cover it.
// After the native scrollIntoView call, we find every sticky descendant of
// the scroll container and measure how much it overlaps the target from the
// top (sticky-top) or from the bottom (sticky-bottom), then correct scrollTop.
export const scrollIntoViewWithStickyAwareness = (el) => {
  el.scrollIntoView({ block: "nearest" });
  const scrollContainer = getScrollContainer(el);
  if (!scrollContainer) {
    return;
  }
  const elRect = el.getBoundingClientRect();
  const stickyEls = scrollContainer.querySelectorAll("*");
  let topCover = 0;
  let bottomCover = 0;
  for (const stickyEl of stickyEls) {
    const style = getComputedStyle(stickyEl);
    if (style.position !== "sticky") {
      continue;
    }
    const rect = stickyEl.getBoundingClientRect();
    if (style.top !== "auto") {
      // Sticky-top: covers the element from above
      const overlap = rect.bottom - elRect.top;
      if (overlap > topCover) {
        topCover = overlap;
      }
    }
    if (style.bottom !== "auto") {
      // Sticky-bottom: covers the element from below
      const overlap = elRect.bottom - rect.top;
      if (overlap > bottomCover) {
        bottomCover = overlap;
      }
    }
  }
  if (topCover > 0) {
    scrollContainer.scrollTop -= topCover;
  }
  if (bottomCover > 0) {
    scrollContainer.scrollTop += bottomCover;
  }
};
