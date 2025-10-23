/**
 * Resize.js - Element Resize Manager
 *
 * This module provides a comprehensive solution for making HTML elements resizable
 * with intelligent space distribution among siblings. It handles both horizontal and
 * vertical resizing while maintaining layout integrity.
 *
 * Key features:
 * - Makes elements resizable via data-resize="horizontal|vertical|both" attribute
 * - Intelligently distributes space among sibling elements during resize
 * - Respects min-width/min-height constraints of all affected elements
 * - Dispatches custom events (resizestart, resize, resizeend) with position info
 * - Preserves layout integrity by ensuring all available space is properly allocated
 * - Supports flex layouts by temporarily adjusting flex behavior during resize
 * - Provides percentage-based sizing for responsive layouts (without data-resize-absolute)
 * - Absolute pixel sizing when data-resize-absolute is specified
 * - Handles both grow and shrink operations with space redistribution
 *
 * Usage:
 * 1. Add data-resize="horizontal" (or "vertical"/"both") to elements you want resizable
 * 2. Add a resize handle with data-resize-handle attribute
 * 3. Optionally add data-resize-absolute to maintain pixel-based sizing
 *
 * Example:
 * <div style="display: flex">
 *   <div data-resize="horizontal" style="width: 200px">
 *     Resizable content
 *     <div data-resize-handle></div>
 *   </div>
 *   <div>Adjacent content that adapts automatically</div>
 * </div>
 *
 * Advanced usage:
 * - Target specific elements with data-resize-handle="elementId"
 * - Listen for resize events: element.addEventListener("resize", (e) => {...})
 * - Access resize information from event.detail (xMove, yMove, etc.)
 */

import { addAttributeEffect } from "../attr/add_attribute_effect.js";
import { canTakeSize } from "./can_take_size.js";
import { getAvailableHeight } from "./get_available_height.js";
import { getAvailableWidth } from "./get_available_width.js";
import { getHeight } from "./get_height.js";
import { getMinHeight } from "./get_min_height.js";
import { getMinWidth } from "./get_min_width.js";
import { getWidth } from "./get_width.js";

