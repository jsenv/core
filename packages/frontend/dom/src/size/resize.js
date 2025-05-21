/**
 * TOFIX:
 *
 * when resizing A, C can move stangely
 */

import { addAttributeEffect } from "../add_attribute_effect.js";
import { setStyles } from "../style_and_attributes.js";
import { canTakeSize } from "./can_take_size.js";
import { getAvailableHeight } from "./get_available_height.js";
import { getAvailableWidth } from "./get_available_width.js";
import { getHeight } from "./get_height.js";
import { getMaxHeight } from "./get_max_height.js";
import { getMaxWidth } from "./get_max_width.js";
import { getMinHeight } from "./get_min_height.js";
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
  const setWidth = (element, width) => {
    element.style.width = `${width}px`;
    // widthMap.set(element, width);
  };

  const minHeightMap = new Map();
  const heightMap = new Map();
  const setHeight = (element, height) => {
    element.style.height = `${height}px`;
    heightMap.set(element, height);
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

  const parentElement = elementToResize.parentElement;
  {
    const availableWidth = getAvailableWidth(parentElement);
    const availableHeight = getAvailableHeight(parentElement);

    const minWidth = getMinWidth(elementToResize, availableWidth);
    minWidthMap.set(elementToResize, minWidth);
    const width = getWidth(elementToResize, availableWidth);
    widthMap.set(elementToResize, width);
    const maxWidth = ""; // TODO
    maxWidthMap.set(elementToResize, maxWidth);

    const minHeight = getMinHeight(elementToResize, availableHeight);
    minHeightMap.set(elementToResize, minHeight);
    const height = getHeight(elementToResize);
    heightMap.set(elementToResize, height);
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
            widthMap.set(previousSibling, getWidth(previousSibling));
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
            widthMap.set(nextSibling, getWidth(nextSibling));
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

  const giveSpaceToSiblings = (siblingSet, spaceToGive) => {
    let spaceGiven = 0;
    let growRemaining = spaceToGive;
    for (const sibling of siblingSet) {
      const growRequested = growRemaining;
      const width = widthMap.get(sibling);
      const widthAfterGrowRequested = width + growRequested;
      setWidth(sibling, widthAfterGrowRequested);
      growRemaining -= growRequested;
      spaceGiven += growRequested;
      if (growRemaining <= 0) {
        break;
      }
    }
    return spaceGiven;
  };
  const stealSpaceFromSiblings = (siblingSet, spaceToSteal) => {
    let spaceStolen = 0;
    let shrinkRemaining = spaceToSteal;
    for (const sibling of siblingSet) {
      const minWidth = minWidthMap.get(sibling);
      const width = widthMap.get(sibling);
      const widthAfterShrinkRequested = width - shrinkRemaining;
      let widthAfterShrink;
      let shrink;
      if (widthAfterShrinkRequested <= minWidth) {
        widthAfterShrink = minWidth;
        shrink = width - minWidth;
      } else {
        widthAfterShrink = widthAfterShrinkRequested;
        shrink = shrinkRemaining;
      }
      setWidth(sibling, widthAfterShrink);
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
    const applySelfShrink = (shrinkRequested, siblingSet) => {
      const minWidth = minWidthMap.get(elementToResize);
      const width = widthMap.get(elementToResize);
      const widthAfterShrinkRequested = width - shrinkRequested;
      let widthAfterShrink;
      let shrink;
      if (widthAfterShrinkRequested <= minWidth) {
        widthAfterShrink = minWidth;
        shrink = width - minWidth;
      } else {
        widthAfterShrink = widthAfterShrinkRequested;
        shrink = shrinkRequested;
      }
      setWidth(elementToResize, widthAfterShrink);
      giveSpaceToSiblings(siblingSet, shrink);
    };

    if (resizeInfo.xMove < 0) {
      if (previousSiblingSet.size === 0) {
        applySelfShrink(-resizeInfo.xMove, nextSiblingSet);
        return;
      }
      const spaceStolenFromPreviousSiblings = stealSpaceFromSiblings(
        previousSiblingSet,
        -resizeInfo.xMove,
      );
      if (spaceStolenFromPreviousSiblings === 0) {
        if (nextSiblingSet.size === 0) {
          return;
        }
        applySelfShrink(-resizeInfo.xMove, nextSiblingSet);
        return;
      }
      const elementWidth = widthMap.get(elementToResize);
      const elementNewSize = elementWidth + spaceStolenFromPreviousSiblings;
      setWidth(elementToResize, elementNewSize);
      return;
    }
    if (resizeInfo.xMove > 0) {
      if (nextSiblingSet.size === 0) {
        applySelfShrink(resizeInfo.xMove, previousSiblingSet);
        return;
      }
      const spaceStolenFromNextSiblings = stealSpaceFromSiblings(
        nextSiblingSet,
        resizeInfo.xMove,
      );
      if (spaceStolenFromNextSiblings === 0) {
        if (previousSiblingSet.size === 0) {
          return;
        }
        applySelfShrink(resizeInfo.xMove, previousSiblingSet);
        return;
      }
      const elementWidth = widthMap.get(elementToResize);
      const elementNewSize = elementWidth + spaceStolenFromNextSiblings;
      setWidth(elementToResize, elementNewSize);
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
