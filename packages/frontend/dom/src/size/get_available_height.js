import { getBorderSizes } from "./get_border_sizes.js";
import { getHeight } from "./get_height.js";
import { getPaddingSizes } from "./get_padding_sizes.js";

export const getAvailableHeight = (
  element,
  parentHeight = getHeight(element.parentElement),
) => {
  const parentElement = element.parentElement;
  const paddingSizes = getPaddingSizes(parentElement);
  const borderSizes = getBorderSizes(parentElement);
  let availableHeight = parentHeight;
  availableHeight -=
    paddingSizes.top +
    paddingSizes.bottom +
    borderSizes.top +
    borderSizes.bottom;
  if (availableHeight < 0) {
    availableHeight = 0;
  }
  return availableHeight;
};
