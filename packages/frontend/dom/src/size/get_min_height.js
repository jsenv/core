import { getAvailableHeight } from "./get_available_height.js";
import { resolveCSSSize } from "./resolve_css_size.js";

export const getMinHeight = (element, availableHeight) => {
  const computedStyle = window.getComputedStyle(element);
  const { minHeight, fontSize } = computedStyle;
  return resolveCSSSize(minHeight, {
    availableSize:
      availableHeight === undefined
        ? getAvailableHeight(element)
        : availableHeight,
    fontSize,
  });
};
