import { getAvailableWidth } from "./get_available_width.js";

export const getMinWidth = (element, availableWidth) => {
  const minWidth = window.getComputedStyle(element).minWidth;
  if (minWidth && minWidth.endsWith("%")) {
    if (availableWidth === undefined) {
      availableWidth = getAvailableWidth(element);
    }
    return (parseInt(minWidth) / 100) * availableWidth;
  }
  const minWidthAsNumber = parseInt(minWidth);
  return isNaN(minWidthAsNumber) ? 0 : minWidthAsNumber;
};
