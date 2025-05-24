/**
 *
 * For an accordion we do this:
 *
 * - children try to take available space (we enforce this at start)
 * - each child can declare a desired height that we will try to respect
 * - when opening an accordion, if there is next opened section we steal space from it
 * otherwise from previous, otherwise we just open it in full height
 * - (at some point this will happen with an animation)
 */

import { getHeight } from "./get_height.js";
import { getInnerHeight } from "./get_inner_height.js";
import { getMinHeight } from "./get_min_height.js";
import { startResizeGesture } from "./start_resize_gesture.js";

export const initDetailsGroup = (
  element,
  { onSizeChange, debug = true } = {},
) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const onmousedown = (event) => {
    startResizeGesture(event, {});
  };
  element.addEventListener("mousedown", onmousedown);
  cleanupCallbackSet.add(() => {
    element.removeEventListener("mousedown", onmousedown);
  });

  const detailsSet = new Set();
  for (const child of element.children) {
    if (child.tagName === "DETAILS") {
      detailsSet.add(child);
      child.style.height = `${getHeight(child)}px`;
    }
  }

  const minSizeMap = new Map();
  const sizeMap = new Map();
  const requestedSizeMap = new Map();
  const newSizeMap = new Map();
  let availableSpace;
  let spaceRemaining;
  const prepareSpaceDistribution = () => {
    sizeMap.clear();
    minSizeMap.clear();
    requestedSizeMap.clear();
    newSizeMap.clear();
    availableSpace = getInnerHeight(element);
    if (debug) {
      console.debug(`availableSpace: ${availableSpace}px`);
    }
    spaceRemaining = availableSpace;
  };

  const applyNewSizes = () => {
    for (const details of detailsSet) {
      const newSize = newSizeMap.get(details);
      const size = sizeMap.get(details);
      if (newSize === size) {
        continue;
      }
      details.style.height = `${newSize}px`;
      const summary = details.querySelector("summary");
      const summaryHeight = getHeight(summary);
      const content = details.querySelector("summary + *");
      content.style.height = `${newSize - summaryHeight}px`;
      if (onSizeChange) {
        onSizeChange(details, newSize);
      }
    }
  };

  // const stealSpaceFromSiblings = (siblingSet, spaceToSteal) => {
  //   let spaceStolen = 0;
  //   let remainingSpaceToSteal = spaceToSteal;
  //   for (const sibling of siblingSet) {
  //     const shrink = requestShrink(sibling, remainingSpaceToSteal);
  //     if (!shrink) {
  //       continue;
  //     }
  //     spaceStolen += shrink;
  //     remainingSpaceToSteal -= shrink;
  //     if (remainingSpaceToSteal <= 0) {
  //       break;
  //     }
  //   }
  //   return spaceStolen;
  // };
  // const giveSpaceToSiblings = (siblingSet, spaceToGive) => {
  //   let spaceGiven = 0;
  //   let remainingSpaceToGive = spaceToGive;
  //   for (const sibling of siblingSet) {
  //     const grow = requestGrow(sibling, remainingSpaceToGive);
  //     if (!grow) {
  //       continue;
  //     }
  //     spaceGiven += grow;
  //     remainingSpaceToGive -= grow;
  //     if (remainingSpaceToGive <= 0) {
  //       break;
  //     }
  //   }
  //   return spaceGiven;
  // };
  const applyRequestedSize = (details, sizeRequested, { isReapply } = {}) => {
    const debugAction = isReapply ? "will" : "want to";

    const size = sizeMap.get(details);
    if (sizeRequested === size) {
      newSizeMap.set(details, size);
      spaceRemaining -= size;
      if (debug) {
        console.debug(
          `details ${details.id} size ${debugAction} stay at ${sizeRequested}px, remaining space: ${spaceRemaining}px`,
        );
      }
      return size;
    }
    const sizeDiff = sizeRequested - size;
    if (sizeDiff < 0) {
      // shrink
      const minSize = minSizeMap.get(details);
      if (sizeRequested <= minSize) {
        const newSize = minSize;
        newSizeMap.set(details, newSize);
        spaceRemaining -= newSize;
        if (debug) {
          console.debug(
            `details ${details.id} size ${debugAction} shrink to ${newSize}px (minSize), remaining space: ${spaceRemaining}px`,
          );
        }
        return newSize;
      }
      newSizeMap.set(details, sizeRequested);
      spaceRemaining -= sizeRequested;
      if (debug) {
        console.debug(
          `details ${details.id} size ${debugAction} shrink to ${sizeRequested}px, remaining space: ${spaceRemaining}px`,
        );
      }
      return sizeRequested;
    }
    // grow
    if (spaceRemaining === size) {
      newSizeMap.set(details, size);
      spaceRemaining -= size;
      if (debug) {
        console.debug(
          `details ${details.id} size ${debugAction} stay at ${sizeRequested}px, remaining space: ${spaceRemaining}px`,
        );
      }
      return size;
    }
    if (sizeRequested > spaceRemaining) {
      return applyRequestedSize(details, spaceRemaining);
    }
    newSizeMap.set(details, sizeRequested);
    spaceRemaining -= sizeRequested;
    if (debug) {
      console.debug(
        `details ${details.id} size ${debugAction} grow to ${sizeRequested}px, remaining space: ${spaceRemaining}px`,
      );
    }
    return sizeRequested;
  };
  const reapplyRequestedSize = (details, sizeRequested) => {
    spaceRemaining += newSizeMap.get(details);
    return applyRequestedSize(details, sizeRequested, { isReapply: true });
  };

  const distributeAvailableSpace = () => {
    for (const details of detailsSet) {
      const height = getHeight(details);
      sizeMap.set(details, height);
      const minHeight = getMinHeight(details, availableSpace);
      minSizeMap.set(details, minHeight);

      let requestedHeight;
      if (details.hasAttribute("data-requested-height")) {
        const requestedHeightAttribute = details.getAttribute(
          "data-requested-height",
        );
        requestedHeight = parseFloat(requestedHeightAttribute, 10);
      } else {
        const summary = details.querySelector("summary");
        const detailsContent = details.querySelector("summary + *");
        const summaryHeight = getHeight(summary);
        const detailsContentHeight = getHeight(detailsContent);
        const detailsHeight = summaryHeight + detailsContentHeight;
        requestedHeight = detailsHeight;
      }

      requestedSizeMap.set(details, requestedHeight);
      if (debug) {
        console.debug(
          `details ${details.id} size: ${height}px, minSize: ${minHeight}px, requested size: ${requestedHeight}px`,
        );
      }
    }

    let lastDetailsOpened;
    for (const details of detailsSet) {
      if (details.open) {
        lastDetailsOpened = details;
        const requestedSize = requestedSizeMap.get(details);
        applyRequestedSize(details, requestedSize);
        continue;
      }
      const minSize = minSizeMap.get(details);
      applyRequestedSize(details, minSize);
    }
    if (spaceRemaining && lastDetailsOpened) {
      reapplyRequestedSize(
        lastDetailsOpened,
        newSizeMap.get(lastDetailsOpened) + spaceRemaining,
      );
    }
  };
  prepareSpaceDistribution();
  distributeAvailableSpace();
  sizeMap.clear(); // force to set new size at start
  applyNewSizes();

  update_on_toggle: {
    for (const details of detailsSet) {
      const ontoggle = () => {
        prepareSpaceDistribution();
        distributeAvailableSpace();
        applyNewSizes();
      };

      details.addEventListener("toggle", ontoggle);
      cleanupCallbackSet.add(() => {
        details.removeEventListener("toggle", ontoggle);
      });
    }
  }

  const detailsGroup = {
    cleanup,
    requestResize: (details, newSize) => {
      prepareSpaceDistribution();
      details.setAttribute("data-requested-height", newSize);
      distributeAvailableSpace({
        startWith: details,
      });
      applyNewSizes();
    },
  };

  return detailsGroup;
};
