import { getAvailableWidth } from "./get_available_width.js";
import { getMarginSizes } from "./get_margin_sizes.js";
import { getMinWidth } from "./get_min_width.js";
import { getWidth } from "./get_width.js";

export const getMaxWidth = (
  element,
  availableWidth = getAvailableWidth(element),
) => {
  let maxWidth = availableWidth;

  const marginSizes = getMarginSizes(element);
  maxWidth -= marginSizes.left;
  maxWidth -= marginSizes.right;

  const parentElement = element.parentElement;
  const parentElementComputedStyle = window.getComputedStyle(parentElement);
  if (
    parentElementComputedStyle.display === "flex" &&
    parentElementComputedStyle.flexDirection === "row"
  ) {
    let previousSibling = element.previousElementSibling;
    while (previousSibling) {
      if (canTakeSpace(previousSibling)) {
        const previousSiblingWidth = getWidth(previousSibling);
        maxWidth -= previousSiblingWidth;
        const previousSiblingMarginSizes = getMarginSizes(previousSibling);
        maxWidth -= previousSiblingMarginSizes.left;
        maxWidth -= previousSiblingMarginSizes.right;
      }
      previousSibling = previousSibling.previousElementSibling;
    }
    let nextSibling = element.nextElementSibling;
    while (nextSibling) {
      if (canTakeSpace(nextSibling)) {
        const nextSiblingMinWidth = getMinWidth(nextSibling, availableWidth);
        maxWidth -= nextSiblingMinWidth;
        const nextSiblingMarginSizes = getMarginSizes(nextSibling);
        maxWidth -= nextSiblingMarginSizes.left;
        maxWidth -= nextSiblingMarginSizes.right;
      }
      nextSibling = nextSibling.nextElementSibling;
    }
  }
  return maxWidth;
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
