/**
 *
 *
 */

import { startDragToResizeGesture } from "../interaction/drag_to_resize_gesture.js";
import { forceStyles } from "../style_and_attributes.js";
import { createHeightTransition } from "../transition/dom_transition.js";
import { createGroupTransitionController } from "../transition/group_transition.js";
import { getHeight } from "./get_height.js";
import { getInnerHeight } from "./get_inner_height.js";
import { getMarginSizes } from "./get_margin_sizes.js";
import { getMinHeight } from "./get_min_height.js";
import { resolveCSSSize } from "./resolve_css_size.js";

const HEIGHT_TRANSITION_DURATION = 300;
const ANIMATE_TOGGLE = true;
const ANIMATE_RESIZE_AFTER_MUTATION = true;
const ANIMATION_THRESHOLD_PX = 10; // Don't animate changes smaller than this
const DEBUG = false;

// Helper to create scroll state capture/restore function for an element
const captureScrollState = (element) => {
  const scrollLeft = element.scrollLeft;
  const scrollTop = element.scrollTop;
  const scrollWidth = element.scrollWidth;
  const scrollHeight = element.scrollHeight;
  const clientWidth = element.clientWidth;
  const clientHeight = element.clientHeight;

  // Calculate scroll percentages to preserve relative position
  const scrollLeftPercent =
    scrollWidth > clientWidth ? scrollLeft / (scrollWidth - clientWidth) : 0;
  const scrollTopPercent =
    scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;

  // Return preserve function that maintains scroll position relative to content
  return () => {
    // Get current dimensions after DOM changes
    const newScrollWidth = element.scrollWidth;
    const newScrollHeight = element.scrollHeight;
    const newClientWidth = element.clientWidth;
    const newClientHeight = element.clientHeight;

    // If content dimensions changed significantly, use percentage-based positioning
    if (
      Math.abs(newScrollWidth - scrollWidth) > 1 ||
      Math.abs(newScrollHeight - scrollHeight) > 1 ||
      Math.abs(newClientWidth - clientWidth) > 1 ||
      Math.abs(newClientHeight - clientHeight) > 1
    ) {
      if (newScrollWidth > newClientWidth) {
        const newScrollLeft =
          scrollLeftPercent * (newScrollWidth - newClientWidth);
        element.scrollLeft = newScrollLeft;
      }

      if (newScrollHeight > newClientHeight) {
        const newScrollTop =
          scrollTopPercent * (newScrollHeight - newClientHeight);
        element.scrollTop = newScrollTop;
      }
    } else {
      element.scrollLeft = scrollLeft;
      element.scrollTop = scrollTop;
    }
  };
};

