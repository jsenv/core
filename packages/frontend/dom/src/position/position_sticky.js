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

import { getScrollContainerSet } from "../interaction/scroll/scroll_container.js";
import { getHeight } from "../size/get_height.js";
import { getWidth } from "../size/get_width.js";
import { forceStyles, setStyles } from "../style/dom_styles.js";

import.meta.css = /* css */ `
  [data-position-sticky-placeholder] {
    position: static !important;
    width: auto !important;
    height: auto !important;
    opacity: 0 !important;
  }
`;

export const initPositionSticky = (element) => {
  const computedStyle = getComputedStyle(element);
  const topCssValue = computedStyle.top;
  const top = parseFloat(topCssValue);
  const leftCssValue = computedStyle.left;
  const left = parseFloat(leftCssValue);
  const hasTop = !isNaN(top);
  const hasLeft = !isNaN(left);
  if (!hasTop && !hasLeft) {
    return () => {}; // Early return if no valid top or left value
  }

  // Skip polyfill if native position:sticky would work (no overflow:auto/hidden parents)
  const scrollContainerSet = getScrollContainerSet(element);
  // Determine per-axis whether an intermediate container blocks native sticky.
  // Native sticky fails only when there is a scroll container between the element
  // and the document with overflow set on that axis.
  let xScrollContainer = null; // first intermediate container blocking horizontal sticky
  let yScrollContainer = null; // first intermediate container blocking vertical sticky
  for (const scrollContainer of scrollContainerSet) {
    if (scrollContainer === document.documentElement) {
      break;
    }
    const style = getComputedStyle(scrollContainer);
    if (
      xScrollContainer === null &&
      (style.overflowX === "auto" ||
        style.overflowX === "hidden" ||
        style.overflowX === "scroll")
    ) {
      xScrollContainer = scrollContainer;
    }
    if (
      yScrollContainer === null &&
      (style.overflowY === "auto" ||
        style.overflowY === "hidden" ||
        style.overflowY === "scroll")
    ) {
      yScrollContainer = scrollContainer;
    }
  }
  const needsPolyfillX = hasLeft && xScrollContainer !== null;
  const needsPolyfillY = hasTop && yScrollContainer !== null;
  if (!needsPolyfillX && !needsPolyfillY) {
    return () => {}; // Native sticky will work fine on both axes
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
    clone.removeAttribute("data-sticky");
    return clone;
  };

  let placeholder = createPlaceholderClone();
  parentElement.insertBefore(placeholder, element);
  cleanupCallbackSet.add(() => {
    placeholder.remove();
  });

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

    // The CSS `top`/`left` values are offsets from the scroll container's edge.
    // getBoundingClientRect() always returns viewport coordinates (already accounting
    // for scroll position of all ancestors), so to convert the CSS offset to a
    // viewport threshold we add the scroll container's own viewport position.
    //
    // Example: main starts at viewport x=250, left=0 → leftThreshold=250.
    // After scrolling main 670px: placeholderRect.left = 250-670 = -420.
    // -420 <= 250 → stuck → element.style.left = 250px (main's left edge). ✓
    //
    // If no intermediate scroll container exists, use 0 (document/viewport edge).
    const yContainerRect = yScrollContainer
      ? yScrollContainer.getBoundingClientRect()
      : { top: 0 };
    const xContainerRect = xScrollContainer
      ? xScrollContainer.getBoundingClientRect()
      : { left: 0 };
    const topThreshold = yContainerRect.top + top;
    const leftThreshold = xContainerRect.left + left;

    // ── Vertical (top) ──────────────────────────────────────────────────────
    let topPosition;
    let isStuckVertically = false;
    if (hasTop) {
      if (placeholderRect.top <= topThreshold) {
        topPosition = topThreshold;
        isStuckVertically = true;
        // Don't go beyond parent's bottom boundary
        const parentBottom = parentRect.bottom;
        const elementBottom = topThreshold + height;
        if (elementBottom > parentBottom) {
          topPosition = parentBottom - height;
        }
      } else {
        topPosition = placeholderRect.top;
      }
    } else {
      topPosition = placeholderRect.top;
    }

    // ── Horizontal (left) ───────────────────────────────────────────────────
    let leftPosition;
    let isStuckHorizontally = false;
    if (hasLeft) {
      if (placeholderRect.left <= leftThreshold) {
        leftPosition = leftThreshold;
        isStuckHorizontally = true;
        // Don't go beyond parent's right boundary
        const parentRight = parentRect.right;
        const elementRight = leftThreshold + width;
        if (elementRight > parentRight) {
          leftPosition = parentRight - width;
        }
      } else {
        leftPosition = placeholderRect.left;
      }
    } else {
      leftPosition = placeholderRect.left;
    }

    element.style.top = `${topPosition}px`;
    element.style.left = `${Math.round(leftPosition)}px`;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;

    // Set attribute for potential styling
    if (isStuckVertically || isStuckHorizontally) {
      element.setAttribute("data-sticky", "");
    } else {
      element.removeAttribute("data-sticky");
    }
  };

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

    // Listen on all scroll containers (including document) since the element
    // uses position:fixed and any ancestor scroll changes its apparent position.
    const listenTargets = new Set(scrollContainerSet);
    listenTargets.add(document.documentElement);
    for (const scrollTarget of listenTargets) {
      scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
      cleanupCallbackSet.add(() => {
        scrollTarget.removeEventListener("scroll", handleScroll, {
          passive: true,
        });
      });
    }
  }

  update_on_parent_size_change: {
    let animationFrame = null;
    const resizeObserver = new ResizeObserver(() => {
      if (animationFrame !== null) {
        return;
      }
      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        updateSize();
      });
    });
    resizeObserver.observe(parentElement);
    cleanupCallbackSet.add(() => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
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
