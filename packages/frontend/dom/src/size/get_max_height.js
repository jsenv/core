import { getAvailableHeight } from "./get_available_height.js";
import { getHeight } from "./get_height.js";
import { getMarginSizes } from "./get_margin_sizes.js";
import { getMinHeight } from "./get_min_height.js";

export const getMaxHeight = (
  element,
  availableHeight = getAvailableHeight(element),
) => {
  let maxHeight = availableHeight;
  const marginSizes = getMarginSizes(element);
  maxHeight -= marginSizes.top;
  maxHeight -= marginSizes.bottom;

  const parentElement = element.parentElement;
  const parentElementComputedStyle = window.getComputedStyle(parentElement);
  if (
    parentElementComputedStyle.display === "flex" &&
    parentElementComputedStyle.flexDirection === "column"
  ) {
    let previousSibling = element.previousElementSibling;
    while (previousSibling) {
      if (canTakeSpace(previousSibling)) {
        const previousSiblingHeight = getHeight(previousSibling);
        maxHeight -= previousSiblingHeight;
        const previousSiblingMarginSizes = getMarginSizes(previousSibling);
        maxHeight -= previousSiblingMarginSizes.top;
        maxHeight -= previousSiblingMarginSizes.bottom;
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    let nextSibling = element.nextElementSibling;
    while (nextSibling) {
      if (canTakeSpace(nextSibling)) {
        const nextSiblingMinHeight = getMinHeight(nextSibling, availableHeight);
        maxHeight -= nextSiblingMinHeight;
        const nextSiblingMarginSizes = getMarginSizes(nextSibling);
        maxHeight -= nextSiblingMarginSizes.top;
        maxHeight -= nextSiblingMarginSizes.bottom;
      }
      nextSibling = nextSibling.nextElementSibling;
    }
  }
  return maxHeight;
};

const canTakeSpace = (element) => {
  const computedStyle = window.getComputedStyle(element);

  if (computedStyle.display === "none") {
    return false;
  }
  if (computedStyle.position === "absolute") {
    return false;
  }
  return true;
};
