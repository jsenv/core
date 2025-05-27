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
  const requestedSpaceMap = new Map();
  const minSpaceMap = new Map();
  const allocatedSpaceMap = new Map();
  const canGrowSet = new Set();
  const canShrinkSet = new Set();
  let availableSpace;
  let remainingSpace;
  let lastDetailsOpened = null;
  let firstDetailsOpened = null;
  const prepareSpaceDistribution = () => {
    spaceMap.clear();
    marginSizeMap.clear();
    requestedSpaceMap.clear();
    minSpaceMap.clear();
    allocatedSpaceMap.clear();
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

      if (details.open) {
        canGrowSet.add(details);
        canShrinkSet.add(details);

        if (!firstDetailsOpened) {
          firstDetailsOpened = details;
        }
        lastDetailsOpened = details;

        const detailsContent = details.querySelector("summary + *");
        const restoreSizeStyle = setStyles(detailsContent, {
          height: "auto",
        });
        const detailsContentHeight = getHeight(detailsContent);
        restoreSizeStyle();
        const detailsHeight = summaryHeight + detailsContentHeight;
        size = detailsHeight;

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
        size = summaryHeight;
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
    if (animate) {
      const animations = [];
      for (const child of container.children) {
        const allocatedSpace = allocatedSpaceMap.get(child);
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

  let lastChild;
  const distributeAvailableSpace = (source) => {
    lastChild = null;
    for (const child of container.children) {
      lastChild = child;
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
    let spaceAllocatedTotal = 0;
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

  const allocateSpaceToDetails = (details, reason) => {
    const requestedSpace = requestedSpaceMap.get(details);
    const allocatedSpace = allocatedSpaceMap.get(details);
    const spaceToAllocate = requestedSpace - allocatedSpace - remainingSpace;
    if (spaceToAllocate === 0) {
      distributeRemainingSpace({
        childToGrow: lastDetailsOpened,
        childToShrinkFrom: lastChild,
      });
      return;
    }
    if (debug) {
      console.debug(
        `${details.id} would like to take ${requestedSpace}px (${reason}). Trying to allocate ${spaceToAllocate}px to previous siblings, remaining space: ${remainingSpace}px`,
      );
    }

    let sibling;
    let siblingAllocatedSpace;
    allocate_from_sibling: {
      let nextSibling = details.nextElementSibling;
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
        sibling = nextSibling;
        siblingAllocatedSpace = allocatedSpaceDiff;
        break allocate_from_sibling;
      }

      let previousSibling = details.previousElementSibling;
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
        sibling = previousSibling;
        siblingAllocatedSpace = allocatedSpaceDiff;
        break allocate_from_sibling;
      }
    }
    if (sibling) {
      if (debug) {
        if (siblingAllocatedSpace === spaceToAllocate) {
          console.debug(`${siblingAllocatedSpace}px allocated to sibling`);
        } else {
          console.debug(
            `${siblingAllocatedSpace}px allocated (out of ${spaceToAllocate}px) to sibling`,
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
        childToGrow: firstDetailsOpened,
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
          allocateSpaceToDetails(details, "just opened");
        } else if (firstDetailsOpened) {
          allocateSpaceToDetails(firstDetailsOpened, "first opened");
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
    // ici pendant le resize il se passe un truc chelou
    // le details next sibling s'autorise a grandir
    // alors qu'on voudrait pas autoriser cela je crois
    // ca fait bizarre en tous cas
    // lorsqu'on resize b, seul a peut recupérer l'espace
    // et pas c
    // on pourrait faire un truc simple: pendant le resize on lock la taille des suivants
    distributeAvailableSpace(source);
    allocateSpaceToDetails(details, source);
    applyAllocatedSpaces();
  };
  flexDetailsSet.requestResize = requestResize;

  resize_with_mouse: {
    const onmousedown = (event) => {
      let heightAtStart = 0;
      startResizeGesture(event, {
        onStart: (gesture) => {
          heightAtStart = getHeight(gesture.element);
          requestResize(gesture.element, heightAtStart);
          // TODO: lock the size of next siblings
        },
        onMove: (gesture) => {
          const elementToResize = gesture.element;
          const yMove = gesture.yMove;
          requestResize(elementToResize, heightAtStart - yMove);
        },
        onEnd: () => {
          // bah a priori rien de plus
          // (ptet garder le data-requested-height) sur les siblings aussi non?
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
