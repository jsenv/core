import { getPaddingSizes } from "../../size/get_padding_sizes.js";
import { getStyle, setStyles } from "../../style/dom_styles.js";
import { isScrollable } from "./is_scrollable.js";
import { getSelfAndAncestorScrolls } from "./scroll_container.js";
import { measureScrollbar } from "./scrollbar_size.js";

/**
 * Prevents scrolling on all scrollable containers that are ancestors of (or
 * siblings preceding) `element`. Used when an overlay (popover, dialog) is
 * open and background scroll should be disabled.
 *
 * **Why padding instead of scrollbar-gutter?**
 * `scrollbar-gutter: stable` would be the modern, CSS-native way to reserve
 * the scrollbar lane before hiding overflow so the layout doesn't shift.
 * However it only works well when the element's design already accounts for
 * that reserved space. On arbitrary containers we can't assume that, so we
 * measure the actual scrollbar size and compensate with padding — a technique
 * that works regardless of how the element is styled.
 *
 * **What if the element already uses scrollbar-gutter?**
 * A non-"auto" `scrollbar-gutter` value signals that the element has its own
 * scrollbar-gutter strategy in place. In that case we skip the padding
 * compensation and rely on that strategy instead — adding padding on top of an
 * already-reserved gutter would double-count the space.
 *
 * @param {HTMLElement} element - The overlay element being shown. Its preceding
 *   siblings and all ancestor scroll containers will be scroll-locked.
 * @returns {() => void} Cleanup function that restores all modified styles.
 */
export const trapScrollInside = (element) => {
  const cleanupCallbackSet = new Set();

  // Collect every element to lock first (preceding scrollable siblings + all
  // ancestor scroll containers).
  const elementsToLock = [];
  let previous = element.previousSibling;
  while (previous) {
    if (previous.nodeType === 1 && isScrollable(previous)) {
      elementsToLock.push(previous);
    }
    previous = previous.previousSibling;
  }
  for (const selfOrAncestorScroll of getSelfAndAncestorScrolls(element)) {
    elementsToLock.push(selfOrAncestorScroll.scrollContainer);
  }

  // Phase 1 — MEASURE. Batch every layout/style read (scrollTop, scrollbar
  // size, padding) before any style write, so the layout that showModal
  // invalidated is recomputed once rather than thrashing between each write and
  // the next read. (measureScrollbar still forces its own reflow per element via
  // its probe node — that one is inherent.)
  const plans = elementsToLock.map((el) => {
    const savedScrollTop = el.scrollTop;
    const savedScrollLeft = el.scrollLeft;
    const scrollbarGutter = getStyle(el, "scrollbar-gutter");
    if (scrollbarGutter && scrollbarGutter !== "auto") {
      // The element manages its own gutter — just hide overflow, no padding.
      return {
        el,
        savedScrollTop,
        savedScrollLeft,
        styles: { overflow: "hidden" },
      };
    }
    const [scrollbarWidth, scrollbarHeight] = measureScrollbar(el);
    const { right, bottom } = getPaddingSizes(el);
    return {
      el,
      savedScrollTop,
      savedScrollLeft,
      styles: {
        "padding-right": `${right + scrollbarWidth}px`,
        "padding-bottom": `${bottom + scrollbarHeight}px`,
        "overflow": "hidden",
      },
    };
  });

  // Phase 2 — MUTATE. All style writes together.
  for (const { el, savedScrollTop, savedScrollLeft, styles } of plans) {
    const removeScrollLockStyles = setStyles(el, styles);
    cleanupCallbackSet.add(() => {
      removeScrollLockStyles();
      el.scrollTop = savedScrollTop;
      el.scrollLeft = savedScrollLeft;
    });
  }

  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
};