export const initFlexDetailsSet = (
  container,
  {
    onSizeChange,
    onResizableDetailsChange,
    onMouseResizeEnd,
    onRequestedSizeChange,
    debug = DEBUG,
  } = {},
) => {
  const flexDetailsSet = {
    cleanup: null,
  };

  // Create animation controller for managing height animations
  const transitionController = createGroupTransitionController();

  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    // Cancel any ongoing animations
    transitionController.cancel();

    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
  flexDetailsSet.cleanup = cleanup;

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
      console.debug(`📐 Container space: ${availableSpace}px`);
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
        const detailsContent = summary.nextElementSibling;
        let detailsHeight;
        if (detailsContent) {
          const preserveScroll = captureScrollState(detailsContent);
          const restoreSizeStyle = forceStyles(detailsContent, {
            height: "auto",
          });
          const detailsContentHeight = getHeight(detailsContent);
          restoreSizeStyle();
          // Preserve scroll position after height manipulation
          preserveScroll();
          detailsHeight = summaryHeight + detailsContentHeight;
        } else {
          // empty details content like
          // <details><summary>...</summary></details>
          // or textual content like
          // <details><summary>...</summary>textual content</details>
          detailsHeight = size;
        }

        if (details.hasAttribute("data-requested-height")) {
          const requestedHeightAttribute = details.getAttribute(
            "data-requested-height",
          );
          requestedSize = resolveCSSSize(requestedHeightAttribute);
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
        const currentSizeFormatted = spaceToSize(size + marginSize, details);
        const requestedSizeFormatted = spaceToSize(
          requestedSize + marginSize,
          details,
        );
        const minSizeFormatted = spaceToSize(minSize + marginSize, details);
        console.debug(
          `  ${details.id}: ${currentSizeFormatted}px → wants ${requestedSizeFormatted}px (min: ${minSizeFormatted}px) [${requestedSizeSource}]`,
        );
      }
    }
  };

  const applyAllocatedSpaces = (resizeDetails) => {
    const changeSet = new Set();
    let maxChange = 0;

    for (const child of container.children) {
      const allocatedSpace = allocatedSpaceMap.get(child);
      const allocatedSize = spaceToSize(allocatedSpace, child);
      const space = spaceMap.get(child);
      const size = spaceToSize(space, child);
      const sizeChange = Math.abs(size - allocatedSize);

      if (size === allocatedSize) {
        continue;
      }

      // Track the maximum change to decide if animation is worth it
      maxChange = Math.max(maxChange, sizeChange);

      if (isDetailsElement(child) && child.open) {
        const syncDetailsContentHeight = prepareSyncDetailsContentHeight(child);
        changeSet.add({
          element: child,
          target: allocatedSize,
          sideEffect: (height, { isAnimationEnd } = {}) => {
            syncDetailsContentHeight(height, {
              isAnimation: true,
              isAnimationEnd,
            });
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

    // Don't animate if changes are too small (avoids imperceptible animations that hide scrollbars)
    const shouldAnimate =
      resizeDetails.animated && maxChange >= ANIMATION_THRESHOLD_PX;

    if (debug && resizeDetails.animated && !shouldAnimate) {
      console.debug(
        `🚫 Skipping animation: max change ${maxChange.toFixed(2)}px < ${ANIMATION_THRESHOLD_PX}px threshold`,
      );
    }

    if (!shouldAnimate) {
      const sizeChangeEntries = [];
      for (const { element, target, sideEffect } of changeSet) {
        element.style.height = `${target}px`;
        spaceMap.set(element, sizeToSpace(target, element));
        if (sideEffect) {
          sideEffect(target);
        }
        sizeChangeEntries.push({ element, value: target });
      }
      onSizeChange?.(sizeChangeEntries, resizeDetails);
      return;
    }

    // Create height animations for each element in changeSet
    const transitions = Array.from(changeSet).map(({ element, target }) => {
      const transition = createHeightTransition(element, target, {
        duration: HEIGHT_TRANSITION_DURATION,
      });
      return transition;
    });

    const transition = transitionController.animate(transitions, {
      onChange: (changeEntries, isLast) => {
        // Apply side effects for each animated element
        for (const { transition, value } of changeEntries) {
          for (const change of changeSet) {
            if (change.element === transition.key) {
              if (change.sideEffect) {
                change.sideEffect(value, { isAnimationEnd: isLast });
              }
              break;
            }
          }
        }

        if (onSizeChange) {
          // Convert animation entries to the expected format
          const sizeChangeEntries = changeEntries.map(
            ({ transition, value }) => ({
              element: transition.key, // targetKey is the element
              value,
            }),
          );
          onSizeChange(
            sizeChangeEntries,
            isLast ? { ...resizeDetails, animated: false } : resizeDetails,
          );
        }
      },
    });
    transition.play();
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
      const allocatedSize = spaceToSize(allocatedSpace, child);
      const sourceInfo =
        allocatedSpaceSource === requestSource
          ? ""
          : ` (${allocatedSpaceSource})`;
      if (allocatedSpace === spaceToAllocate) {
        console.debug(
          `  → ${allocatedSize}px to "${child.id}"${sourceInfo} | ${remainingSpace}px remaining`,
        );
      } else {
        const requestedSize = spaceToSize(spaceToAllocate, child);
        console.debug(
          `  → ${allocatedSize}px -out of ${requestedSize}px wanted- to "${child.id}"${sourceInfo} | ${remainingSpace}px remaining`,
        );
      }
    }
    allocatedSpaceMap.set(child, allocatedSpace);

    const space = spaceMap.get(child);
    return allocatedSpace - space;
  };
  const applyDiffOnAllocatedSpace = (child, diff, source) => {
    if (diff === 0) {
      return 0;
    }
    const allocatedSpace = allocatedSpaceMap.get(child);
    remainingSpace += allocatedSpace;
    const spaceToAllocate = allocatedSpace + diff;
    if (debug) {
      console.debug(
        `🔄 ${child.id}: ${allocatedSpace}px + ${diff}px = ${spaceToAllocate}px (${source})`,
      );
    }
    allocateSpace(child, spaceToAllocate, source);
    const reallocatedSpace = allocatedSpaceMap.get(child);
    return reallocatedSpace - allocatedSpace;
  };
  const distributeAvailableSpace = (source) => {
    if (debug) {
      console.debug(
        `📦 Distributing ${availableSpace}px among ${container.children.length} children:`,
      );
    }
    for (const child of container.children) {
      allocateSpace(child, requestedSpaceMap.get(child), source);
    }
    if (debug) {
      console.debug(`📦 After distribution: ${remainingSpace}px remaining`);
    }
  };
  const distributeRemainingSpace = ({ childToGrow, childToShrinkFrom }) => {
    if (!remainingSpace) {
      return;
    }
    if (remainingSpace < 0) {
      const spaceToSteal = -remainingSpace;
      if (debug) {
        console.debug(
          `⚠️  Deficit: ${remainingSpace}px, stealing ${spaceToSteal}px from elements before ${childToShrinkFrom.id}`,
        );
      }
      updatePreviousSiblingsAllocatedSpace(
        childToShrinkFrom,
        -spaceToSteal,
        `remaining space is negative: ${remainingSpace}px`,
      );
      return;
    }
    if (childToGrow) {
      if (debug) {
        console.debug(
          `✨ Bonus: giving ${remainingSpace}px to ${childToGrow.id}`,
        );
      }
      applyDiffOnAllocatedSpace(
        childToGrow,
        remainingSpace,
        `remaining space is positive: ${remainingSpace}px`,
      );
    }
  };

  const updatePreviousSiblingsAllocatedSpace = (
    child,
    diffToApply,
    source,
    mapRemainingDiffToApply,
  ) => {
    let spaceDiffSum = 0;
    let remainingDiffToApply = diffToApply;
    let previousSibling = child.previousElementSibling;
    while (previousSibling) {
      if (mapRemainingDiffToApply) {
        remainingDiffToApply = mapRemainingDiffToApply(
          previousSibling,
          remainingDiffToApply,
        );
      }
      const spaceDiff = applyDiffOnAllocatedSpace(
        previousSibling,
        remainingDiffToApply,
        source,
      );
      if (spaceDiff) {
        spaceDiffSum += spaceDiff;
        remainingDiffToApply -= spaceDiff;
        if (!remainingDiffToApply) {
          break;
        }
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    return spaceDiffSum;
  };
  const updateNextSiblingsAllocatedSpace = (
    child,
    diffToApply,
    reason,
    mapRemainingDiffToApply,
  ) => {
    let spaceDiffSum = 0;
    let remainingDiffToApply = diffToApply;
    let nextSibling = child.nextElementSibling;
    while (nextSibling) {
      if (mapRemainingDiffToApply) {
        remainingDiffToApply = mapRemainingDiffToApply(
          nextSibling,
          remainingDiffToApply,
        );
      }
      const spaceDiff = applyDiffOnAllocatedSpace(
        nextSibling,
        remainingDiffToApply,
        reason,
      );
      if (spaceDiff) {
        spaceDiffSum += spaceDiff;
        remainingDiffToApply -= spaceDiff;
        if (!remainingDiffToApply) {
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
      const spaceDiff = applyDiffOnAllocatedSpace(nextSibling, diff, reason);
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
      const spaceDiff = applyDiffOnAllocatedSpace(
        previousSibling,
        diff,
        reason,
      );
      if (spaceDiff) {
        return spaceDiff;
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    return 0;
  };

  const saveCurrentSizeAsRequestedSizes = ({
    replaceExistingAttributes,
  } = {}) => {
    for (const child of container.children) {
      if (canGrowSet.has(child) || canShrinkSet.has(child)) {
        if (
          child.hasAttribute("data-requested-height") &&
          !replaceExistingAttributes
        ) {
          continue;
        }
        const allocatedSpace = allocatedSpaceMap.get(child);
        child.setAttribute("data-requested-height", allocatedSpace);
      }
    }
  };

  const updateSpaceDistribution = (resizeDetails) => {
    if (debug) {
      console.group(`updateSpaceDistribution: ${resizeDetails.reason}`);
    }
    prepareSpaceDistribution();
    distributeAvailableSpace(resizeDetails.reason);
    distributeRemainingSpace({
      childToGrow: openedDetailsArray[openedDetailsArray.length - 1],
      childToShrinkFrom: lastChild,
    });
    if (
      resizeDetails.reason === "initial_space_distribution" ||
      resizeDetails.reason === "content_change"
    ) {
      spaceMap.clear(); // force to set size at start
    }
    applyAllocatedSpaces(resizeDetails);
    saveCurrentSizeAsRequestedSizes();
    if (debug) {
      console.groupEnd();
    }
  };

  const resizableDetailsIdSet = new Set();
  const updateResizableDetails = () => {
    const currentResizableDetailsIdSet = new Set();
    let hasPreviousOpen = false;
    for (const child of container.children) {
      if (!isDetailsElement(child)) {
        continue;
      }
      if (!child.open) {
        continue;
      }
      if (hasPreviousOpen) {
        currentResizableDetailsIdSet.add(child.id);
      }
      if (!hasPreviousOpen && child.open) {
        hasPreviousOpen = true;
      }
    }

    let someNew;
    let someOld;
    for (const currentId of currentResizableDetailsIdSet) {
      if (!resizableDetailsIdSet.has(currentId)) {
        resizableDetailsIdSet.add(currentId);
        someNew = true;
      }
    }
    for (const id of resizableDetailsIdSet) {
      if (!currentResizableDetailsIdSet.has(id)) {
        resizableDetailsIdSet.delete(id);
        someOld = true;
      }
    }
    if (someNew || someOld) {
      onResizableDetailsChange?.(resizableDetailsIdSet);
    }
  };

  initial_size: {
    updateSpaceDistribution({
      reason: "initial_space_distribution",
    });
    updateResizableDetails();
  }

  update_on_toggle: {
    const distributeSpaceAfterToggle = (details) => {
      const reason = details.open
        ? `${details.id} just opened`
        : `${details.id} just closed`;
      if (debug) {
        console.group(`distributeSpaceAfterToggle: ${reason}`);
      }
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
      const spaceStolenFromSibling = -updateSiblingAllocatedSpace(
        details,
        -spaceToSteal,
        reason,
      );
      if (spaceStolenFromSibling) {
        if (debug) {
          console.debug(
            `${spaceStolenFromSibling}px space stolen from sibling`,
          );
        }
        applyDiffOnAllocatedSpace(details, requestedSpace, reason);
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
      if (debug) {
        console.groupEnd();
      }
    };

    for (const child of container.children) {
      if (!isDetailsElement(child)) {
        continue;
      }
      const details = child;
      const ontoggle = () => {
        distributeSpaceAfterToggle(details);
        applyAllocatedSpaces({
          reason: details.open ? "details_opened" : "details_closed",
          animated: ANIMATE_TOGGLE,
        });
        updateResizableDetails();
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
      // let startSpaceMap;
      let startAllocatedSpaceMap;
      let currentAllocatedSpaceMap;

      const start = (element) => {
        updateSpaceDistribution({
          reason: "mouse_resize_start",
        });
        resizedElement = element;
        // startSpaceMap = new Map(spaceMap);
        startAllocatedSpaceMap = new Map(allocatedSpaceMap);
      };

      const applyMoveDiffToSizes = (moveDiff, reason) => {
        let spaceDiff = 0;
        let remainingMoveToApply;
        if (moveDiff > 0) {
          remainingMoveToApply = moveDiff;
          next_siblings_grow: {
            // alors ici on veut grow pour tenter de restaurer la diff
            // entre requestedMap et spaceMap
            // s'il n'y en a pas alors on aura pas appliquer ce move
            const spaceGivenToNextSiblings = updateNextSiblingsAllocatedSpace(
              resizedElement,
              remainingMoveToApply,
              reason,
              (nextSibling) => {
                const requestedSpace = requestedSpaceMap.get(nextSibling);
                const space = spaceMap.get(nextSibling);
                return requestedSpace - space;
              },
            );
            if (spaceGivenToNextSiblings) {
              spaceDiff -= spaceGivenToNextSiblings;
              remainingMoveToApply -= spaceGivenToNextSiblings;
              if (debug) {
                console.debug(
                  `${spaceGivenToNextSiblings}px given to previous siblings`,
                );
              }
            }
          }
          previous_siblings_shrink: {
            const spaceStolenFromPreviousSiblings =
              -updatePreviousSiblingsAllocatedSpace(
                resizedElement,
                -remainingMoveToApply,
                reason,
              );
            if (spaceStolenFromPreviousSiblings) {
              spaceDiff += spaceStolenFromPreviousSiblings;
              remainingMoveToApply -= spaceStolenFromPreviousSiblings;
              if (debug) {
                console.debug(
                  `${spaceStolenFromPreviousSiblings}px stolen from previous siblings`,
                );
              }
            }
          }
          self_grow: {
            applyDiffOnAllocatedSpace(resizedElement, spaceDiff, reason);
          }
        }

        remainingMoveToApply = -moveDiff;
        self_shrink: {
          const selfShrink = -applyDiffOnAllocatedSpace(
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

      const move = (yMove, gesture) => {
        // if (isNaN(moveRequestedSize) || !isFinite(moveRequestedSize)) {
        //   console.warn(
        //     `requestResize called with invalid size: ${moveRequestedSize}`,
        //   );
        //   return;
        // }
        const reason = `applying ${yMove}px move on ${resizedElement.id}`;
        if (debug) {
          console.group(reason);
        }

        const moveDiff = -yMove;
        applyMoveDiffToSizes(moveDiff, reason);
        applyAllocatedSpaces({
          reason: gesture.isMouseUp ? "mouse_resize_end" : "mouse_resize",
        });
        currentAllocatedSpaceMap = new Map(allocatedSpaceMap);
        allocatedSpaceMap = new Map(startAllocatedSpaceMap);
        if (debug) {
          console.groupEnd();
        }
      };

      const end = () => {
        if (currentAllocatedSpaceMap) {
          allocatedSpaceMap = currentAllocatedSpaceMap;
          saveCurrentSizeAsRequestedSizes({ replaceExistingAttributes: true });
          if (onRequestedSizeChange) {
            for (const [child, allocatedSpace] of allocatedSpaceMap) {
              const size = spaceToSize(allocatedSpace, child);
              onRequestedSizeChange(child, size);
            }
          }
          onMouseResizeEnd?.();
        }
      };

      return { start, move, end };
    };

    const onmousedown = (event) => {
      const { start, move, end } = prepareResize();

      startDragToResizeGesture(event, {
        onDragStart: (gesture) => {
          start(gesture.element);
        },
        onDrag: (gesture) => {
          const yMove = gesture.yMove;
          move(yMove, gesture);
        },
        onRelease: () => {
          end();
        },
        constrainedFeedbackLine: false,
      });
    };
    container.addEventListener("mousedown", onmousedown);
    cleanupCallbackSet.add(() => {
      container.removeEventListener("mousedown", onmousedown);
    });
  }

  update_on_container_resize: {
    /**
     * In the following HTML browser will set `<div>` height as if it was "auto"
     *
     * ```html
     * <details style="height: 100px;">
     *   <summary>...</summary>
     *   <div style="height: 100%"></div>
     * </details>
     * ```
     *
     * So we always maintain a precise px height for the details content to ensure
     * it takes 100% of the details height (minus the summay)
     *
     * To achieve this we need to update these px heights when the container size changes
     */
    const resizeObserver = new ResizeObserver(() => {
      updateSpaceDistribution({
        reason: "container_resize",
      });
    });
    resizeObserver.observe(container);
    cleanupCallbackSet.add(() => {
      resizeObserver.disconnect();
    });
  }

  update_on_content_change: {
    // Track when the DOM structure changes inside the container
    // This detects when:
    // - Details elements are added/removed
    // - The content inside details elements changes
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          updateSpaceDistribution({
            reason: "content_change",
            animated: ANIMATE_RESIZE_AFTER_MUTATION,
          });
          return;
        }
        if (mutation.type === "characterData") {
          updateSpaceDistribution({
            reason: "content_change",
            animated: ANIMATE_RESIZE_AFTER_MUTATION,
          });
          return;
        }
      }
    });
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    cleanupCallbackSet.add(() => {
      mutationObserver.disconnect();
    });
  }

  return flexDetailsSet;
};

const prepareSyncDetailsContentHeight = (details) => {
  const getHeightCssValue = (height) => {
    return `${height}px`;
  };

  const summary = details.querySelector("summary");
  const summaryHeight = getHeight(summary);
  details.style.setProperty(
    "--summary-height",
    getHeightCssValue(summaryHeight),
  );

  const content = summary.nextElementSibling;
  if (!content) {
    return (detailsHeight) => {
      details.style.setProperty(
        "--details-height",
        getHeightCssValue(detailsHeight),
      );
      details.style.setProperty(
        "--content-height",
        getHeightCssValue(detailsHeight - summaryHeight),
      );
    };
  }

  // Capture scroll state at the beginning before any DOM manipulation
  const preserveScroll = captureScrollState(content);
  content.style.height = "var(--content-height)";

  const contentComputedStyle = getComputedStyle(content);
  const scrollbarMightTakeHorizontalSpace =
    contentComputedStyle.overflowY === "auto" &&
    contentComputedStyle.scrollbarGutter !== "stable";

  return (detailsHeight, { isAnimation, isAnimationEnd } = {}) => {
    const contentHeight = detailsHeight - summaryHeight;
    details.style.setProperty(
      "--details-height",
      getHeightCssValue(detailsHeight),
    );
    details.style.setProperty(
      "--content-height",
      getHeightCssValue(contentHeight),
    );

    if (!isAnimation || isAnimationEnd) {
      if (scrollbarMightTakeHorizontalSpace) {
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
        const restoreOverflow = forceStyles(content, {
          "overflow-y": "hidden",
        });
        // eslint-disable-next-line no-unused-expressions
        content.offsetHeight;
        restoreOverflow();
      }
    }

    // Preserve scroll position at the end after all DOM manipulations
    // The captureScrollState function is smart enough to handle new dimensions
    preserveScroll();
  };
};

const isDetailsElement = (element) => {
  return element && element.tagName === "DETAILS";
};
