/**
 *
 */

import { setStyles } from "../style_and_attributes.js";
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

  const spaceToSize = (element, space) => {
    const marginSize = marginSizeMap.get(element);
    return space - marginSize;
  };

  const spaceMap = new Map();
  const marginSizeMap = new Map();
  const minSpaceMap = new Map();
  const requestedSpaceMap = new Map();
  const allocatedSpaceMap = new Map();
  const detailsContentHeightMap = new Map();
  const canGrowSet = new Set();
  const canShrinkSet = new Set();
  let availableSpace;
  let remainingSpace;
  let lastDetailsOpened = null;
  let firstDetailsOpened = null;
  const prepareSpaceDistribution = () => {
    marginSizeMap.clear();
    minSpaceMap.clear();
    requestedSpaceMap.clear();
    allocatedSpaceMap.clear();
    detailsContentHeightMap.clear();
    canGrowSet.clear();
    canShrinkSet.clear();
    availableSpace = getInnerHeight(container);
    if (debug) {
      console.debug(`availableSpace: ${availableSpace}px`);
    }
    remainingSpace = availableSpace;
    firstDetailsOpened = null;
    lastDetailsOpened = null;

    for (const child of container.children) {
      const marginSizes = getMarginSizes(child);
      const marginSize = marginSizes.top + marginSizes.bottom;
      marginSizeMap.set(child, marginSize);

      if (!isDetailsElement(child)) {
        const size = getHeight(child);
        const space = size + marginSize;
        minSpaceMap.set(child, space);
        spaceMap.set(child, space);
        requestedSpaceMap.set(child, space);
        continue;
      }
      const details = child;
      canGrowSet.add(details);
      canShrinkSet.add(details);
      let size;
      let sizeSource;
      if (details.open) {
        if (!firstDetailsOpened) {
          firstDetailsOpened = details;
        }
        lastDetailsOpened = details;
        {
          const dataMinHeight = details.getAttribute("data-min-height");
          if (dataMinHeight) {
            const minHeight = parseFloat(dataMinHeight, 10);
            minSpaceMap.set(details, minHeight + marginSize);
          } else {
            const minHeight = getMinHeight(details, availableSpace);
            minSpaceMap.set(details, minHeight + marginSize);
          }
        }

        const detailsContent = details.querySelector("summary + *");
        const restoreSizeStyle = setStyles(detailsContent, {
          height: "auto",
        });
        const detailsContentHeight = getHeight(detailsContent);
        restoreSizeStyle();
        detailsContentHeightMap.set(details);

        if (details.hasAttribute("data-requested-height")) {
          const requestedHeightAttribute = details.getAttribute(
            "data-requested-height",
          );
          size = parseFloat(requestedHeightAttribute, 10);
          sizeSource = "data-requested-height attribute";
        } else {
          const summary = details.querySelector("summary");
          const summaryHeight = getHeight(summary);
          const detailsHeight = summaryHeight + detailsContentHeight;
          size = detailsHeight;
          sizeSource = "summary and content height";
        }
      } else {
        const summary = details.querySelector("summary");
        const summaryHeight = getHeight(summary);
        minSpaceMap.set(details, summaryHeight + marginSize);
        size = summaryHeight;
        sizeSource = "summary height";
      }
      const space = size + marginSize;
      spaceMap.set(details, space);
      requestedSpaceMap.set(details, space);
      if (debug) {
        console.debug(
          `details ${details.id} space: ${spaceMap.get(details)}px, min space: ${minSpaceMap.get(details)}px, requested space: ${space}px (${sizeSource})`,
        );
      }
    }
  };

  const heightAnimationGroupController = createSizeAnimationGroupController({
    duration: HEIGHT_ANIMATION_DURATION,
    onChange: onSizeChange,
  });
  const applyAllocatedSpaces = ({ animate } = {}) => {
    if (animate) {
      const animations = [];
      for (const child of container.children) {
        const allocatedSpace = allocatedSpaceMap.get(child);
        // we must turn allocated space into allocaed size
        const space = spaceMap.get(child);
        if (allocatedSpace === space) {
          continue;
        }
        if (isDetailsElement(child) && child.open) {
          const syncDetailsContentHeight =
            prepareSyncDetailsContentHeight(child);
          animations.push({
            element: child,
            target: spaceToSize(child, allocatedSpace),
            sideEffect: (height, isFinished) => {
              syncDetailsContentHeight(height, { isAnimation: !isFinished });
            },
          });
        } else {
          animations.push({
            element: child,
            target: spaceToSize(child, allocatedSpace),
          });
        }
      }
      heightAnimationGroupController.animateAll(animations);
      return;
    }
    heightAnimationGroupController.cancel();

    const sizeChangeEntries = [];
    for (const child of container.children) {
      const allocatedSpace = allocatedSpaceMap.get(child);
      const space = spaceMap.get(child);
      if (allocatedSpace === space) {
        continue;
      }
      const allocatedSize = spaceToSize(child, allocatedSpace);
      child.style.height = `${allocatedSize}px`;
      if (isDetailsElement(child) && child.open) {
        const syncDetailsContentHeight = prepareSyncDetailsContentHeight(child);
        syncDetailsContentHeight(allocatedSize);
      }
      sizeChangeEntries.push({ element: child, value: allocatedSize });
    }
    if (sizeChangeEntries.length && onSizeChange) {
      onSizeChange(sizeChangeEntries);
    }
  };

  const applyRequestedSpace = (child, requestedSpace, requestSource) => {
    let allocatedSpace;
    let allocatedSpaceSource;
    allocate: {
      const minSpace = minSpaceMap.get(child);
      if (requestedSpace > remainingSpace) {
        if (remainingSpace < minSpace) {
          allocatedSpace = minSpace;
          allocatedSpaceSource = "min space";
          break allocate;
        }
        allocatedSpace = remainingSpace;
        allocatedSpaceSource = "remaining space";
        break allocate;
      }
      if (requestedSpace < minSpace) {
        allocatedSpace = minSpace;
        allocatedSpaceSource = "min space";
        break allocate;
      }
      allocatedSpace = requestedSpace;
      allocatedSpaceSource = requestSource;
      break allocate;
    }

    if (allocatedSpace < requestedSpace) {
      if (!canShrinkSet.has(child)) {
        allocatedSpace = spaceMap.get(child);
        allocatedSpaceSource = `${requestSource} + cannot shrink`;
      }
    } else if (allocatedSpace > requestedSpace) {
      if (!canGrowSet.has(child)) {
        allocatedSpace = spaceMap.get(child);
        allocatedSpaceSource = `${requestSource} + cannot grow`;
      }
    }

    remainingSpace -= allocatedSpace;
    if (debug) {
      if (allocatedSpace === requestedSpace) {
        console.debug(
          `${allocatedSpace}px allocated to ${child.id} (${allocatedSpaceSource}), remaining space: ${remainingSpace}px`,
        );
      } else {
        console.debug(
          `${allocatedSpace}px allocated to ${child.id} (${allocatedSpaceSource}, ${requestedSpace}px requested), remaining space: ${remainingSpace}px`,
        );
      }
    }
    allocatedSpaceMap.set(child, allocatedSpace);
    return allocatedSpace;
  };
  const reapplyRequestedSpace = (child, newRequestedSpace, source) => {
    const allocatedSpace = allocatedSpaceMap.get(child);
    remainingSpace += allocatedSpace;
    if (debug) {
      console.debug(
        `reapplying requested space for ${child.id} (${source}), new requested space: ${newRequestedSpace}px, current allocated space: ${allocatedSpace}px, remaining space: ${remainingSpace}px`,
      );
    }
    return applyRequestedSpace(child, newRequestedSpace, source);
  };

  let lastChild;
  const distributeAvailableSpace = (source) => {
    lastChild = null;
    for (const child of container.children) {
      lastChild = child;
      applyRequestedSpace(child, requestedSpaceMap.get(child), source);
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
      reapplyRequestedSpace(
        childToGrow,
        allocatedSpace + remainingSpace,
        `remaining space is positive: ${remainingSpace}px`,
      );
    }
  };

  const allocateSpaceToPreviousSiblings = (child, spaceToAllocate, source) => {
    let spaceAllocatedTotal = 0;
    let remainingSpaceToAllocate = spaceToAllocate;
    let previousSibling = child.previousElementSibling;
    while (previousSibling) {
      const allocatedSpaceCurrent = allocatedSpaceMap.get(previousSibling);
      const allocatedSpace = reapplyRequestedSpace(
        previousSibling,
        allocatedSpaceCurrent - remainingSpaceToAllocate,
        source,
      );
      const allocatedSpaceDiff = allocatedSpaceCurrent - allocatedSpace;
      if (allocatedSpaceDiff) {
        spaceAllocatedTotal += allocatedSpaceDiff;
        remainingSpaceToAllocate -= allocatedSpaceDiff;
        if (remainingSpaceToAllocate <= 0) {
          break;
        }
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    return spaceAllocatedTotal;
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
          const restoreOverflow = setStyles(content, {
            "overflow-y": "hidden",
          });
          content.style.overflowY = "hidden";
          // eslint-disable-next-line no-unused-expressions
          content.offsetHeight;
          restoreOverflow();
        }
      }
    };
  };

  prepareSpaceDistribution();
  distributeAvailableSpace("initial space distribution");
  distributeRemainingSpace({
    childToGrow: lastDetailsOpened,
    childToShrinkFrom: lastChild,
  });
  spaceMap.clear(); // force to set size at start
  applyAllocatedSpaces();

  const flexDetailsSet = {
    cleanup,
  };

  const giveSpaceToDetails = (details, reason) => {
    const requestedSpace = requestedSpaceMap.get(details);
    const allocatedSpace = allocatedSpaceMap.get(details);
    if (allocatedSpace === requestedSpace) {
      distributeRemainingSpace({
        childToGrow: details.open ? details : null,
        childToShrinkFrom: lastChild,
      });
      return;
    }
    const action =
      allocatedSpace < requestedSpace ? ["steal", "stolen"] : ["give", "given"];
    const spaceToDistribute = requestedSpace - allocatedSpace - remainingSpace;
    if (debug) {
      console.debug(
        `${details.id} would like to take ${requestedSpace}px (${reason}). It would have to ${action[0]} ${spaceToDistribute}px, remaining space: ${remainingSpace}px`,
      );
    }
    const previousSiblingAllocatedSpace = allocateSpaceToPreviousSiblings(
      details,
      spaceToDistribute,
      reason,
    );
    if (previousSiblingAllocatedSpace) {
      if (debug) {
        if (previousSiblingAllocatedSpace === spaceToDistribute) {
          console.debug(
            `${previousSiblingAllocatedSpace}px ${action[1]} from previous siblings in favor of ${details.id}`,
          );
        } else {
          console.debug(
            `${previousSiblingAllocatedSpace}px ${action[1]} (out of ${spaceToDistribute}px) from previous siblings in favor of ${details.id}`,
          );
        }
      }
      reapplyRequestedSpace(details, requestedSpace, reason);
    } else {
      if (debug) {
        console.debug(`no space to ${action[0]} from previous siblings`);
      }
      distributeRemainingSpace({
        childToGrow: lastDetailsOpened,
        childToShrinkFrom: lastChild,
      });
    }
  };

  update_on_toggle: {
    for (const child of container.children) {
      if (!isDetailsElement(child)) {
        continue;
      }
      const details = child;
      // eslint-disable-next-line no-loop-func
      const ontoggle = () => {
        prepareSpaceDistribution();
        distributeAvailableSpace(
          `${details.id} ${details.open ? "opened" : "closed"}`,
        );
        if (details.open) {
          giveSpaceToDetails(details, "just opened");
        } else if (firstDetailsOpened) {
          giveSpaceToDetails(firstDetailsOpened, "first opened");
        }
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

  const requestResize = (details, newSize) => {
    if (isNaN(newSize) || !isFinite(newSize)) {
      console.warn(
        `requestResize called with invalid size: ${newSize} for details ${details.id}`,
      );
      return;
    }
    details.setAttribute("data-requested-height", newSize);
    prepareSpaceDistribution();
    const source = `${details.id} resize requested to ${newSize}px`;
    distributeAvailableSpace(source);
    giveSpaceToDetails(details, source);
    applyAllocatedSpaces();
  };
  flexDetailsSet.requestResize = requestResize;

  resize_with_mouse: {
    const onmousedown = (event) => {
      let heightAtStart = 0;
      startResizeGesture(event, {
        onStart: (gesture) => {
          heightAtStart = getHeight(gesture.element);
        },
        onMove: (gesture) => {
          const elementToResize = gesture.element;
          const yMove = gesture.yMove;
          requestResize(elementToResize, heightAtStart + yMove);
        },
        onEnd: () => {
          // bah a priori rien de plus
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

const isDetailsElement = (element) => {
  return element && element.tagName === "DETAILS";
};
