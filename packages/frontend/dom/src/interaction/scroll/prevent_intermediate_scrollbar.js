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

  // Detect intermediate X scrollbar (appears during transition but not needed in final state)
  let intermediateX = false;
  if (!finalScrollbarState.x) {
    // Simulate worst case during transition - when both dimensions are at their maximum
    let availableWidth = scrollContainerWidth;
    let availableHeight = scrollContainerHeight;

    // Check if Y scrollbar would appear during transition
    const wouldHaveYDuringTransition = maxHeight > availableHeight;
    if (wouldHaveYDuringTransition) {
      availableWidth -= scrollbarWidth; // Y scrollbar reduces available X space
    }

    // Now check if X scrollbar would appear with potentially reduced space
    const wouldHaveXDuringTransition = maxWidth > availableWidth;

    // X scrollbar is intermediate/useless if it appears during transition but not in final state
    intermediateX = wouldHaveXDuringTransition && !finalScrollbarState.x;
  }

  // Detect intermediate Y scrollbar (appears during transition but not needed in final state)
  let intermediateY = false;
  if (!finalScrollbarState.y) {
    // Simulate worst case during transition - when both dimensions are at their maximum
    let availableWidth = scrollContainerWidth;
    let availableHeight = scrollContainerHeight;

    // Check if X scrollbar would appear during transition
    const wouldHaveXDuringTransition = maxWidth > availableWidth;
    if (wouldHaveXDuringTransition) {
      availableHeight -= scrollbarHeight; // X scrollbar reduces available Y space
    }

    // Now check if Y scrollbar would appear with potentially reduced space
    const wouldHaveYDuringTransition = maxHeight > availableHeight;

    // Y scrollbar is intermediate/useless if it appears during transition but not in final state
    intermediateY = wouldHaveYDuringTransition && !finalScrollbarState.y;
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
