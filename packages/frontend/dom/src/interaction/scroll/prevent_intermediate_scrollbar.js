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
  const availableWidth = scrollBox.width;
  const availableHeight = scrollBox.height;
  const currentContentWidth = scrollContainer.scrollWidth;
  const currentContentHeight = scrollContainer.scrollHeight;
  const currentlyHasXScrollbar = currentContentWidth > availableWidth;
  const currentlyHasYScrollbar = currentContentHeight > availableHeight;

  const finalStateNeedsXScrollbar = toWidth > availableWidth;
  const finalStateNeedsYScrollbar = toHeight > availableHeight;

  const finalStateNeedsYScrollbarReducingXSpace =
    finalStateNeedsYScrollbar && toWidth > availableWidth - scrollbarWidth;

  const finalStateNeedsXScrollbarReducingYSpace =
    finalStateNeedsXScrollbar && toHeight > availableHeight - scrollbarHeight;

  const finalWillHaveXScrollbar =
    finalStateNeedsXScrollbar || finalStateNeedsYScrollbarReducingXSpace;
  const finalWillHaveYScrollbar =
    finalStateNeedsYScrollbar || finalStateNeedsXScrollbarReducingYSpace;

  if (
    currentlyHasXScrollbar === finalWillHaveXScrollbar &&
    currentlyHasYScrollbar === finalWillHaveYScrollbar
  ) {
    return () => {};
  }

  const fromDimensionsExceedXSpace = fromWidth > availableWidth;
  const toDimensionsExceedXSpace = toWidth > availableWidth;
  const fromDimensionsExceedYSpace = fromHeight > availableHeight;
  const toDimensionsExceedYSpace = toHeight > availableHeight;

  const fromDimensionsWouldTriggerYScrollbarAffectingXSpace =
    fromHeight > availableHeight && fromWidth > availableWidth - scrollbarWidth;
  const toDimensionsWouldTriggerYScrollbarAffectingXSpace =
    toHeight > availableHeight && toWidth > availableWidth - scrollbarWidth;
  const fromDimensionsWouldTriggerXScrollbarAffectingYSpace =
    fromWidth > availableWidth &&
    fromHeight > availableHeight - scrollbarHeight;
  const toDimensionsWouldTriggerXScrollbarAffectingYSpace =
    toWidth > availableWidth && toHeight > availableHeight - scrollbarHeight;

  const problematicXScrollbarDuringTransition =
    !currentlyHasXScrollbar &&
    !finalWillHaveXScrollbar &&
    (fromDimensionsExceedXSpace ||
      toDimensionsExceedXSpace ||
      fromDimensionsWouldTriggerYScrollbarAffectingXSpace ||
      toDimensionsWouldTriggerYScrollbarAffectingXSpace);

  const problematicYScrollbarDuringTransition =
    !currentlyHasYScrollbar &&
    !finalWillHaveYScrollbar &&
    (fromDimensionsExceedYSpace ||
      toDimensionsExceedYSpace ||
      fromDimensionsWouldTriggerXScrollbarAffectingYSpace ||
      toDimensionsWouldTriggerXScrollbarAffectingYSpace);

  if (
    !problematicXScrollbarDuringTransition &&
    !problematicYScrollbarDuringTransition
  ) {
    return () => {};
  }

  const originalOverflowX = scrollContainer.style.overflowX;
  const originalOverflowY = scrollContainer.style.overflowY;

  if (problematicXScrollbarDuringTransition) {
    scrollContainer.style.overflowX = "hidden";
  }
  if (problematicYScrollbarDuringTransition) {
    scrollContainer.style.overflowY = "hidden";
  }
  onPrevent?.({
    x: problematicXScrollbarDuringTransition,
    y: problematicYScrollbarDuringTransition,
    scrollContainer,
  });
  return () => {
    if (problematicXScrollbarDuringTransition) {
      scrollContainer.style.overflowX = originalOverflowX;
    }
    if (problematicYScrollbarDuringTransition) {
      scrollContainer.style.overflowY = originalOverflowY;
    }
    onRestore?.({
      x: problematicXScrollbarDuringTransition,
      y: problematicYScrollbarDuringTransition,
      scrollContainer,
    });
  };
};
