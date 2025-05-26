/**
 *
 */

import { getHeight } from "./get_height.js";
import { getInnerHeight } from "./get_inner_height.js";
import { getMarginSizes } from "./get_margin_sizes.js";
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
  const allocatedSizeMap = new Map();
  let availableSpace;
  let spaceRemaining;
  const prepareSpaceDistribution = () => {
    sizeMap.clear();
    minSizeMap.clear();
    allocatedSizeMap.clear();
    availableSpace = getInnerHeight(element);
    if (debug) {
      console.debug(`availableSpace: ${availableSpace}px`);
    }
    spaceRemaining = availableSpace;

    lastDetailsOpened = null;
    for (const child of element.children) {
      const element = child;
      const height = getHeight(element);
      const marginSizes = getMarginSizes(element);
      const spaceTakenByVerticalMargins = marginSizes.top + marginSizes.bottom;
      const size = height + spaceTakenByVerticalMargins;
      sizeMap.set(element, size);

      if (!isDetailsElement(child)) {
        minSizeMap.set(element, size);
        requestedSizeMap.set(element, size);
        continue;
      }

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
          const height = detailsContent.style.height;
          detailsContent.style.height = "auto";
          const detailsContentHeight = getHeight(detailsContent);
          detailsContent.style.height = height;
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
    }
  };
  let lastDetailsOpened;

  const applyRequestedSize = (child, sizeRequested, requestSource) => {
    let sizeAllocated;
    let sizeAllocatedSource;
    allocate: {
      const minSize = minSizeMap.get(child);
      if (sizeRequested > spaceRemaining) {
        if (spaceRemaining < minSize) {
          sizeAllocated = minSize;
          sizeAllocatedSource = "min size";
          break allocate;
        }
        sizeAllocated = spaceRemaining;
        sizeAllocatedSource = "remaining space";
        break allocate;
      }
      if (sizeRequested < minSize) {
        sizeAllocated = minSize;
        sizeAllocatedSource = "min size";
        break allocate;
      }
      sizeAllocated = sizeRequested;
      sizeAllocatedSource = requestSource;
      break allocate;
    }

    spaceRemaining -= sizeAllocated;
    if (debug) {
      if (sizeAllocated === sizeRequested) {
        console.debug(
          `${sizeAllocated}px allocated to ${child.id} (${sizeAllocatedSource}), space remaining: ${spaceRemaining}px`,
        );
      } else {
        console.debug(
          `${sizeAllocated}px allocated to ${child.id} (${sizeAllocatedSource}, ${sizeRequested}px requested), space remaining: ${spaceRemaining}px`,
        );
      }
    }
    allocatedSizeMap.set(child, sizeAllocated);
    return sizeRequested;
  };
  let lastChild;
  const distributeAvailableSpace = () => {
    lastChild = null;
    for (const child of element.children) {
      lastChild = child;
      applyRequestedSize(child, requestedSizeMap.get(child), "requested size");
    }
  };
  const distributeRemainingSpace = ({ childToGrow, childToShrinkFrom }) => {
    if (!spaceRemaining) {
      return;
    }
    if (spaceRemaining < 0) {
      const spaceToSleal = -spaceRemaining;
      if (debug) {
        console.debug(
          `space remaining is negative: ${spaceRemaining}px, stealing ${spaceToSleal} from child before ${childToShrinkFrom.id}`,
        );
      }
      stealSpaceFromPreviousSiblings(
        childToShrinkFrom,
        spaceToSleal,
        "negative space remaining",
      );
      return;
    }
    if (childToGrow) {
      const allocatedSize = allocatedSizeMap.get(childToGrow);
      reapplyRequestedSize(
        childToGrow,
        allocatedSize + spaceRemaining,
        "positive space remaining",
      );
    }
  };
  const reapplyRequestedSize = (child, newRequestedSize, source) => {
    const allocatedSize = allocatedSizeMap.get(child);
    spaceRemaining += allocatedSize;
    return applyRequestedSize(child, newRequestedSize, source);
  };
  const applyAllocatedSizes = () => {
    for (const child of element.children) {
      const allocatedSize = allocatedSizeMap.get(child);
      const size = sizeMap.get(child);
      if (allocatedSize === size) {
        continue;
      }
      child.style.height = `${allocatedSize}px`;
      if (isDetailsElement(child)) {
        const details = child;
        if (details.open) {
          const summary = details.querySelector("summary");
          const summaryHeight = getHeight(summary);
          const content = details.querySelector("summary + *");
          content.style.height = `${allocatedSize - summaryHeight}px`;
        }
        if (onSizeChange) {
          onSizeChange(child, allocatedSize);
        }
      }
    }
  };
  const stealSpaceFromPreviousSiblings = (child, spaceToSteal, source) => {
    let spaceStolenTotal = 0;
    let remainingSpaceToSteal = spaceToSteal;
    let previousSibling = child.previousElementSibling;
    while (previousSibling) {
      const allocatedSizeCurrent = allocatedSizeMap.get(previousSibling);
      const allocatedSize = reapplyRequestedSize(
        previousSibling,
        allocatedSizeCurrent - remainingSpaceToSteal,
        source,
      );
      const spaceStolen = allocatedSizeCurrent - allocatedSize;
      if (spaceStolen) {
        spaceStolenTotal += spaceStolen;
        remainingSpaceToSteal -= spaceStolen;
        if (remainingSpaceToSteal <= 0) {
          break;
        }
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    return spaceStolenTotal;
  };
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

  prepareSpaceDistribution();
  distributeAvailableSpace();
  distributeRemainingSpace({
    childToGrow: lastDetailsOpened,
    childToShrinkFrom: lastChild,
  });
  sizeMap.clear(); // force to set new size at start
  applyAllocatedSizes();

  const flexDetailsSet = {
    cleanup,
    // requestResize: (details, newSize) => {
    //   prepareSpaceDistribution();
    //   details.setAttribute("data-requested-height", newSize);
    //   applyNewSizes();
    // },
  };

  update_on_toggle: {
    const giveSpaceToDetailsWhoHasJustOpened = (details) => {
      const sizeRequested = requestedSizeMap.get(details);
      const sizeAllocated = allocatedSizeMap.get(details);
      let spaceMissing = sizeRequested - sizeAllocated;
      if (!spaceMissing) {
        distributeRemainingSpace({
          childToGrow: details,
          childToShrinkFrom: lastChild,
        });
        return;
      }
      let spaceToSteal = spaceMissing;
      if (debug) {
        console.debug(
          `${details.id} justed opened, would like to take ${sizeRequested}px. It would have to steal ${spaceToSteal}px`,
        );
      }
      const spaceStolen = stealSpaceFromPreviousSiblings(
        details,
        spaceToSteal,
        "details just opened",
      );
      if (spaceStolen) {
        if (debug) {
          if (spaceStolen === spaceToSteal) {
            console.debug(
              `${spaceStolen}px stolen from previous siblings in favor of ${details.id}`,
            );
          } else {
            console.debug(
              `${spaceStolen}px stolen (out of ${spaceToSteal}px) from previous siblings in favor of ${details.id}`,
            );
          }
        }
        reapplyRequestedSize(
          details,
          sizeRequested,
          "opened details stealing space",
        );
      } else if (debug) {
        console.debug(`no space to steal from previous siblings`);
      }
    };

    for (const child of element.children) {
      if (!isDetailsElement(child)) {
        continue;
      }
      const details = child;
      // eslint-disable-next-line no-loop-func
      const ontoggle = () => {
        prepareSpaceDistribution();
        distributeAvailableSpace();
        if (details.open) {
          giveSpaceToDetailsWhoHasJustOpened(details);
        } else {
          let nextDetailsOpened;
          let nextSibling = details.nextElementSibling;
          while (nextSibling) {
            if (isDetailsElement(nextSibling) && nextSibling.open) {
              nextDetailsOpened = nextSibling;
              break;
            }
            nextSibling = nextSibling.nextElementSibling;
          }
          distributeRemainingSpace({
            childToGrow: nextDetailsOpened || lastDetailsOpened,
            childToShrinkFrom: lastChild,
          });
        }
        applyAllocatedSizes();
      };

      details.addEventListener("toggle", ontoggle);
      cleanupCallbackSet.add(() => {
        details.removeEventListener("toggle", ontoggle);
      });
    }
  }

  return flexDetailsSet;
};

const isDetailsElement = (element) => {
  return element && element.tagName === "DETAILS";
};
