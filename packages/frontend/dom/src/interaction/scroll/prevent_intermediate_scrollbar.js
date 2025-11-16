import { getScrollBox } from "../../position/dom_coords.js";
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
  const scrollBox = getScrollBox(scrollContainer);
  const scrollContainerWidth = scrollBox.width + scrollbarWidth;
  const scrollContainerHeight = scrollBox.height + scrollbarHeight;

  const currentScrollbarState = getScrollbarState(fromWidth, fromHeight, {
    scrollContainerWidth,
    scrollContainerHeight,
    scrollbarWidth,
    scrollbarHeight,
  });
  const finalScrollbarState = getScrollbarState(toWidth, toHeight, {
    scrollContainerWidth,
    scrollContainerHeight,
    scrollbarWidth,
    scrollbarHeight,
  });
  if (
    currentScrollbarState.x === finalScrollbarState.x &&
    currentScrollbarState.y === finalScrollbarState.y
  ) {
    return () => {};
  }

  const maxWidth = Math.max(fromWidth, toWidth);
  const maxHeight = Math.max(fromHeight, toHeight);
  let intermediateX = false;
  // If X scrollbar doesn't exist in current OR final state, check for intermediate appearance
  if (!currentScrollbarState.x || !finalScrollbarState.x) {
    // X scrollbar could appear during transition if:
    // 1. Content width exceeds available width at any point during transition
    if (maxWidth > scrollContainerWidth) {
      intermediateX = true;
    }
    // 2. Y scrollbar appears during transition, reducing available X space
    else if (maxHeight > scrollContainerHeight) {
      // Y scrollbar would appear, check if this causes X scrollbar due to reduced space
      const availableWidthWithYScrollbar =
        scrollContainerWidth - scrollbarWidth;
      if (maxWidth > availableWidthWithYScrollbar) {
        intermediateX = true;
      }
    }
  }
  let intermediateY = false;
  // If Y scrollbar doesn't exist in current OR final state, check for intermediate appearance
  if (!currentScrollbarState.y || !finalScrollbarState.y) {
    // Y scrollbar could appear during transition if:
    // 1. Content height exceeds available height at any point during transition
    if (maxHeight > scrollContainerHeight) {
      intermediateY = true;
    }
    // 2. X scrollbar appears during transition, reducing available Y space
    else if (maxWidth > scrollContainerWidth) {
      // X scrollbar would appear, check if this causes Y scrollbar due to reduced space
      const availableHeightWithXScrollbar =
        scrollContainerHeight - scrollbarHeight;
      if (maxHeight > availableHeightWithXScrollbar) {
        intermediateY = true;
      }
    }
  }

  if (!intermediateX && !intermediateY) {
    return () => {};
  }

  // Apply prevention
  const originalOverflowX = scrollContainer.style.overflowX;
  const originalOverflowY = scrollContainer.style.overflowY;
  if (intermediateX) {
    scrollContainer.style.overflowX = "hidden";
  }
  if (intermediateY) {
    scrollContainer.style.overflowY = "hidden";
  }
  onPrevent?.({
    x: intermediateX,
    y: intermediateY,
    scrollContainer,
  });
  return () => {
    if (intermediateX) {
      scrollContainer.style.overflowX = originalOverflowX;
    }
    if (intermediateY) {
      scrollContainer.style.overflowY = originalOverflowY;
    }
    onRestore?.({
      x: intermediateX,
      y: intermediateY,
      scrollContainer,
    });
  };
};

const getScrollbarState = (
  contentWidth,
  contentHeight,
  {
    scrollContainerWidth,
    scrollContainerHeight,
    scrollbarWidth,
    scrollbarHeight,
  },
) => {
  let availableWidth = scrollContainerWidth;
  let availableHeight = scrollContainerHeight;
  const contentExceedsWidth = contentWidth > availableWidth;
  const contentExceedsHeight = contentHeight > availableHeight;

  // Start with basic overflow
  let x = contentExceedsWidth;
  let y = contentExceedsHeight;
  // If Y scrollbar appears, it reduces available X space
  if (y) {
    availableWidth -= scrollbarWidth;
    // Re-check X scrollbar with reduced space
    x = contentWidth > availableWidth;
  }
  // If X scrollbar appears, it reduces available Y space
  if (x) {
    availableHeight -= scrollbarHeight;
    // Re-check Y scrollbar with reduced space
    y = contentHeight > availableHeight;
  }

  return { x, y, availableWidth, availableHeight };
};
