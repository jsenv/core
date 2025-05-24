import { getMaxWidth } from "../get_max_width.js";

export const useMaxWidth = (elementRef, availableWidth) => {
  const element = elementRef.current;
  if (!element) {
    return -1;
  }
  const maxWidth = getMaxWidth(element, availableWidth);
  return maxWidth;
};
