import { getAvailableHeight } from "./get_available_height.js";

export const getMinHeight = (element, availableHeight) => {
  const minHeight = window.getComputedStyle(element).minHeight;
  if (minHeight && minHeight.endsWith("%")) {
    if (availableHeight === undefined) {
      availableHeight = getAvailableHeight(element);
    }
    return (parseInt(minHeight) / 100) * availableHeight;
  }
  const minHeightAsNumber = parseInt(minHeight);
  return isNaN(minHeightAsNumber) ? 0 : minHeightAsNumber;
};
