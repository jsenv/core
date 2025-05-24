/**
 *
 */

import { getHeight } from "./get_height.js";
import { getInnerHeight } from "./get_inner_height.js";
import { getMinHeight } from "./get_min_height.js";
import { startResizeGesture } from "./start_resize_gesture.js";

export const initFlexDetailsSet = (
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

  const minSizeMap = new Map();
  const sizeMap = new Map();
  const requestedSizeMap = new Map();
  const newSizeMap = new Map();
  let availableSpace;
  let spaceRemaining;
  const prepareSpaceDistribution = () => {
    sizeMap.clear();
    minSizeMap.clear();
    newSizeMap.clear();
    availableSpace = getInnerHeight(element);
    if (debug) {
      console.debug(`availableSpace: ${availableSpace}px`);
    }
    spaceRemaining = availableSpace;
  };

  const applyNewSizes = () => {
    for (const child of element.children) {
      const newSize = newSizeMap.get(child);
      const size = sizeMap.get(child);
      if (newSize === size) {
        continue;
      }
      child.style.height = `${newSize}px`;
      if (isDetailsElement(child)) {
        const details = child;
        const summary = details.querySelector("summary");
        const summaryHeight = getHeight(summary);
        const content = details.querySelector("summary + *");
        content.style.height = `${newSize - summaryHeight}px`;
        if (onSizeChange) {
          onSizeChange(child, newSize);
        }
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
  const applyRequestedSize = (child, { isReapply } = {}) => {
    const sizeRequested = requestedSizeMap.get(child);
    const debugAction = isReapply ? "will" : "want to";

    const size = sizeMap.get(child);
    if (sizeRequested === size) {
      newSizeMap.set(child, size);
      spaceRemaining -= size;
      if (debug) {
        console.debug(
          `${child.id} size ${debugAction} stay at ${sizeRequested}px, remaining space: ${spaceRemaining}px`,
        );
      }
      return size;
    }
    const sizeDiff = sizeRequested - size;
    if (sizeDiff < 0) {
      // shrink
      const minSize = minSizeMap.get(child);
      if (sizeRequested <= minSize) {
        const newSize = minSize;
        newSizeMap.set(child, newSize);
        spaceRemaining -= newSize;
        if (debug) {
          console.debug(
            `${child.id} size ${debugAction} shrink to ${newSize}px (minSize), remaining space: ${spaceRemaining}px`,
          );
        }
        return newSize;
      }
      newSizeMap.set(child, sizeRequested);
      spaceRemaining -= sizeRequested;
      if (debug) {
        console.debug(
          `${child.id} size ${debugAction} shrink to ${sizeRequested}px, remaining space: ${spaceRemaining}px`,
        );
      }
      return sizeRequested;
    }
    // grow
    if (spaceRemaining === size) {
      newSizeMap.set(child, size);
      spaceRemaining -= size;
      if (debug) {
        console.debug(
          `${child.id} size ${debugAction} stay at ${sizeRequested}px, remaining space: ${spaceRemaining}px`,
        );
      }
      return size;
    }
    if (sizeRequested > spaceRemaining) {
      requestedSizeMap.set(child, spaceRemaining);
      return applyRequestedSize(child);
    }
    newSizeMap.set(child, sizeRequested);
    spaceRemaining -= sizeRequested;
    if (debug) {
      console.debug(
        `details ${child.id} size ${debugAction} grow to ${sizeRequested}px, remaining space: ${spaceRemaining}px`,
      );
    }
    return sizeRequested;
  };
  const reapplyRequestedSize = (details) => {
    spaceRemaining += newSizeMap.get(details);
    return applyRequestedSize(details, { isReapply: true });
  };

  const distributeAvailableSpace = ({ startWith } = {}) => {
    let lastDetailsOpened;
    for (const child of element.children) {
      const element = child;
      const height = getHeight(element); // we should deduce margins
      sizeMap.set(element, height);

      if (isDetailsElement(child)) {
        const details = child;
        let requestedHeight;
        let requestedHeightSource;
        if (details.open) {
          lastDetailsOpened = details;
          const minHeight = getMinHeight(details, availableSpace);
          minSizeMap.set(details, minHeight);
          if (details.hasAttribute("data-requested-height")) {
            const requestedHeightAttribute = details.getAttribute(
              "data-requested-height",
            );
            requestedHeight = parseFloat(requestedHeightAttribute, 10);
            requestedHeightSource = "data-requested-height attribute";
          } else {
            const summary = details.querySelector("summary");
            const detailsContent = details.querySelector("summary + *");
            const summaryHeight = getHeight(summary);
            detailsContent.style.height = "auto";
            const detailsContentHeight = getHeight(detailsContent);
            const detailsHeight = summaryHeight + detailsContentHeight;
            requestedHeight = detailsHeight;
            requestedHeightSource = "summary and content height";
          }
        } else {
          const summary = details.querySelector("summary");
          const summaryHeight = getHeight(summary);
          minSizeMap.set(details, summaryHeight);
          requestedHeight = summaryHeight;
          requestedHeightSource = "summary height";
        }
        requestedSizeMap.set(details, requestedHeight);
        if (debug) {
          console.debug(
            `details ${details.id} size: ${height}px, minSize: ${minSizeMap.get(details)}px, requested size: ${requestedHeight}px (${requestedHeightSource})`,
          );
        }

        continue;
      }
      requestedSizeMap.set(element, height);
    }

    if (startWith) {
      applyRequestedSize(startWith);
    }

    for (const child of element.children) {
      if (child === startWith) {
        continue;
      }
      applyRequestedSize(child);
    }
    if (spaceRemaining && lastDetailsOpened) {
      requestedSizeMap.set(
        lastDetailsOpened,
        newSizeMap.get(lastDetailsOpened) + spaceRemaining,
      );
      reapplyRequestedSize(lastDetailsOpened);
    }
  };
  prepareSpaceDistribution();
  distributeAvailableSpace();
  sizeMap.clear(); // force to set new size at start
  applyNewSizes();

  update_on_toggle: {
    for (const child of element.children) {
      if (!isDetailsElement(child)) {
        continue;
      }
      const details = child;
      const ontoggle = () => {
        prepareSpaceDistribution();
        distributeAvailableSpace({ startWith: details.open ? details : null });
        applyNewSizes();
      };

      details.addEventListener("toggle", ontoggle);
      cleanupCallbackSet.add(() => {
        details.removeEventListener("toggle", ontoggle);
      });
    }
  }

  const flexDetailsSet = {
    cleanup,
    requestResize: (details, newSize) => {
      prepareSpaceDistribution();
      details.setAttribute("data-requested-height", newSize);

      applyNewSizes();
    },
  };

  return flexDetailsSet;
};

const isDetailsElement = (element) => {
  return element && element.tagName === "DETAILS";
};
