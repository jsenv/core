/**
 * Resize.js - Element Resize Manager
 *
 * This module provides a complete solution for making HTML elements resizable
 * with proper space distribution among siblings. It works for both horizontal and
 * vertical resizing while maintaining the integrity of the overall layout.
 *
 * Key features:
 * - Enables resizing via data-resize="horizontal|vertical|both" attribute
 * - Intelligently distributes space among sibling elements
 * - Respects min-width/min-height constraints of all elements
 * - Dispatches custom events (resizestart, resize, resizeend)
 * - Preserves layout integrity by ensuring all available space is used
 * - Supports flex layouts by temporarily disabling flex behavior during resize
 * - Provides percentage-based size calculations for responsive designs
 *
 * Usage:
 * 1. Add data-resize="horizontal" to any element you want to make resizable
 * 2. Add a resize handle with data-resize-handle attribute
 * 3. The module automatically handles mouse events and resizing logic
 *
 * Example:
 * <div style="display: flex">
 *   <div data-resize="horizontal" style="width: 200px">
 *     Resizable content
 *     <div data-resize-handle></div>
 *   </div>
 *   <div>Adjacent content that will adapt</div>
 * </div>
 *
 */

import { addAttributeEffect } from "../add_attribute_effect.js";
import { setStyles } from "../style_and_attributes.js";
import { canTakeSize } from "./can_take_size.js";
import { getAvailableWidth } from "./get_available_width.js";
import { getHeight } from "./get_height.js";
import { getMinWidth } from "./get_min_width.js";
import { getWidth } from "./get_width.js";

const style = /*css*/ `
   *[data-force-resize] {
     flex-shrink: 1 !important; /* flex-shrink !== 0 would prevent element to grow as much as it could  */
     flex-grow: 0 !important; /* flex-grow !== 0 would prevent element to shrink as much as it could */
     flex-basis: auto !important; /* flex-basis !== auto would prevent element to grow as much as it could */ 
   }`;
document.head.appendChild(document.createElement("style")).textContent = style;

