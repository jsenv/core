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
  const lockScroll = (el) => {
    const scrollbarGutter = getStyle(el, "scrollbar-gutter");
    const hasScrollbarGutterStrategy =
      scrollbarGutter && scrollbarGutter !== "auto";
    if (hasScrollbarGutterStrategy) {
      // The element manages its own gutter — just hide overflow, no padding needed.
      const removeScrollLockStyles = setStyles(el, { overflow: "hidden" });
      cleanupCallbackSet.add(removeScrollLockStyles);
      return;
    }
    const [scrollbarWidth, scrollbarHeight] = measureScrollbar(el);
    const paddingRight = parseInt(getStyle(el, "padding-right"), 0);
    const paddingBottom = parseInt(getStyle(el, "padding-bottom"), 0);
    const removeScrollLockStyles = setStyles(el, {
      "padding-right": `${paddingRight + scrollbarWidth}px`,
      "padding-bottom": `${paddingBottom + scrollbarHeight}px`,
      "overflow": "hidden",
    });
    cleanupCallbackSet.add(removeScrollLockStyles);
  };
  let previous = element.previousSibling;
  while (previous) {
    if (previous.nodeType === 1) {
      if (isScrollable(previous)) {
        lockScroll(previous);
      }
    }
    previous = previous.previousSibling;
  }

  const selfAndAncestorScrolls = getSelfAndAncestorScrolls(element);
  for (const selfOrAncestorScroll of selfAndAncestorScrolls) {
    const elementToScrollLock = selfOrAncestorScroll.scrollContainer;
    lockScroll(elementToScrollLock);
  }

  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
};
