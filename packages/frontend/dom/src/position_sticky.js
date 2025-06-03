/**
 * Position Sticky Polyfill
 *
 * This module provides a workaround for position:sticky limitations when used with
 * overflow:auto/hidden parent elements (see https://github.com/w3c/csswg-drafts/issues/865).
 *
 * How it works:
 * 1. Creates a placeholder clone of the sticky element to maintain document flow
 * 2. Positions the real element using fixed positioning relative to viewport
 * 3. Adjusts position on scroll to emulate position:sticky behavior
 * 4. Handles parent boundary detection to keep element within its container
 * 5. Updates dimensions on resize and DOM changes
 *
 * Usage:
 * ```
 * const cleanup = initPositionSticky(element);
 * // Later when no longer needed
 * cleanup();
 * ```
 *
 * The element should have a CSS "top" value specified (e.g., top: 10px).
 */

import { getScrollableParentSet } from "./scroll.js";
import { getHeight } from "./size/get_height.js";
import { getWidth } from "./size/get_width.js";
import { forceStyles, setStyles } from "./style_and_attributes.js";

import.meta.css = /* css */ `
  [data-position-sticky-placeholder] {
    opacity: 0 !important;
    position: static !important;
    width: auto !important;
    height: auto !important;
  }
`;

export const initPositionSticky = (element) => {
  const computedStyle = getComputedStyle(element);
  const topCssValue = computedStyle.top;
  const top = parseFloat(topCssValue);
  if (isNaN(top)) {
    return () => {}; // Early return if no valid top value
  }

  // Skip polyfill if native position:sticky would work (no overflow:auto/hidden parents)
  const scrollableParentSet = getScrollableParentSet(element);
  check_overflow_on_parents: {
    let hasOverflowHiddenOrAuto = false;
    for (const scrollableParent of scrollableParentSet) {
      const scrollableParentComputedStyle = getComputedStyle(scrollableParent);
      const overflowX = scrollableParentComputedStyle.overflowX;
      if (overflowX === "auto" || overflowX === "hidden") {
        hasOverflowHiddenOrAuto = true;
        break;
      }
      const overflowY = scrollableParentComputedStyle.overflowY;
      if (overflowY === "auto" || overflowY === "hidden") {
        hasOverflowHiddenOrAuto = true;
        break;
      }
    }
    if (!hasOverflowHiddenOrAuto) {
      return () => {}; // Native sticky will work fine
    }
  }

  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const parentElement = element.parentElement;
  const createPlaceholderClone = () => {
    const clone = element.cloneNode(true);
    clone.setAttribute("data-position-sticky-placeholder", "");
    return clone;
  };

  let placeholder = createPlaceholderClone();
  parentElement.insertBefore(placeholder, element);

  let width = getWidth(element);
  let height = getHeight(element);

  const updateSize = () => {
    const newPlaceholder = createPlaceholderClone();
    parentElement.replaceChild(newPlaceholder, placeholder);
    placeholder = newPlaceholder;
    width = getWidth(placeholder);
    height = getHeight(placeholder);
    updatePosition();
  };

  const updatePosition = () => {
    // Ensure placeholder dimensions match element
    setStyles(placeholder, {
      width: `${width}px`,
      height: `${height}px`,
    });

    const placeholderRect = placeholder.getBoundingClientRect();
    const parentRect = parentElement.getBoundingClientRect();

    // Calculate left position in viewport coordinates (fixed positioning)
    const leftPosition = placeholderRect.left;
    element.style.left = `${Math.round(leftPosition)}px`;

    // Determine if element should be sticky or at its natural position
    let topPosition;
    let isStuck = false;

    // Check if we need to stick the element
    if (placeholderRect.top <= top) {
      // Element should be stuck at "top" position in the viewport
      topPosition = top;
      isStuck = true;

      // But make sure it doesn't go beyond parent's bottom boundary
      const parentBottom = parentRect.bottom;
      const elementBottom = top + height;

      if (elementBottom > parentBottom) {
        // Adjust to stay within parent
        topPosition = parentBottom - height;
      }
    } else {
      // Element should be at its natural position in the flow
      topPosition = placeholderRect.top;
    }

    element.style.top = `${topPosition}px`;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;

    // Set attribute for potential styling
    if (isStuck) {
      element.setAttribute("data-sticky", "");
    } else {
      element.removeAttribute("data-sticky");
    }
  };

  parent_is_relative: {
    // Ensure that the node will be positioned relatively to the parent node
    const restoreParentPositionStyle = forceStyles(parentElement, {
      position: "relative",
    });
    cleanupCallbackSet.add(restoreParentPositionStyle);
  }

  element_is_fixed: {
    const restorePositionStyle = forceStyles(element, {
      "position": "fixed",
      "z-index": 1,
      "will-change": "transform", // Hint for hardware acceleration
    });
    cleanupCallbackSet.add(restorePositionStyle);
  }

  updatePosition();

  update_on_scroll: {
    const handleScroll = () => {
      updatePosition();
    };

    for (const scrollableParent of scrollableParentSet) {
      scrollableParent.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      cleanupCallbackSet.add(() => {
        scrollableParent.removeEventListener("scroll", handleScroll, {
          passive: true,
        });
      });
    }
  }

  update_on_parent_size_change: {
    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    resizeObserver.observe(parentElement);
    cleanupCallbackSet.add(() => {
      resizeObserver.disconnect();
    });
  }

  update_on_dom_mutation: {
    const mutationObserver = new MutationObserver(() => {
      updateSize();
    });
    mutationObserver.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    cleanupCallbackSet.add(() => {
      mutationObserver.disconnect();
    });
  }

  return cleanup;
};