const start = (event) => {
  if (event.button !== 0) {
    return;
  }
  const target = event.target;
  if (!target.closest) {
    return;
  }
  const elementWithDataResizeHandle = target.closest("[data-resize-handle]");
  if (!elementWithDataResizeHandle) {
    return;
  }
  let elementToResize;
  const dataResizeHandle =
    elementWithDataResizeHandle.getAttribute("data-resize-handle");
  if (!dataResizeHandle || dataResizeHandle === "true") {
    elementToResize = elementWithDataResizeHandle.closest("[data-resize]");
  } else {
    elementToResize = document.querySelector(`#${dataResizeHandle}`);
  }
  if (!elementToResize) {
    console.warn("No element to resize found");
    return;
  }
  // inspired by https://developer.mozilla.org/en-US/docs/Web/CSS/resize
  // "horizontal", "vertical", "both"
  const direction = elementToResize.getAttribute("data-resize");
  const horizontalResizeEnabled =
    direction === "horizontal" || direction === "both";
  const verticalResizeEnabled =
    direction === "vertical" || direction === "both";
  if (!horizontalResizeEnabled && !verticalResizeEnabled) {
    return;
  }
  event.preventDefault();

  const endCallbackSet = new Set();

  const minWidthMap = new Map();
  const widthMap = new Map();

  const currentWidthMap = new Map();
  const setWidth = (element, width) => {
    if (currentWidthMap.get(element) === width) {
      return;
    }
    element.style.width = `${width}px`;
    currentWidthMap.set(element, width);
    dispatchResizeEvent(element);
  };
  const saveWidth = (element) => {
    const width = getWidth(element);
    widthMap.set(element, width);
    currentWidthMap.set(element, width);
    return width;
  };

  const widthAsPercentage = (width) => {
    const ratio = width / availableWidth;
    // const roundedRatio = Math.round(ratio * 10000) / 10000;
    const percentage = ratio * 100;
    return `${percentage}%`;
  };

  const parentElement = elementToResize.parentElement;
  const availableWidth = getAvailableWidth(elementToResize);

  const previousSiblingSet = new Set();
  const nextSiblingSet = new Set();
  const xAtStart = event.clientX;
  const yAtStart = event.clientY;
  const resizeInfo = {
    xAtStart,
    yAtStart,
    x: xAtStart,
    y: yAtStart,
    xMove: 0,
    yMove: 0,
  };

  {
    const minWidth = getMinWidth(elementToResize, availableWidth);
    minWidthMap.set(elementToResize, minWidth);
    saveWidth(elementToResize);
  }

  siblings: {
    const parentElementComputedStyle = window.getComputedStyle(parentElement);
    if (
      parentElementComputedStyle.display === "flex" &&
      parentElementComputedStyle.flexDirection === "row"
    ) {
      prev_siblings: {
        let previousSibling = elementToResize.previousElementSibling;
        while (previousSibling) {
          if (canTakeSize(previousSibling)) {
            minWidthMap.set(previousSibling, getMinWidth(previousSibling));
            saveWidth(previousSibling);
            previousSiblingSet.add(previousSibling);
          }
          previousSibling = previousSibling.previousElementSibling;
        }
      }
      next_siblings: {
        let nextSibling = elementToResize.nextElementSibling;
        while (nextSibling) {
          if (canTakeSize(nextSibling)) {
            minWidthMap.set(nextSibling, getMinWidth(nextSibling));
            saveWidth(nextSibling);
            nextSiblingSet.add(nextSibling);
          }
          nextSibling = nextSibling.nextElementSibling;
        }
      }
    }
  }

  const dispatchResizeStartEvent = () => {
    const resizeStartEvent = new CustomEvent("resizestart", {
      detail: resizeInfo,
    });
    elementToResize.dispatchEvent(resizeStartEvent);
  };
  const dispatchResizeEvent = () => {
    const resizeEvent = new CustomEvent("resize", { detail: resizeInfo });
    elementToResize.dispatchEvent(resizeEvent);
  };
  const dispatchResizeEndEvent = () => {
    const resizeEndEvent = new CustomEvent("resizeend", {
      detail: resizeInfo,
    });
    elementToResize.dispatchEvent(resizeEndEvent);
  };

  const computeSizeTransformMap = () => {
    const moveDelta = resizeInfo.xMove;
    if (moveDelta === 0) {
      return null;
    }

    let widthRemaining = 0;
    const sizeTransformMap = new Map();
    const requestShrink = (element, shrinkRequested) => {
      const minWidth = minWidthMap.get(element);
      const width = widthMap.get(element);
      const widthAfterShrink = width - shrinkRequested;

      if (widthAfterShrink <= minWidth) {
        const actualShrink = width - minWidth;
        sizeTransformMap.set(element, -actualShrink);
        widthRemaining += actualShrink;
        return actualShrink;
      }
      sizeTransformMap.set(element, -shrinkRequested);
      widthRemaining += shrinkRequested;
      return shrinkRequested;
    };
    const requestGrow = (element, growRequested) => {
      if (widthRemaining === 0) {
        return 0;
      }
      if (growRequested > widthRemaining) {
        const actualGrow = widthRemaining;
        sizeTransformMap.set(element, widthRemaining);
        widthRemaining = 0;
        return actualGrow;
      }
      sizeTransformMap.set(element, growRequested);
      widthRemaining -= growRequested;
      return growRequested;
    };
    const stealSpaceFromSiblings = (siblingSet, spaceToSteal) => {
      let spaceStolen = 0;
      let remainingSpaceToSteal = spaceToSteal;
      for (const sibling of siblingSet) {
        const shrink = requestShrink(sibling, remainingSpaceToSteal);
        if (!shrink) {
          continue;
        }
        spaceStolen += shrink;
        remainingSpaceToSteal -= shrink;
        if (remainingSpaceToSteal <= 0) {
          break;
        }
      }
      return spaceStolen;
    };
    const giveSpaceToSiblings = (siblingSet, spaceToGive) => {
      let spaceGiven = 0;
      let remainingSpaceToGive = spaceToGive;
      for (const sibling of siblingSet) {
        const grow = requestGrow(sibling, remainingSpaceToGive);
        if (!grow) {
          continue;
        }
        spaceGiven += grow;
        remainingSpaceToGive -= grow;
        if (remainingSpaceToGive <= 0) {
          break;
        }
      }
      return spaceGiven;
    };

    // move right
    if (moveDelta > 0) {
      let remainingMoveToApply = moveDelta;
      if (nextSiblingSet.size === 0) {
        const shrink = requestShrink(elementToResize, remainingMoveToApply);
        if (shrink) {
          giveSpaceToSiblings(previousSiblingSet, shrink);
        }
        return sizeTransformMap;
      }
      const spaceStolenNext = stealSpaceFromSiblings(
        nextSiblingSet,
        remainingMoveToApply,
      );
      if (spaceStolenNext) {
        sizeTransformMap.set(elementToResize, spaceStolenNext);
        return sizeTransformMap;
      }
      const shrink = requestShrink(elementToResize, remainingMoveToApply);
      if (shrink) {
        giveSpaceToSiblings(previousSiblingSet, shrink);
      }
      return sizeTransformMap;
    }
    // move left
    let remainingMoveToApply = -moveDelta;
    if (previousSiblingSet.size === 0) {
      const shrink = requestShrink(elementToResize, remainingMoveToApply);
      if (shrink) {
        giveSpaceToSiblings(nextSiblingSet, shrink);
      }
      return sizeTransformMap;
    }
    const spaceStolenPrev = stealSpaceFromSiblings(
      previousSiblingSet,
      remainingMoveToApply,
    );
    if (spaceStolenPrev) {
      sizeTransformMap.set(elementToResize, spaceStolenPrev);
      return sizeTransformMap;
    }
    const shrink = requestShrink(elementToResize, remainingMoveToApply);
    if (shrink) {
      giveSpaceToSiblings(nextSiblingSet, shrink);
    }
    return sizeTransformMap;
  };

  const syncSizesWithPosition = ({ isEnd } = {}) => {
    const sizeTransformMap = computeSizeTransformMap();
    if (!sizeTransformMap) {
      return null;
    }

    for (const element of [
      ...previousSiblingSet,
      elementToResize,
      ...nextSiblingSet,
    ]) {
      const width = widthMap.get(element);
      const delta = sizeTransformMap.get(element);
      if (delta) {
        const newWidth = width + delta;
        if (isEnd && !elementToResize.hasAttribute("data-resize-absolute")) {
          const percentage = widthAsPercentage(newWidth);
          element.style.width = percentage;
        } else {
          setWidth(element, newWidth);
        }
      } else {
        if (isEnd && !elementToResize.hasAttribute("data-resize-absolute")) {
          const percentage = widthAsPercentage(width);
          element.style.width = percentage;
        }
        setWidth(element, width);
      }
    }
    return sizeTransformMap;
  };
  const handleMouseMove = (e) => {
    resizeInfo.x = e.clientX;
    resizeInfo.y = e.clientY;
    resizeInfo.xMove = resizeInfo.x - xAtStart;
    resizeInfo.yMove = resizeInfo.y - yAtStart;
    syncSizesWithPosition();
  };

  const backdrop = document.createElement("div");
  backdrop.style.position = "fixed";
  backdrop.style.inset = "0";
  backdrop.style.cursor =
    direction === "horizontal"
      ? "ew-resize"
      : direction === "vertical"
        ? "ns-resize"
        : "nwse-resize";
  backdrop.style.userSelect = "none";

  const handleMouseUp = (e) => {
    e.preventDefault();
    resizeInfo.x = e.clientX;
    resizeInfo.y = e.clientY;
    resizeInfo.xMove = resizeInfo.x - xAtStart;
    resizeInfo.yMove = resizeInfo.y - yAtStart;
    syncSizesWithPosition({ isEnd: true });
    for (const endCallback of endCallbackSet) {
      endCallback();
    }
    dispatchResizeEndEvent();
  };

  document.body.appendChild(backdrop);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  elementToResize.setAttribute("data-resizing", "");
  endCallbackSet.add(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.removeChild(backdrop);
    elementToResize.removeAttribute("data-resizing");
  });
  dispatchResizeStartEvent();
};

document.addEventListener(
  "mousedown",
  (e) => {
    start(e);
  },
  {
    capture: true,
  },
);

addAttributeEffect("data-resize", (element) => {
  const direction = element.getAttribute("data-resize");
  const horizontalResizeEnabled =
    direction === "horizontal" || direction === "both";
  const verticalResizeEnabled =
    direction === "vertical" || direction === "both";
  if (!horizontalResizeEnabled && !verticalResizeEnabled) {
    return null;
  }

  const cleanupCallbackSet = new Set();

  // disable flex stuff to ensure element can be resized
  force_resizable: {
    if (horizontalResizeEnabled) {
      const width = getWidth(element);
      const restoreInlineWidth = setStyles(element, {
        width: `${width}px`,
      });
      cleanupCallbackSet.add(() => {
        restoreInlineWidth();
      });
    }
    if (verticalResizeEnabled) {
      const restoreInlineHeight = setStyles(element, {
        height: `${getHeight(element)}px`,
      });
      cleanupCallbackSet.add(() => {
        restoreInlineHeight();
      });
    }
    element.setAttribute("data-force-resize", "");
    cleanupCallbackSet.add(() => {
      element.removeAttribute("data-force-resize");
    });
  }

  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
});
