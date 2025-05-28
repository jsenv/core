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
  let allocatedSpaceMap = new Map();
  const canGrowSet = new Set();
  const canShrinkSet = new Set();
  let availableSpace;
  let remainingSpace;
  let lastChild;
  const openedDetailsArray = [];
  const spaceToSize = (space, element) => {
    const marginSize = marginSizeMap.get(element);
    return space - marginSize;
  };
  const sizeToSpace = (size, element) => {
    const marginSize = marginSizeMap.get(element);
    return size + marginSize;
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
          if (isNaN(requestedSize) || !isFinite(requestedSize)) {
            console.warn(
              `details ${details.id} has invalid data-requested-height attribute: ${requestedHeightAttribute}`,
            );
          }
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
      const allocatedSize = spaceToSize(allocatedSpace, child);
      const space = spaceMap.get(child);
      const size = spaceToSize(space, child);
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
        spaceMap.set(element, sizeToSpace(target, element));
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

    const space = spaceMap.get(child);
    return allocatedSpace - space;
  };
  const updateAllocatedSpace = (child, diff, source) => {
    if (diff === 0) {
      return 0;
    }
    const allocatedSpace = allocatedSpaceMap.get(child);
    remainingSpace += allocatedSpace;
    const spaceToAllocate = allocatedSpace + diff;
    if (debug) {
      console.debug(
        `re-allocating space for ${child.id} (${source}), new space to allocate: ${spaceToAllocate}px, current allocated space: ${allocatedSpace}px, remaining space: ${remainingSpace}px`,
      );
    }
    allocateSpace(child, spaceToAllocate, source);
    const reallocatedSpace = allocatedSpaceMap.get(child);
    return reallocatedSpace - allocatedSpace;
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
      updatePreviousSiblingsAllocatedSpace(
        childToShrinkFrom,
        -spaceToSleal,
        `remaining space is negative: ${remainingSpace}px`,
      );
      return;
    }
    if (childToGrow) {
      updateAllocatedSpace(
        childToGrow,
        remainingSpace,
        `remaining space is positive: ${remainingSpace}px`,
      );
    }
  };

  const updatePreviousSiblingsAllocatedSpace = (child, diff, source) => {
    let spaceDiffSum = 0;
    let remainingDiffToApply = diff;
    let previousSibling = child.previousElementSibling;
    while (previousSibling) {
      const spaceDiff = updateAllocatedSpace(
        previousSibling,
        remainingDiffToApply,
        source,
      );
      if (spaceDiff) {
        spaceDiffSum += spaceDiff;
        remainingDiffToApply -= spaceDiff;
        if (remainingDiffToApply <= 0) {
          break;
        }
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    return spaceDiffSum;
  };
  const updateNextSiblingsAllocatedSpace = (child, diff, reason) => {
    let spaceDiffSum = 0;
    let remainingDiffToApply = diff;
    let nextSibling = child.nextElementSibling;
    while (nextSibling) {
      const spaceDiff = updateAllocatedSpace(
        nextSibling,
        remainingDiffToApply,
        reason,
      );
      if (spaceDiff) {
        spaceDiffSum += spaceDiff;
        remainingDiffToApply -= spaceDiff;
        if (remainingDiffToApply <= 0) {
          break;
        }
      }
      nextSibling = nextSibling.nextElementSibling;
    }
    return spaceDiffSum;
  };
  const updateSiblingAllocatedSpace = (child, diff, reason) => {
    let nextSibling = child.nextElementSibling;
    while (nextSibling) {
      if (!isDetailsElement(nextSibling)) {
        nextSibling = nextSibling.nextElementSibling;
        continue;
      }
      const spaceDiff = updateAllocatedSpace(nextSibling, diff, reason);
      if (spaceDiff) {
        return spaceDiff;
      }
      nextSibling = nextSibling.nextElementSibling;
    }
    if (debug) {
      console.debug(
        "coult not update next sibling allocated space, try on previous siblings",
      );
    }
    let previousSibling = child.previousElementSibling;
    while (previousSibling) {
      if (!isDetailsElement(previousSibling)) {
        previousSibling = previousSibling.previousElementSibling;
        continue;
      }
      const spaceDiff = updateAllocatedSpace(previousSibling, diff, reason);
      if (spaceDiff) {
        return spaceDiff;
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    return 0;
  };

  const saveCurrentSizeAsRequestedSizes = () => {
    for (const child of container.children) {
      if (canGrowSet.has(child) || canShrinkSet.has(child)) {
        const allocatedSpace = allocatedSpaceMap.get(child);
        child.setAttribute("data-requested-height", allocatedSpace);
      }
    }
  };

  const updateSpaceDistribution = (reason) => {
    prepareSpaceDistribution();
    distributeAvailableSpace(reason);
    distributeRemainingSpace({
      childToGrow: openedDetailsArray[openedDetailsArray.length - 1],
      childToShrinkFrom: lastChild,
    });
    if (reason === "initial space distribution") {
      spaceMap.clear(); // force to set size at start
    }
    applyAllocatedSpaces();
    saveCurrentSizeAsRequestedSizes();
  };

  initial_size: {
    updateSpaceDistribution("initial space distribution");
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
      const spaceToSteal = requestedSpace - allocatedSpace - remainingSpace;
      if (spaceToSteal === 0) {
        distributeRemainingSpace({
          childToGrow: openedDetailsArray[openedDetailsArray.length - 1],
          childToShrinkFrom: lastChild,
        });
        return;
      }
      if (debug) {
        console.debug(
          `${details.id} would like to take ${requestedSpace}px (${reason}). Trying to steal ${spaceToSteal}px from sibling, remaining space: ${remainingSpace}px`,
        );
      }
      const siblingSpaceDiff = updateSiblingAllocatedSpace(
        details,
        -spaceToSteal,
        reason,
      );
      if (siblingSpaceDiff) {
        const spaceStolenFromSibling = -siblingSpaceDiff;
        if (debug) {
          console.debug(
            `${spaceStolenFromSibling}px space stolen from sibling`,
          );
        }
        updateAllocatedSpace(details, requestedSpace, reason);
      } else {
        if (debug) {
          console.debug(
            `no space could be stolen from sibling, remaining space: ${remainingSpace}px`,
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
    const prepareResize = () => {
      let resizedElement;
      let startSpaceMap;
      // let startAllocatedSpaceMap;

      const start = (element) => {
        updateSpaceDistribution("resize start");
        resizedElement = element;
        startSpaceMap = new Map(spaceMap);
        // startAllocatedSpaceMap = new Map(allocatedSpaceMap);
      };

      const applyMoveDiffToSizes = (moveDiff) => {
        let spaceDiff = 0;
        let remainingMoveToApply;
        const reason = `applying ${moveDiff}px move on ${resizedElement.id} to sizes`;

        if (moveDiff > 0) {
          remainingMoveToApply = moveDiff;
          next_siblings_grow: {
            // alors ici on veut grow pour tenter de restaurer la diff
            // entre requestedMap et spaceMap
            // s'il n'y en a pas alors on aura pas appliquer ce move
            const nextSiblingsGrow = updateNextSiblingsAllocatedSpace(
              resizedElement,
              remainingMoveToApply,
              reason,
            );
            if (nextSiblingsGrow) {
              spaceDiff += nextSiblingsGrow;
              remainingMoveToApply -= nextSiblingsGrow;
            }
          }
          previous_siblings_shrink: {
            const previousSiblingsSpaceDiff =
              updatePreviousSiblingsAllocatedSpace(
                resizedElement,
                -remainingMoveToApply,
                reason,
              );
            const spaceStolen = -previousSiblingsSpaceDiff;
            if (!spaceStolen) {
              if (debug) {
                console.debug(
                  `no space could be stolen from previous siblings`,
                );
              }
            } else {
              spaceDiff += spaceStolen;
              remainingMoveToApply -= spaceStolen;
              if (debug) {
                console.debug(`${spaceStolen}px stolen from previous siblings`);
              }
            }
          }
          self_grow: {
            updateAllocatedSpace(resizedElement, spaceDiff, reason);
          }
          return;
        }

        remainingMoveToApply = -moveDiff;
        self_shrink: {
          const selfShrink = -updateAllocatedSpace(
            resizedElement,
            -remainingMoveToApply,
            reason,
          );
          remainingMoveToApply -= selfShrink;
          spaceDiff += selfShrink;
        }
        next_siblings_shrink: {
          const nextSiblingsShrink = -updateNextSiblingsAllocatedSpace(
            resizedElement,
            -remainingMoveToApply,
            reason,
          );
          if (nextSiblingsShrink) {
            remainingMoveToApply -= nextSiblingsShrink;
            spaceDiff += nextSiblingsShrink;
          }
        }
        previous_sibling_grow: {
          updatePreviousSiblingsAllocatedSpace(
            resizedElement,
            spaceDiff,
            reason,
          );
        }
      };

      const move = (yMove) => {
        // if (isNaN(moveRequestedSize) || !isFinite(moveRequestedSize)) {
        //   console.warn(
        //     `requestResize called with invalid size: ${moveRequestedSize}`,
        //   );
        //   return;
        // }
        if (applyMoveDiffToSizes(-yMove)) {
          applyAllocatedSpaces();
          // allocatedSpaceMap = startAllocatedSpaceMap;
        }
      };

      return { start, move };
    };

    const onmousedown = (event) => {
      const { start, move } = prepareResize();

      startResizeGesture(event, {
        onStart: (gesture) => {
          start(gesture.element);
        },
        onMove: (gesture) => {
          const yMove = gesture.yMove;
          move(yMove);
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
