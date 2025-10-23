import { getAvailableWidth } from "./get_available_width.js";
import { resolveCSSSize } from "./resolve_css_size.js";

export const getMinWidth = (element, availableWidth) => {
  const computedStyle = window.getComputedStyle(element);
  const { minWidth, fontSize } = computedStyle;
  return resolveCSSSize(minWidth, {
    availableSize:
      availableWidth === undefined
        ? getAvailableWidth(element)
        : availableWidth,
    fontSize,
  });
};
