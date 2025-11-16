import { getScrollBox } from "../../position/dom_coords.js";
import { getScrollContainer } from "./scroll_container.js";
import { measureScrollbar } from "./scrollbar_size.js";

export const preventIntermediateScrollbar = (
  element,
  { fromWidth, toWidth, fromHeight, toHeight, onPrevent, onRestore },
) => {
  const scrollContainer = getScrollContainer(element);
  const [scrollbarWidth, scrollbarHeight] = measureScrollbar(scrollContainer);

  // Get available content area (excluding scrollbars)
  const scrollBox = getScrollBox(scrollContainer);
  const scrollBoxWidth = scrollBox.width;
  const scrollBoxHeight = scrollBox.height;

  // Calculate available space accounting for potential scrollbars
  const availableWidthWithVerticalScrollbar = scrollBoxWidth - scrollbarWidth;
  const availableHeightWithHorizontalScrollbar =
    scrollBoxHeight - scrollbarHeight;

  // Check current scrollbar state
  const hasHorizontalScrollbar = scrollContainer.scrollWidth > scrollBoxWidth;
  const hasVerticalScrollbar = scrollContainer.scrollHeight > scrollBoxHeight;

  // Check if target state will need scrollbars
  const willNeedHorizontalScrollbar =
    toWidth > availableWidthWithVerticalScrollbar ||
    (toHeight > scrollBoxHeight &&
      toWidth > availableWidthWithVerticalScrollbar);
  const willNeedVerticalScrollbar =
    toHeight > availableHeightWithHorizontalScrollbar ||
    (toWidth > scrollBoxWidth &&
      toHeight > availableHeightWithHorizontalScrollbar);

  // Detect problematic scenarios during transition
  const maxTransitionWidth = Math.max(fromWidth, toWidth);
  const maxTransitionHeight = Math.max(fromHeight, toHeight);

  const willCreateTempHorizontalScrollbar =
    !hasHorizontalScrollbar &&
    !willNeedHorizontalScrollbar &&
    (maxTransitionWidth > scrollBoxWidth ||
      (maxTransitionHeight > scrollBoxHeight &&
        maxTransitionWidth > availableWidthWithVerticalScrollbar));

  const willCreateTempVerticalScrollbar =
    !hasVerticalScrollbar &&
    !willNeedVerticalScrollbar &&
    (maxTransitionHeight > scrollBoxHeight ||
      (maxTransitionWidth > scrollBoxWidth &&
        maxTransitionHeight > availableHeightWithHorizontalScrollbar));

  // Store original overflow styles of the scroll container
  const originalOverflowX = scrollContainer.style.overflowX;
  const originalOverflowY = scrollContainer.style.overflowY;

  if (!willCreateTempHorizontalScrollbar && !willCreateTempVerticalScrollbar) {
    return () => {};
  }

  // Temporarily hide overflow if needed
  if (willCreateTempHorizontalScrollbar) {
    scrollContainer.style.overflowX = "hidden";
  }
  if (willCreateTempVerticalScrollbar) {
    scrollContainer.style.overflowY = "hidden";
  }
  onPrevent({
    x: willCreateTempHorizontalScrollbar,
    y: willCreateTempVerticalScrollbar,
    scrollContainer,
  });
  return () => {
    if (willCreateTempHorizontalScrollbar) {
      scrollContainer.style.overflowX = originalOverflowX;
    }
    if (willCreateTempVerticalScrollbar) {
      scrollContainer.style.overflowY = originalOverflowY;
    }
    onRestore({
      x: willCreateTempHorizontalScrollbar,
      y: willCreateTempVerticalScrollbar,
      scrollContainer,
    });
  };
};
