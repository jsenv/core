import { getMinHeight, getMinWidth } from "./min_size.js";
import { getMarginSizes, measureSize } from "./size.js";

export const getMaxWidth = (
  element,
  availableWidth = measureSize(element.parentElement)[0],
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
      const previousSiblingWidth =
        previousSibling.getBoundingClientRect().width;
      maxWidth -= previousSiblingWidth;
      const previousSiblingMarginSizes = getMarginSizes(previousSibling);
      maxWidth -= previousSiblingMarginSizes.left;
      maxWidth -= previousSiblingMarginSizes.right;

      previousSibling = previousSibling.previousElementSibling;
    }
    let nextSibling = element.nextElementSibling;
    while (nextSibling) {
      const nextSiblingMinWidth = getMinWidth(nextSibling, availableWidth);
      maxWidth -= nextSiblingMinWidth;
      const nextSiblingMarginSizes = getMarginSizes(nextSibling);
      maxWidth -= nextSiblingMarginSizes.left;
      maxWidth -= nextSiblingMarginSizes.right;

      nextSibling = nextSibling.nextElementSibling;
    }
  }
  return maxWidth;
};

export const getMaxHeight = (
  element,
  availableHeight = measureSize(element.parentElement)[1],
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
      const previousSiblingHeight =
        previousSibling.getBoundingClientRect().height;
      maxHeight -= previousSiblingHeight;
      const previousSiblingMarginSizes = getMarginSizes(previousSibling);
      maxHeight -= previousSiblingMarginSizes.top;
      maxHeight -= previousSiblingMarginSizes.bottom;

      previousSibling = previousSibling.previousElementSibling;
    }
    let nextSibling = element.nextElementSibling;
    while (nextSibling) {
      const nextSiblingMinHeight = getMinHeight(nextSibling, availableHeight);
      maxHeight -= nextSiblingMinHeight;
      const nextSiblingMarginSizes = getMarginSizes(nextSibling);
      maxHeight -= nextSiblingMarginSizes.top;
      maxHeight -= nextSiblingMarginSizes.bottom;

      nextSibling = nextSibling.nextElementSibling;
    }
  }
  return maxHeight;
};