const style = /*css*/ `
   *[data-resize] {
     flex-shrink: 1 !important; /* flex-shrink === 0 would prevent element to shrink as much as it could */
     flex-grow: 0 !important; /* flex-grow === 1 (or more) would prevent element to shrink as much as it could */
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
  const resizeDirection = getResizeDirection(elementToResize);
  if (!resizeDirection.x && !resizeDirection.y) {
    return;
  }
  event.preventDefault();

  const endCallbackSet = new Set();
  const parentElement = elementToResize.parentElement;
  const availableWidth = getAvailableWidth(elementToResize);
  const availableHeight = getAvailableHeight(elementToResize);
  const xAtStart = event.clientX;
  const yAtStart = event.clientY;
  const resizeInfo = {
    xAtStart,
    yAtStart,
    x: xAtStart,
    y: yAtStart,
    xMove: 0,
    yMove: 0,

    availableWidth,
    availableHeight,
    widthAtStart: undefined,
    heightAtStart: undefined,
    width: undefined,
    height: undefined,
  };

  const horizontalPreviousSiblingSet = new Set();
  const horizontalNextSiblingSet = new Set();
  const minWidthMap = new Map();
  const widthMap = new Map();
  const currentWidthMap = new Map();
  const setWidth = (element, width) => {
    if (currentWidthMap.get(element) === width) {
      return;
    }
    element.style.width = `${width}px`;
    currentWidthMap.set(element, width);
    if (element === elementToResize) {
      resizeInfo.width = width;
    }
    dispatchResizeEvent(element);
  };
  const saveWidth = (element) => {
    const width = getWidth(element);
    widthMap.set(element, width);
    currentWidthMap.set(element, width);
    return width;
  };
  const setWidthAsPercentage = (element, width) => {
    currentWidthMap.set(element, width);
    const ratio = width / availableWidth;
    // const roundedRatio = Math.round(ratio * 10000) / 10000;
    const percentage = ratio * 100;
    element.style.width = `${percentage}%`;
    if (element === elementToResize) {
      resizeInfo.width = width;
    }
    dispatchResizeEvent(element);
  };

  const verticalPreviousSiblingSet = new Set();
  const verticalNextSiblingSet = new Set();
  const minHeightMap = new Map();
  const heightMap = new Map();
  const currentHeightMap = new Map();
  const setHeight = (element, height) => {
    if (currentHeightMap.get(element) === height) {
      return;
    }
    element.style.height = `${height}px`;
    currentHeightMap.set(element, height);
    if (element === elementToResize) {
      resizeInfo.height = height;
    }
    dispatchResizeEvent(element);
  };
  const saveHeight = (element) => {
    const height = getHeight(element);
    heightMap.set(element, height);
    currentHeightMap.set(element, height);
    return height;
  };
  const setHeightAsPercentage = (element, height) => {
    currentHeightMap.set(element, height);
    const ratio = height / availableHeight;
    // const roundedRatio = Math.round(ratio * 10000) / 10000;
    const percentage = ratio * 100;
    element.style.height = `${percentage}%`;
    if (element === elementToResize) {
      resizeInfo.height = height;
    }
    dispatchResizeEvent(element);
  };

  size_and_min_size: {
    if (resizeDirection.x) {
      const width = saveWidth(elementToResize);
      resizeInfo.widthAtStart = width;
      resizeInfo.width = width;
      const minWidth = getMinWidth(elementToResize, availableWidth);
      minWidthMap.set(elementToResize, minWidth);
    }

    if (resizeDirection.y) {
      const height = saveHeight(elementToResize);
      resizeInfo.heightAtStart = height;
      resizeInfo.height = height;
      const minHeight = getMinHeight(elementToResize, availableHeight);
      minHeightMap.set(elementToResize, minHeight);
    }
  }

  const horizontallyResizableElementSet = new Set();
  const verticallyResizableElementSet = new Set();
  const detectResizableDirections = (element) => {
    const elementResizeDirection = getResizeDirection(element);
    if (elementResizeDirection.x) {
      horizontallyResizableElementSet.add(element);
    }
    if (elementResizeDirection.y) {
      verticallyResizableElementSet.add(element);
    }
    return elementResizeDirection.x || elementResizeDirection.y;
  };
  const detectResizableSibling = (sibling, resizableElementSet) => {
    if (detectResizableDirections(sibling)) {
      return;
    }
    const computedStyle = window.getComputedStyle(sibling);
    if (computedStyle.flexGrow === "1") {
      resizableElementSet.add(sibling);
    }
  };
  detectResizableDirections(elementToResize);

  siblings: {
    const parentElementComputedStyle = window.getComputedStyle(parentElement);
    if (resizeDirection.x) {
      horizontallyResizableElementSet.add(elementToResize);
      if (
        parentElementComputedStyle.display === "flex" &&
        parentElementComputedStyle.flexDirection === "row"
      ) {
        prev_siblings: {
          let previousSibling = elementToResize.previousElementSibling;
          while (previousSibling) {
            if (canTakeSize(previousSibling)) {
              minWidthMap.set(
                previousSibling,
                getMinWidth(previousSibling, availableWidth),
              );
              saveWidth(previousSibling);
              horizontalPreviousSiblingSet.add(previousSibling);
            }
            detectResizableSibling(
              previousSibling,
              horizontallyResizableElementSet,
            );
            previousSibling = previousSibling.previousElementSibling;
          }
        }
        next_siblings: {
          let nextSibling = elementToResize.nextElementSibling;
          while (nextSibling) {
            if (canTakeSize(nextSibling)) {
              minWidthMap.set(
                nextSibling,
                getMinWidth(nextSibling, availableWidth),
              );
              saveWidth(nextSibling);
              horizontalNextSiblingSet.add(nextSibling);
            }
            detectResizableSibling(
              nextSibling,
              horizontallyResizableElementSet,
            );
            nextSibling = nextSibling.nextElementSibling;
          }
        }
      }
    }

    if (resizeDirection.y) {
      verticallyResizableElementSet.add(elementToResize);
      if (
        parentElementComputedStyle.display === "flex" &&
        parentElementComputedStyle.flexDirection === "column"
      ) {
        prev_siblings: {
          let previousSibling = elementToResize.previousElementSibling;
          while (previousSibling) {
            if (canTakeSize(previousSibling)) {
              minHeightMap.set(
                previousSibling,
                getMinHeight(previousSibling, availableHeight),
              );
              saveHeight(previousSibling);
              verticalPreviousSiblingSet.add(previousSibling);
            }
            detectResizableSibling(
              previousSibling,
              verticallyResizableElementSet,
            );
            previousSibling = previousSibling.previousElementSibling;
          }
        }
        next_siblings: {
          let nextSibling = elementToResize.nextElementSibling;
          while (nextSibling) {
            if (canTakeSize(nextSibling)) {
              minHeightMap.set(
                nextSibling,
                getMinHeight(nextSibling, availableHeight),
              );
              saveHeight(nextSibling);
              verticalNextSiblingSet.add(nextSibling);
            }
            detectResizableSibling(nextSibling, verticallyResizableElementSet);
            nextSibling = nextSibling.nextElementSibling;
          }
        }
      }
    }
  }

  const dispatchResizeStartEvent = (element) => {
    const resizeStartEventDetail = {
      availableWidth,
      availableHeight,
      widthAtStart: widthMap.get(element),
      heightAtStart: heightMap.get(element),
      width: currentWidthMap.get(element),
      height: currentHeightMap.get(element),
    };

    const resizeStartEvent = new CustomEvent("resizestart", {
      detail: resizeStartEventDetail,
    });
    element.dispatchEvent(resizeStartEvent);
  };
  const dispatchResizeEvent = (element) => {
    const resizeEventDetail = {
      availableWidth,
      availableHeight,
      widthAtStart: widthMap.get(element),
      heightAtStart: heightMap.get(element),
      width: currentWidthMap.get(element),
      height: currentHeightMap.get(element),
    };

    const resizeEvent = new CustomEvent("resize", {
      detail: resizeEventDetail,
    });
    element.dispatchEvent(resizeEvent);
  };
  const dispatchResizeEndEvent = (element) => {
    const resizeEndEventDetail = {
      availableWidth,
      availableHeight,
      widthAtStart: widthMap.get(element),
      heightAtStart: heightMap.get(element),
      width: currentWidthMap.get(element),
      height: currentHeightMap.get(element),
    };

    const resizeEndEvent = new CustomEvent("resizeend", {
      detail: resizeEndEventDetail,
    });
    element.dispatchEvent(resizeEndEvent);
  };

  const computeSizeTransformMap = ({
    positionDelta,
    resizableElementSet,
    previousSiblingSet,
    nextSiblingSet,
    sizeMap,
    minSizeMap,
  }) => {
    if (positionDelta === 0) {
      return null;
    }

    let spaceRemaining = 0;
    const sizeTransformMap = new Map();
    const requestShrink = (element, shrinkRequested) => {
      if (!resizableElementSet.has(element)) {
        return 0;
      }
      const minSize = minSizeMap.get(element);
      const size = sizeMap.get(element);
      const sizeAfterShrink = size - shrinkRequested;

      if (sizeAfterShrink <= minSize) {
        const actualShrink = size - minSize;
        sizeTransformMap.set(element, -actualShrink);
        spaceRemaining += actualShrink;
        return actualShrink;
      }
      sizeTransformMap.set(element, -shrinkRequested);
      spaceRemaining += shrinkRequested;
      return shrinkRequested;
    };
    const requestGrow = (element, growRequested) => {
      if (!resizableElementSet.has(element)) {
        return 0;
      }
      if (spaceRemaining === 0) {
        return 0;
      }
      if (growRequested > spaceRemaining) {
        const actualGrow = spaceRemaining;
        sizeTransformMap.set(element, spaceRemaining);
        spaceRemaining = 0;
        return actualGrow;
      }
      sizeTransformMap.set(element, growRequested);
      spaceRemaining -= growRequested;
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

    if (positionDelta > 0) {
      let remainingMoveToApply = positionDelta;
      if (nextSiblingSet.size === 0) {
        if (previousSiblingSet.size === 0) {
          spaceRemaining = availableHeight;
          requestGrow(elementToResize, remainingMoveToApply);
          return sizeTransformMap;
        }
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
    let remainingMoveToApply = -positionDelta;
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
  const syncSizesWithPositionDelta = ({
    positionDelta,
    resizableElementSet,
    previousSiblingSet,
    nextSiblingSet,
    minSizeMap,
    sizeMap,
    setSizeAsPercentage,
    setSize,
    isEnd,
  } = {}) => {
    const sizeTransformMap = computeSizeTransformMap({
      positionDelta,
      resizableElementSet,
      previousSiblingSet,
      nextSiblingSet,
      minSizeMap,
      sizeMap,
    });
    if (!sizeTransformMap) {
      return null;
    }
    for (const element of [
      ...previousSiblingSet,
      elementToResize,
      ...nextSiblingSet,
    ]) {
      if (!resizableElementSet.has(element)) {
        continue;
      }
      const size = sizeMap.get(element);
      const delta = sizeTransformMap.get(element);
      const newSize = delta ? size + delta : size;
      if (isEnd && !elementToResize.hasAttribute("data-resize-absolute")) {
        setSizeAsPercentage(element, newSize);
      } else {
        setSize(element, newSize);
      }
    }
    return sizeTransformMap;
  };
  const syncHorizontalSizesWithPositionDelta = (
    positionDelta,
    { isEnd } = {},
  ) =>
    syncSizesWithPositionDelta({
      positionDelta,
      resizableElementSet: horizontallyResizableElementSet,
      previousSiblingSet: horizontalPreviousSiblingSet,
      nextSiblingSet: horizontalNextSiblingSet,
      minSizeMap: minWidthMap,
      sizeMap: widthMap,
      setSizeAsPercentage: setWidthAsPercentage,
      setSize: setWidth,
      isEnd,
    });
  const syncVerticalSizesWithPositionDelta = (positionDelta, { isEnd } = {}) =>
    syncSizesWithPositionDelta({
      positionDelta,
      resizableElementSet: verticallyResizableElementSet,
      previousSiblingSet: verticalPreviousSiblingSet,
      nextSiblingSet: verticalNextSiblingSet,
      minSizeMap: minHeightMap,
      sizeMap: heightMap,
      setSizeAsPercentage: setHeightAsPercentage,
      setSize: setHeight,
      isEnd,
    });

  const handleMouseMove = (e) => {
    if (resizeDirection.x) {
      resizeInfo.x = e.clientX;
      resizeInfo.xMove = resizeInfo.x - xAtStart;
      syncHorizontalSizesWithPositionDelta(resizeInfo.xMove);
    }
    if (resizeDirection.y) {
      resizeInfo.y = e.clientY;
      resizeInfo.yMove = resizeInfo.y - yAtStart;
      syncVerticalSizesWithPositionDelta(resizeInfo.yMove);
    }
  };
  const handleMouseUp = (e) => {
    e.preventDefault();
    if (resizeDirection.x) {
      resizeInfo.x = e.clientX;
      resizeInfo.xMove = resizeInfo.x - xAtStart;
      syncHorizontalSizesWithPositionDelta(resizeInfo.xMove, { isEnd: true });
    }
    if (resizeDirection.y) {
      resizeInfo.y = e.clientY;
      resizeInfo.yMove = resizeInfo.y - yAtStart;
      syncVerticalSizesWithPositionDelta(resizeInfo.yMove, { isEnd: true });
    }
    for (const endCallback of endCallbackSet) {
      endCallback();
    }
    dispatchResizeEndEvent(elementToResize);
  };

  const backdrop = document.createElement("div");
  backdrop.style.position = "fixed";
  backdrop.style.inset = "0";
  backdrop.style.cursor =
    resizeDirection.x && resizeDirection.y
      ? "nwse-resize"
      : resizeDirection.x
        ? "ew-resize"
        : "ns-resize";
  backdrop.style.userSelect = "none";
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
  dispatchResizeStartEvent(elementToResize);
};

const getResizeDirection = (element) => {
  const direction = element.getAttribute("data-resize");
  const x = direction === "horizontal" || direction === "both";
  const y = direction === "vertical" || direction === "both";
  return { x, y };
};

document.addEventListener(
  "mousedown",
  (e) => {
    start(e);
  },
  { capture: true },
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
    const distributeSpace = (
      element,
      { getAvailableSpace, getSize, setSize },
    ) => {
      const availableSpace = getAvailableSpace(element);
      const childMap = new Map();

      let totalSpace = 0;
      const childTakingFreeSpaceSet = new Set();
      for (const child of element.parentElement.children) {
        if (child.hasAttribute("data-resize")) {
          childTakingFreeSpaceSet.add(child);
        }
        if (canTakeSize(child)) {
          const size = getSize(child);
          childMap.set(child, size);
          totalSpace += size;
        }
      }
      const remainingSpace = availableSpace - totalSpace;
      if (remainingSpace > 0) {
        for (const child of childTakingFreeSpaceSet) {
          const size = childMap.get(child);
          const ratio = size / totalSpace;
          const additionalSpace = remainingSpace * ratio;
          const newSize = size + additionalSpace;
          setSize(child, newSize);
        }
      }
    };

    if (horizontalResizeEnabled) {
      distributeSpace(element, {
        getAvailableSpace: getAvailableWidth,
        getSize: getWidth,
        setSize: (element, width) => {
          element.style.width = `${width}px`;
        },
      });
    }
    if (verticalResizeEnabled) {
      distributeSpace(element, {
        getAvailableSpace: getAvailableHeight,
        getSize: getHeight,
        setSize: (element, height) => {
          element.style.height = `${height}px`;
        },
      });
    }
  }

  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
});
