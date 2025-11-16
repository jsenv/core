// import { getScrollBox } from "../../position/dom_coords.js";
import { getScrollContainer } from "./scroll_container.js";
import { measureScrollbar } from "./scrollbar_size.js";

/**
 * Prevents unwanted scrollbars during dimension transitions.
 *
 * Problem: When animating from one size to another, intermediate dimensions
 * might temporarily trigger scrollbars that shouldn't exist in the final state.
 * This creates visual flicker and layout shifts.
 *
 * Solution: Detect when intermediate animation frames would create problematic
 * scrollbars and temporarily hide overflow during the transition.
 */
export const preventIntermediateScrollbar = (
  element,
  { fromWidth, toWidth, fromHeight, toHeight, onPrevent, onRestore },
) => {
  const scrollContainer = getScrollContainer(element);
  const [scrollbarWidth, scrollbarHeight] = measureScrollbar(scrollContainer);
  // Calculate current state - what scrollbars exist now
  const currentScrollbarState = getScrollbarState(
    scrollContainer,
    fromWidth,
    fromHeight,
    scrollbarWidth,
    scrollbarHeight,
  );
  // Calculate final state - what scrollbars will exist when animation completes
  const finalScrollbarState = getScrollbarState(
    scrollContainer,
    toWidth,
    toHeight,
    scrollbarWidth,
    scrollbarHeight,
  );
  // If current and final states are the same, no intermediate prevention needed
  if (
    currentScrollbarState.hasXScrollbar === finalScrollbarState.hasXScrollbar &&
    currentScrollbarState.hasYScrollbar === finalScrollbarState.hasYScrollbar
  ) {
    return () => {};
  }

  // Check for problematic intermediate scrollbars
  // We need to prevent X scrollbar if it doesn't exist in current/final states but could appear during transition
  const needsXPrevention =
    !currentScrollbarState.hasXScrollbar &&
    !finalScrollbarState.hasXScrollbar &&
    (fromWidth > scrollContainer.offsetWidth ||
      toWidth > scrollContainer.offsetWidth ||
      // Or if Y scrollbar during transition would trigger X scrollbar
      (fromHeight > scrollContainer.offsetHeight &&
        fromWidth > scrollContainer.offsetWidth - scrollbarWidth) ||
      (toHeight > scrollContainer.offsetHeight &&
        toWidth > scrollContainer.offsetWidth - scrollbarWidth));

  // We need to prevent Y scrollbar if it doesn't exist in current/final states but could appear during transition
  const needsYPrevention =
    !currentScrollbarState.hasYScrollbar &&
    !finalScrollbarState.hasYScrollbar &&
    (fromHeight > scrollContainer.offsetHeight ||
      toHeight > scrollContainer.offsetHeight ||
      // Or if X scrollbar during transition would trigger Y scrollbar
      (fromWidth > scrollContainer.offsetWidth &&
        fromHeight > scrollContainer.offsetHeight - scrollbarHeight) ||
      (toWidth > scrollContainer.offsetWidth &&
        toHeight > scrollContainer.offsetHeight - scrollbarHeight));

  if (!needsXPrevention && !needsYPrevention) {
    return () => {};
  }

  // Apply prevention
  const originalOverflowX = scrollContainer.style.overflowX;
  const originalOverflowY = scrollContainer.style.overflowY;
  if (needsXPrevention) {
    scrollContainer.style.overflowX = "hidden";
  }
  if (needsYPrevention) {
    scrollContainer.style.overflowY = "hidden";
  }
  onPrevent?.({
    x: needsXPrevention,
    y: needsYPrevention,
    scrollContainer,
  });
  return () => {
    if (needsXPrevention) {
      scrollContainer.style.overflowX = originalOverflowX;
    }
    if (needsYPrevention) {
      scrollContainer.style.overflowY = originalOverflowY;
    }
    onRestore?.({
      x: needsXPrevention,
      y: needsYPrevention,
      scrollContainer,
    });
  };
};

/**
 * Calculate what scrollbars will exist for given dimensions.
 * Shows the progressive space reduction as scrollbars appear.
 */
const getScrollbarState = (
  scrollContainer,
  finalWidth,
  finalHeight,
  scrollbarWidth,
  scrollbarHeight,
) => {
  let availableWidth = scrollContainer.offsetWidth;
  let availableHeight = scrollContainer.offsetHeight;

  // Check if content exceeds container dimensions
  const contentExceedsWidth = finalWidth > availableWidth;
  const contentExceedsHeight = finalHeight > availableHeight;

  // Start with basic overflow
  let hasXScrollbar = contentExceedsWidth;
  let hasYScrollbar = contentExceedsHeight;

  // If Y scrollbar appears, it reduces available X space
  if (hasYScrollbar) {
    availableWidth -= scrollbarWidth;
    // Re-check X scrollbar with reduced space
    hasXScrollbar = finalWidth > availableWidth;
  }

  // If X scrollbar appears, it reduces available Y space
  if (hasXScrollbar) {
    availableHeight -= scrollbarHeight;
    // Re-check Y scrollbar with reduced space
    hasYScrollbar = finalHeight > availableHeight;
  }

  return { hasXScrollbar, hasYScrollbar, availableWidth, availableHeight };
};
