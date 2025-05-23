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
import { getMinHeight } from "./get_min_height.js";

export const initDetailsGroup = (element) => {
  const detailsSet = new Set();
  for (const child of element.children) {
    if (child.tagName === "DETAILS") {
      detailsSet.add(child);
    }
  }

  const minSizeMap = new Map();
  const sizeMap = new Map();
  const sizeTransformMap = new Map();
  const requestedSizeMap = new Map();
  let availableSpace;
  let spaceRemaining;

  const requestShrink = (element, shrinkRequested) => {
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
  const applyRequestedSize = (section, sizeRequested) => {
    const size = sizeMap.get(section);
    if (size === sizeRequested) {
      return;
    }
    if (size < sizeRequested) {
      requestGrow(section, sizeRequested - size);
      return;
    }
    if (size > sizeRequested) {
      requestShrink(section, size - sizeRequested);
    }
  };

  // the first thing we do is to distribute available space
  // (we force element to fit the available space)
  // but there is an opened/closed concept
  // closed section are not visible so they should not be given space

  const distributeAvailableSpace = () => {
    sizeTransformMap.clear();
    sizeMap.clear();
    minSizeMap.clear();
    requestedSizeMap.clear();
    availableSpace = getHeight(element);
    spaceRemaining = availableSpace;

    for (const details of detailsSet) {
      const requestedHeight = details.getAttribute("data-requested-height");
      const height = getHeight(details);
      const minHeight = getMinHeight(details, availableSpace);
      minSizeMap.set(details, minHeight);
      sizeMap.set(details, height);
      requestedSizeMap.set(details, requestedHeight);
    }

    let lastDetails;
    for (const details of detailsSet) {
      lastDetails = details;
      const requestedSize = requestedSizeMap.get(details);
      if (requestedSize !== undefined) {
        applyRequestedSize(details, requestedSize);
        continue;
      }
      const minSize = minSizeMap.get(details);
      applyRequestedSize(details, minSize);
      lastDetails = details;
    }
    if (spaceRemaining) {
      requestGrow(lastDetails, spaceRemaining);
    }
    applySizeTransformMap(detailsSet, sizeMap, sizeTransformMap);
  };
  distributeAvailableSpace();
};

const applySizeTransformMap = (elementSet, sizeMap, sizeTransformMap) => {
  for (const element of elementSet) {
    const delta = sizeTransformMap.get(element);
    if (!delta) {
      continue;
    }
    const size = sizeMap.get(element);
    const newSize = size + delta;
    element.style.height = `${newSize}px`;
  }
};
