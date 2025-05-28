/**
 *
 */

import { forceStyles } from "../style_and_attributes.js";
import { getHeight } from "./get_height.js";
import { getInnerHeight } from "./get_inner_height.js";
import { getMarginSizes } from "./get_margin_sizes.js";
import { getMinHeight } from "./get_min_height.js";
import { createSizeAnimationGroupController } from "./size_animation_group_controller.js";
import { startResizeGesture } from "./start_resize_gesture.js";

const HEIGHT_ANIMATION_DURATION = 300;
const DEBUG = true;

export const initFlexDetailsSet = (
  container,
  { onSizeChange, debug = DEBUG } = {},
) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
  const flexDetailsSet = {
    cleanup,
  };

  const spaceMap = new Map();
  const marginSizeMap = new Map();
  const requestedSpaceMap = new Map();
  const minSpaceMap = new Map();
  const allocatedSpaceMap = new Map();
  const canGrowSet = new Set();
  const canShrinkSet = new Set();
  let availableSpace;
  let remainingSpace;
  let lastChild;
  const openedDetailsArray = [];
  const spaceToSize = (element, space) => {
    const marginSize = marginSizeMap.get(element);
    return space - marginSize;
  };
  const prepareSpaceDistribution = () => {
    spaceMap.clear();
    marginSizeMap.clear();
    requestedSpaceMap.clear();
    minSpaceMap.clear();
    allocatedSpaceMap.clear();
    canGrowSet.clear();
    canShrinkSet.clear();
    availableSpace = getInnerHeight(container);
    remainingSpace = availableSpace;
    openedDetailsArray.length = 0;
    lastChild = null;
    if (debug) {
      console.debug(`availableSpace: ${availableSpace}px`);
    }

    for (const child of container.children) {
      lastChild = child;
      const marginSizes = getMarginSizes(child);
      const marginSize = marginSizes.top + marginSizes.bottom;
      marginSizeMap.set(child, marginSize);

      if (!isDetailsElement(child)) {
        const size = getHeight(child);
        spaceMap.set(child, size + marginSize);
        requestedSpaceMap.set(child, size + marginSize);
        minSpaceMap.set(child, size + marginSize);
        continue;
      }
      const details = child;
      let size;
      let requestedSize;
      let requestedSizeSource;
      let minSize;
      const summary = details.querySelector("summary");
      const summaryHeight = getHeight(summary);

      size = getHeight(details);

      if (details.open) {
        openedDetailsArray.push(details);
        canGrowSet.add(details);
        canShrinkSet.add(details);
        const detailsContent = details.querySelector("summary + *");
        const restoreSizeStyle = forceStyles(detailsContent, {
          height: "auto",
        });
        const detailsContentHeight = getHeight(detailsContent);
        restoreSizeStyle();
        const detailsHeight = summaryHeight + detailsContentHeight;

        if (details.hasAttribute("data-requested-height")) {
          const requestedHeightAttribute = details.getAttribute(
            "data-requested-height",
          );
          requestedSize = parseFloat(requestedHeightAttribute, 10);
          requestedSizeSource = "data-requested-height attribute";
        } else {
          requestedSize = detailsHeight;
          requestedSizeSource = "summary and content height";
        }

        const dataMinHeight = details.getAttribute("data-min-height");
        if (dataMinHeight) {
          minSize = parseFloat(dataMinHeight, 10);
        } else {
          minSize = getMinHeight(details, availableSpace);
        }
      } else {
        requestedSize = summaryHeight;
        requestedSizeSource = "summary height";
        minSize = summaryHeight;
      }
      spaceMap.set(details, size + marginSize);
      requestedSpaceMap.set(details, requestedSize + marginSize);
      minSpaceMap.set(details, minSize + marginSize);
      if (debug) {
        console.debug(
          `details ${details.id} space: ${spaceMap.get(details)}px, min space: ${minSpaceMap.get(details)}px, requested space: ${requestedSpaceMap.get(details)}px (${requestedSizeSource})`,
        );
      }
    }
  };

  const heightAnimationGroupController = createSizeAnimationGroupController({
    duration: HEIGHT_ANIMATION_DURATION,
    onChange: onSizeChange,
  });
  const applyAllocatedSpaces = ({ animate } = {}) => {
    const changeSet = new Set();
    for (const child of container.children) {
      const allocatedSpace = allocatedSpaceMap.get(child);
      const allocatedSize = spaceToSize(child, allocatedSpace);
      const space = spaceMap.get(child);
      const size = spaceToSize(child, space);
      if (size === allocatedSize) {
        continue;
      }
      if (isDetailsElement(child) && child.open) {
        const syncDetailsContentHeight = prepareSyncDetailsContentHeight(child);
        changeSet.add({
          element: child,
          target: allocatedSize,
          sideEffect: (height, isFinished) => {
            syncDetailsContentHeight(height, { isAnimation: !isFinished });
          },
        });
      } else {
        changeSet.add({
          element: child,
          target: allocatedSize,
        });
      }
    }

    if (changeSet.size === 0) {
      return;
    }

    if (!animate) {
      const sizeChangeEntries = [];
      for (const { element, target, sideEffect } of changeSet) {
        element.style.height = `${target}px`;
        if (sideEffect) {
          sideEffect(target);
        }
        sizeChangeEntries.push({ element, value: target });
      }
      onSizeChange?.(sizeChangeEntries);
      return;
    }

    const animations = [];
    for (const { element, target, sideEffect } of changeSet) {
      animations.push({
        element,
        target,
        sideEffect,
      });
    }
    heightAnimationGroupController.animateAll(animations);
  };

  const allocateSpace = (child, spaceToAllocate, requestSource) => {
    const requestedSpace = requestedSpaceMap.get(child);
    const canShrink = canShrinkSet.has(child);
    const canGrow = canGrowSet.has(child);

    let allocatedSpace;
    let allocatedSpaceSource;
    allocate: {
      const minSpace = minSpaceMap.get(child);
      if (spaceToAllocate > remainingSpace) {
        if (remainingSpace < minSpace) {
          allocatedSpace = minSpace;
          allocatedSpaceSource = "min space";
          break allocate;
        }
        allocatedSpace = remainingSpace;
        allocatedSpaceSource = "remaining space";
        break allocate;
      }
      if (spaceToAllocate < minSpace) {
        allocatedSpace = minSpace;
        allocatedSpaceSource = "min space";
        break allocate;
      }
      allocatedSpace = spaceToAllocate;
      allocatedSpaceSource = requestSource;
      break allocate;
    }

    if (allocatedSpace < requestedSpace) {
      if (!canShrink) {
        allocatedSpace = requestedSpace;
        allocatedSpaceSource = `${requestSource} + cannot shrink`;
      }
    } else if (allocatedSpace > requestedSpace) {
      if (!canGrow) {
        allocatedSpace = requestedSpace;
        allocatedSpaceSource = `${requestSource} + cannot grow`;
      }
    }

    remainingSpace -= allocatedSpace;
    if (debug) {
      if (allocatedSpace === spaceToAllocate) {
        console.debug(
          `${allocatedSpace}px allocated to ${child.id} (${allocatedSpaceSource}), remaining space: ${remainingSpace}px`,
        );
      } else {
        console.debug(
          `${allocatedSpace}px allocated to ${child.id} out of ${spaceToAllocate}px (${allocatedSpaceSource}), remaining space: ${remainingSpace}px`,
        );
      }
    }
    allocatedSpaceMap.set(child, allocatedSpace);
    return allocatedSpace;
  };
  const reallocateSpace = (child, newRequestedSpace, source) => {
    const allocatedSpace = allocatedSpaceMap.get(child);
    remainingSpace += allocatedSpace;
    if (debug) {
      console.debug(
        `reapplying requested space for ${child.id} (${source}), new requested space: ${newRequestedSpace}px, current allocated space: ${allocatedSpace}px, remaining space: ${remainingSpace}px`,
      );
    }
    return allocateSpace(child, newRequestedSpace, source);
  };
  const distributeAvailableSpace = (source) => {
    for (const child of container.children) {
      allocateSpace(child, requestedSpaceMap.get(child), source);
    }
  };
  const distributeRemainingSpace = ({ childToGrow, childToShrinkFrom }) => {
    if (!remainingSpace) {
      return;
    }
    if (remainingSpace < 0) {
      const spaceToSleal = -remainingSpace;
      if (debug) {
        console.debug(
          `remaining space is negative: ${remainingSpace}px, stealing ${spaceToSleal}px from child before ${childToShrinkFrom.id}`,
        );
      }
      allocateSpaceToPreviousSiblings(
        childToShrinkFrom,
        spaceToSleal,
        `remaining space is negative: ${remainingSpace}px`,
      );
      return;
    }
    if (childToGrow) {
      const allocatedSpace = allocatedSpaceMap.get(childToGrow);
      reallocateSpace(
        childToGrow,
        allocatedSpace + remainingSpace,
        `remaining space is positive: ${remainingSpace}px`,
      );
    }
  };

  const allocateSpaceToPreviousSiblings = (child, spaceToAllocate, source) => {
    let allocatedSpaceSum = 0;
    let remainingSpaceToAllocate = spaceToAllocate;
    let previousSibling = child.previousElementSibling;
    while (previousSibling) {
      const allocatedSpaceCurrent = allocatedSpaceMap.get(previousSibling);
      const allocatedSpace = reallocateSpace(
        previousSibling,
        allocatedSpaceCurrent - remainingSpaceToAllocate,
        source,
      );
      const allocatedSpaceDiff = allocatedSpaceCurrent - allocatedSpace;
      if (allocatedSpaceDiff) {
        allocatedSpaceSum += allocatedSpaceDiff;
        remainingSpaceToAllocate -= allocatedSpaceDiff;
        if (remainingSpaceToAllocate <= 0) {
          break;
        }
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    return allocatedSpaceSum ? { allocatedSpaceSum } : null;
  };

  const allocateSibling = (child, spaceToAllocate, reason) => {
    let nextSibling = child.nextElementSibling;
    while (nextSibling) {
      if (!isDetailsElement(nextSibling)) {
        nextSibling = nextSibling.nextElementSibling;
        continue;
      }
      const allocatedSpaceCurrent = allocatedSpaceMap.get(nextSibling);
      const allocatedSpace = reallocateSpace(
        nextSibling,
        allocatedSpaceCurrent - spaceToAllocate,
        reason,
      );
      const allocatedSpaceDiff = allocatedSpaceCurrent - allocatedSpace;
      if (!allocatedSpaceDiff) {
        nextSibling = nextSibling.nextElementSibling;
        continue;
      }
      return { child: nextSibling, allocatedSpace: allocatedSpaceDiff };
    }
    if (debug) {
      console.debug(
        "coult not allocate to next sibling, trying previous siblings",
      );
    }
    let previousSibling = child.previousElementSibling;
    while (previousSibling) {
      if (!isDetailsElement(previousSibling)) {
        previousSibling = previousSibling.previousElementSibling;
        continue;
      }
      const allocatedSpaceCurrent = allocatedSpaceMap.get(previousSibling);
      const allocatedSpace = reallocateSpace(
        previousSibling,
        allocatedSpaceCurrent - spaceToAllocate,
        reason,
      );
      const allocatedSpaceDiff = allocatedSpaceCurrent - allocatedSpace;
      if (!allocatedSpaceDiff) {
        previousSibling = previousSibling.previousElementSibling;
        continue;
      }
      return { child: previousSibling, allocatedSpace: allocatedSpaceDiff };
    }
    return null;
  };

  const saveCurrentSizeAsRequestedSizes = () => {
    for (const child of container.children) {
      if (canGrowSet.has(child) || canShrinkSet.has(child)) {
        const allocatedSpace = allocatedSpaceMap.get(child);
        child.setAttribute("data-requested-height", allocatedSpace);
      }
    }
  };

  initial_size: {
    prepareSpaceDistribution();
    distributeAvailableSpace("initial space distribution");
    distributeRemainingSpace({
      childToGrow: openedDetailsArray[openedDetailsArray.length - 1],
      childToShrinkFrom: lastChild,
    });
    spaceMap.clear(); // force to set size at start
    applyAllocatedSpaces();
    saveCurrentSizeAsRequestedSizes();
  }

  update_on_toggle: {
    const distributeSpaceAfterToggle = (details) => {
      const reason = details.open
        ? `${details.id} just opened`
        : `${details.id} just closed`;
      prepareSpaceDistribution();
      distributeAvailableSpace(reason);

      const requestedSpace = requestedSpaceMap.get(details);
      const allocatedSpace = allocatedSpaceMap.get(details);
      const spaceToAllocate = requestedSpace - allocatedSpace - remainingSpace;
      if (spaceToAllocate === 0) {
        distributeRemainingSpace({
          childToGrow: openedDetailsArray[openedDetailsArray.length - 1],
          childToShrinkFrom: lastChild,
        });
        return;
      }
      if (debug) {
        console.debug(
          `${details.id} would like to take ${requestedSpace}px (${reason}). Trying to allocate ${spaceToAllocate}px to previous siblings, remaining space: ${remainingSpace}px`,
        );
      }

      const siblingAllocationResult = allocateSibling(
        details,
        spaceToAllocate,
        reason,
      );
      if (siblingAllocationResult) {
        const { allocatedSpace } = siblingAllocationResult;
        if (debug) {
          if (allocatedSpace === spaceToAllocate) {
            console.debug(`${allocatedSpace}px allocated to sibling`);
          } else {
            console.debug(
              `${allocatedSpace}px allocated (out of ${spaceToAllocate}px) to sibling`,
            );
          }
        }
        reallocateSpace(details, requestedSpace, reason);
      } else {
        if (debug) {
          console.debug(
            `no space could be re-allocated to sibling, remaining space: ${remainingSpace}px`,
          );
        }
        distributeRemainingSpace({
          childToGrow: openedDetailsArray[0],
          childToShrinkFrom: lastChild,
        });
      }
    };

    for (const child of container.children) {
      if (!isDetailsElement(child)) {
        continue;
      }
      const details = child;
      const ontoggle = () => {
        distributeSpaceAfterToggle(details);
        applyAllocatedSpaces({ animate: true });
      };
      if (details.open) {
        setTimeout(() => {
          details.addEventListener("toggle", ontoggle);
        });
      } else {
        details.addEventListener("toggle", ontoggle);
      }
      cleanupCallbackSet.add(() => {
        details.removeEventListener("toggle", ontoggle);
      });
    }
  }

  resize_with_mouse: {
    const distributeSpaceAfterResize = (child, newSize) => {
      child.setAttribute("data-requested-height", newSize);
      prepareSpaceDistribution();
      const reason = `${child.id} resize requested to ${newSize}px`;
      distributeAvailableSpace(reason);

      const requestedSpace = requestedSpaceMap.get(child);
      const allocatedSpace = allocatedSpaceMap.get(child);
      const minSpace = minSpaceMap.get(child);
      let spaceToAllocate;
      if (requestedSpace < minSpace) {
        spaceToAllocate = minSpace - allocatedSpace - remainingSpace;
      } else {
        spaceToAllocate = requestedSpace - allocatedSpace - remainingSpace;
      }

      if (spaceToAllocate === 0) {
        distributeRemainingSpace({
          childToGrow: openedDetailsArray[openedDetailsArray.length - 1],
          childToShrinkFrom: lastChild,
        });
        return;
      }
      if (debug) {
        console.debug(
          `${child.id} would like to take ${requestedSpace}px (${reason}). Trying to allocate ${spaceToAllocate}px to sibling, remaining space: ${remainingSpace}px`,
        );
      }

      const previousSiblingsAllocationResult = allocateSpaceToPreviousSiblings(
        child,
        spaceToAllocate,
        reason,
      );

      if (previousSiblingsAllocationResult) {
        const { allocatedSpaceSum } = previousSiblingsAllocationResult;
        if (debug) {
          if (allocatedSpaceSum === spaceToAllocate) {
            console.debug(`${allocatedSpaceSum}px allocated to sibling`);
          } else {
            console.debug(
              `${allocatedSpaceSum}px allocated (out of ${spaceToAllocate}px) to sibling`,
            );
          }
        }
        reallocateSpace(child, requestedSpace, reason);
      } else {
        if (debug) {
          console.debug(
            `no space could be re-allocated to sibling, remaining space: ${remainingSpace}px`,
          );
        }
        distributeRemainingSpace({
          childToGrow: openedDetailsArray[0],
          childToShrinkFrom: lastChild,
        });
      }
    };

    const requestResize = (child, newSize) => {
      if (isNaN(newSize) || !isFinite(newSize)) {
        console.warn(
          `requestResize called with invalid size: ${newSize} for details ${child.id}`,
        );
        return;
      }
      distributeSpaceAfterResize(child, newSize);
      applyAllocatedSpaces();
    };

    const onmousedown = (event) => {
      let resizedElement;
      let heightAtStart = 0;
      startResizeGesture(event, {
        onStart: (gesture) => {
          resizedElement = gesture.element;
          heightAtStart = getHeight(resizedElement);
          requestResize(resizedElement, heightAtStart);
        },
        onMove: (gesture) => {
          const yMove = gesture.yMove;
          requestResize(resizedElement, heightAtStart - yMove);
        },
        onEnd: () => {
          saveCurrentSizeAsRequestedSizes();
        },
      });
    };
    container.addEventListener("mousedown", onmousedown);
    cleanupCallbackSet.add(() => {
      container.removeEventListener("mousedown", onmousedown);
    });
  }

  return flexDetailsSet;
};

const prepareSyncDetailsContentHeight = (details) => {
  const summary = details.querySelector("summary");
  const summaryHeight = getHeight(summary);
  const content = details.querySelector("summary + *");
  details.style.setProperty("--summary-height", `${summaryHeight}px`);
  content.style.height = "var(--content-height)";

  return (detailsHeight, { isAnimation } = {}) => {
    const contentHeight = detailsHeight - summaryHeight;
    details.style.setProperty("--details-height", `${detailsHeight}px`);
    details.style.setProperty("--content-height", `${contentHeight}px`);

    if (!isAnimation) {
      const contentComputedStyle = getComputedStyle(content);
      // Fix scrollbar induced overflow:
      //
      // 1. browser displays a scrollbar because there is an overflow inside overflow: auto
      // 2. we set height exactly to the natural height required to prevent overflow
      //
      // actual: browser keeps scrollbar displayed
      // expected: scrollbar is hidden
      //
      // Solution: Temporarily prevent scrollbar to display
      // force layout recalculation, then restore
      if (
        contentComputedStyle.overflowY === "auto" &&
        contentComputedStyle.scrollbarGutter !== "stable"
      ) {
        const restoreOverflow = forceStyles(content, {
          "overflow-y": "hidden",
        });
        // eslint-disable-next-line no-unused-expressions
        content.offsetHeight;
        restoreOverflow();
      }
    }
  };
};

const isDetailsElement = (element) => {
  return element && element.tagName === "DETAILS";
};
