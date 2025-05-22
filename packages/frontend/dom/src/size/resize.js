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
 */

import { addAttributeEffect } from "../add_attribute_effect.js";
import { setStyles } from "../style_and_attributes.js";
import { canTakeSize } from "./can_take_size.js";
import { getAvailableHeight } from "./get_available_height.js";
import { getAvailableWidth } from "./get_available_width.js";
import { getHeight } from "./get_height.js";
import { getMaxHeight } from "./get_max_height.js";
import { getMaxWidth } from "./get_max_width.js";
import { getMinWidth } from "./get_min_width.js";
import { getWidth } from "./get_width.js";

const style = /*css*/ `
   *[data-force-resize] {
     flex-shrink: 0 !important; /* flex-shrink !== 0 would prevent element to grow as much as it could  */
     flex-grow: 0 !important; /* flex-grow !== 0 would prevent element to shrink as much as it could */
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
  const maxWidthMap = new Map();

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

  const parentElement = elementToResize.parentElement;
  const availableWidth = getAvailableWidth(elementToResize);

  const getWidthRemainingFor = (element) => {
    let widthRemaining = availableWidth;
    for (const previousSibling of previousSiblingSet) {
      if (previousSibling !== element) {
        widthRemaining -= currentWidthMap.get(previousSibling);
      }
    }
    if (elementToResize !== element) {
      widthRemaining -= currentWidthMap.get(elementToResize);
    }
    for (const nextSibling of nextSiblingSet) {
      if (nextSibling !== element) {
        widthRemaining -= currentWidthMap.get(nextSibling);
      }
    }
    return widthRemaining;
  };

  const previousSiblingSet = new Set();
  const nextSiblingSet = new Set();
  const xAtStart = event.clientX;
  const yAtStart = event.clientY;
  const resizeInfo = {
    get widthAsPercentage() {
      const ratio = resizeInfo.width / resizeInfo.availableWidth;
      const roundedRatio = Math.round(ratio * 100) / 100;
      const percentage = roundedRatio * 100;
      return `${percentage}%`;
    },
    get heightAsPercentage() {
      const ratio = resizeInfo.height / resizeInfo.availableHeight;
      const roundedRatio = Math.round(ratio * 100) / 100;
      const percentage = roundedRatio * 100;
      return `${percentage}%`;
    },

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
    const maxWidth = ""; // TODO
    maxWidthMap.set(elementToResize, maxWidth);
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
            // const marginSizes = getMarginSizes(previousSibling);
            // const horizontalSpacing = marginSizes.left + marginSizes.right;
            // const minWidth = getMinWidth(previousSibling, availableWidth);
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
            // const marginSizes = getMarginSizes(nextSibling);
            // const horizontalSpacing = marginSizes.left + marginSizes.right;
            // const minWidth = getMinWidth(nextSibling, availableWidth);
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

  const requestShrink = (element, amount) => {
    const minWidth = minWidthMap.get(element);
    const width = widthMap.get(element);
    const widthAfterShrinkRequested = width - amount;
    if (widthAfterShrinkRequested <= minWidth) {
      setWidth(element, minWidth);
      return width - minWidth;
    }
    setWidth(element, widthAfterShrinkRequested);
    return amount;
  };
  const requestGrow = (element, amount) => {
    const widthRemaining = getWidthRemainingFor(element);
    const width = widthMap.get(element);
    const widthAfterGrowRequested = width + amount;
    if (widthAfterGrowRequested >= widthRemaining) {
      setWidth(element, widthRemaining);
      return widthRemaining - width;
    }
    setWidth(element, widthAfterGrowRequested);
    return amount;
  };
  const giveSpaceToSiblings = (siblingSet, spaceToGive) => {
    if (spaceToGive === 0) {
      return 0;
    }
    let spaceGiven = 0;
    let growRemaining = spaceToGive;
    for (const sibling of siblingSet) {
      const grow = requestGrow(sibling, growRemaining);
      growRemaining -= grow;
      spaceGiven += grow;
      if (growRemaining <= 0) {
        break;
      }
    }
    return spaceGiven;
  };
  const stealSpaceFromSiblings = (siblingSet, spaceToSteal) => {
    if (spaceToSteal === 0) {
      return 0;
    }
    let spaceStolen = 0;
    let shrinkRemaining = spaceToSteal;
    for (const sibling of siblingSet) {
      const shrink = requestShrink(sibling, shrinkRemaining);
      spaceStolen += shrink;
      shrinkRemaining -= shrink;
      if (shrinkRemaining <= 0) {
        break;
      }
    }
    return spaceStolen;
  };

  const updateSizeAfterMove = () => {
    if (resizeInfo.xMove === 0) {
      return;
    }

    if (resizeInfo.xMove < 0) {
      if (previousSiblingSet.size) {
        const spaceStolenFromPreviousSiblings = stealSpaceFromSiblings(
          previousSiblingSet,
          -resizeInfo.xMove,
        );
        if (spaceStolenFromPreviousSiblings) {
          requestGrow(elementToResize, spaceStolenFromPreviousSiblings);
          return;
        }
        const shrink = requestShrink(elementToResize, -resizeInfo.xMove);
        if (shrink) {
          giveSpaceToSiblings(nextSiblingSet, shrink);
        }
        return;
      }
      const shrink = requestShrink(elementToResize, -resizeInfo.xMove);
      if (shrink) {
        giveSpaceToSiblings(nextSiblingSet, shrink);
      }
      return;
    }
    if (resizeInfo.xMove > 0) {
      if (nextSiblingSet.size) {
        const spaceStolenFromNextSiblings = stealSpaceFromSiblings(
          nextSiblingSet,
          resizeInfo.xMove,
        );
        if (spaceStolenFromNextSiblings) {
          requestGrow(elementToResize, spaceStolenFromNextSiblings);
          return;
        }
        const grow = requestGrow(elementToResize, resizeInfo.xMove);
        if (grow) {
          stealSpaceFromSiblings(previousSiblingSet, grow);
        }
        return;
      }
      const shrink = requestShrink(elementToResize, resizeInfo.xMove);
      if (shrink) {
        giveSpaceToSiblings(previousSiblingSet, shrink);
      }
      return;
    }
  };
  const handleMouseMove = (e) => {
    resizeInfo.x = e.clientX;
    resizeInfo.y = e.clientY;
    resizeInfo.xMove = resizeInfo.x - xAtStart;
    resizeInfo.yMove = resizeInfo.y - yAtStart;
    updateSizeAfterMove();
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
    updateSizeAfterMove();
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
  if (horizontalResizeEnabled) {
    setWidth(elementToResize, widthMap.get(elementToResize));
  }
  if (verticalResizeEnabled) {
    elementToResize.style.height = `${resizeInfo.height}px`;
  }
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

  max_width_max_height: {
    const updateMaxSizes = (parentWidth, parentHeight) => {
      if (horizontalResizeEnabled) {
        const availableWidth = getAvailableWidth(element, parentWidth);
        const maxWidth = getMaxWidth(element, availableWidth);
        console.log({ maxWidth });
        // element.style.maxWidth = `${maxWidth}px`;
      }
      if (verticalResizeEnabled) {
        const availableHeight = getAvailableHeight(element, parentHeight);
        const maxHeight = getMaxHeight(element, availableHeight);
        console.log({ maxHeight });
        // element.style.maxHeight = `${maxHeight}px`;
      }
    };

    const parentElement = element.parentElement;
    // updateMaxSizes(getWidth(parentElement), getHeight(parentElement));
    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      updateMaxSizes(entry.contentRect.width, entry.contentRect.height);
    });
    resizeObserver.observe(parentElement);
    cleanupCallbackSet.add(() => {
      resizeObserver.unobserve(parentElement);
    });
  }

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
