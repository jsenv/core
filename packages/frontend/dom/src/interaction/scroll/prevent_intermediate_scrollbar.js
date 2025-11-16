import { getScrollBox } from "../../position/dom_coords.js";
import { getScrollContainer } from "./scroll_container.js";
import { measureScrollbar } from "./scrollbar_size.js";

export const preventIntermediateScrollbar = (
  element,
  { fromWidth, toWidth, fromHeight, toHeight, onPrevent, onRestore },
) => {
  const scrollContainer = getScrollContainer(element);
  const [scrollbarWidth, scrollbarHeight] = measureScrollbar(scrollContainer);
  const scrollBox = getScrollBox(scrollContainer);
  const availableWidth = scrollBox.width;
  const availableHeight = scrollBox.height;
  const currentContentWidth = scrollContainer.scrollWidth;
  const currentContentHeight = scrollContainer.scrollHeight;
  const currentlyHasHorizontalScrollbar = currentContentWidth > availableWidth;
  const currentlyHasVerticalScrollbar = currentContentHeight > availableHeight;

  // Check if final state will need scrollbars
  const finalStateNeedsHorizontalScrollbar = toWidth > availableWidth;
  const finalStateNeedsVerticalScrollbar = toHeight > availableHeight;

  // If final state needs vertical scrollbar, it reduces horizontal space
  const finalStateNeedsVerticalScrollbarReducingHorizontalSpace =
    finalStateNeedsVerticalScrollbar &&
    toWidth > availableWidth - scrollbarWidth;

  // If final state needs horizontal scrollbar, it reduces vertical space
  const finalStateNeedsHorizontalScrollbarReducingVerticalSpace =
    finalStateNeedsHorizontalScrollbar &&
    toHeight > availableHeight - scrollbarHeight;

  const finalWillHaveHorizontalScrollbar =
    finalStateNeedsHorizontalScrollbar ||
    finalStateNeedsVerticalScrollbarReducingHorizontalSpace;
  const finalWillHaveVerticalScrollbar =
    finalStateNeedsVerticalScrollbar ||
    finalStateNeedsHorizontalScrollbarReducingVerticalSpace;

  // Early return: if current and final states both have the same scrollbar configuration
  if (
    currentlyHasHorizontalScrollbar === finalWillHaveHorizontalScrollbar &&
    currentlyHasVerticalScrollbar === finalWillHaveVerticalScrollbar
  ) {
    return () => {}; // No scrollbar state changes, no need to prevent anything
  }

  // Check dimensions during transition - compare both from and to with available space
  const transitionWillExceedHorizontalSpace =
    fromWidth > availableWidth || toWidth > availableWidth;
  const transitionWillExceedVerticalSpace =
    fromHeight > availableHeight || toHeight > availableHeight;

  // Detect when transition would temporarily create unwanted scrollbars
  const wouldCreateTemporaryHorizontalScrollbar =
    !currentlyHasHorizontalScrollbar &&
    !finalWillHaveHorizontalScrollbar &&
    (transitionWillExceedHorizontalSpace ||
      (transitionWillExceedVerticalSpace &&
        (fromWidth > availableWidth - scrollbarWidth ||
          toWidth > availableWidth - scrollbarWidth)));

  const wouldCreateTemporaryVerticalScrollbar =
    !currentlyHasVerticalScrollbar &&
    !finalWillHaveVerticalScrollbar &&
    (transitionWillExceedVerticalSpace ||
      (transitionWillExceedHorizontalSpace &&
        (fromHeight > availableHeight - scrollbarHeight ||
          toHeight > availableHeight - scrollbarHeight)));

  // Early return: no temporary scrollbars will be created
  if (
    !wouldCreateTemporaryHorizontalScrollbar &&
    !wouldCreateTemporaryVerticalScrollbar
  ) {
    return () => {}; // No problematic scrollbars during transition
  }

  // Store original overflow styles to restore later
  const originalOverflowX = scrollContainer.style.overflowX;
  const originalOverflowY = scrollContainer.style.overflowY;
  // Apply temporary overflow hidden to prevent unwanted scrollbars
  if (wouldCreateTemporaryHorizontalScrollbar) {
    scrollContainer.style.overflowX = "hidden";
  }
  if (wouldCreateTemporaryVerticalScrollbar) {
    scrollContainer.style.overflowY = "hidden";
  }
  onPrevent?.({
    x: wouldCreateTemporaryHorizontalScrollbar,
    y: wouldCreateTemporaryVerticalScrollbar,
    scrollContainer,
  });
  return () => {
    if (wouldCreateTemporaryHorizontalScrollbar) {
      scrollContainer.style.overflowX = originalOverflowX;
    }
    if (wouldCreateTemporaryVerticalScrollbar) {
      scrollContainer.style.overflowY = originalOverflowY;
    }
    onRestore?.({
      x: wouldCreateTemporaryHorizontalScrollbar,
      y: wouldCreateTemporaryVerticalScrollbar,
      scrollContainer,
    });
  };
};
