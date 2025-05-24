import { getMaxHeight } from "../get_max_height.js";

export const useMaxHeight = (elementRef, availableHeight) => {
  const element = elementRef.current;
  if (!element) {
    return -1;
  }
  const maxWidth = getMaxHeight(element, availableHeight);
  return maxWidth;
};
