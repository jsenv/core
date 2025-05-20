import { getAvailableSize } from "./size.js";

export const getMinWidth = (element, availableWidth) => {
  const minWidth = window.getComputedStyle(element).minWidth;
  if (minWidth && minWidth.endsWith("%")) {
    if (availableWidth === undefined) {
      availableWidth = getAvailableSize(element.parentElement)[0];
    }
    return (parseInt(minWidth) / 100) * availableWidth;
  }
  const minWidthAsNumber = parseInt(minWidth);
  return isNaN(minWidthAsNumber) ? 0 : minWidthAsNumber;
};

export const getMinHeight = (element, availableHeight) => {
  const minHeight = window.getComputedStyle(element).minHeight;
  if (minHeight && minHeight.endsWith("%")) {
    if (availableHeight === undefined) {
      availableHeight = getAvailableSize(element.parentElement)[1];
    }
    return (parseInt(minHeight) / 100) * availableHeight;
  }
  const minHeightAsNumber = parseInt(minHeight);
  return isNaN(minHeightAsNumber) ? 0 : minHeightAsNumber;
};
