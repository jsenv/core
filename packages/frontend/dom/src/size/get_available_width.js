import { getBorderSizes } from "./get_border_sizes.js";
import { getPaddingSizes } from "./get_padding_sizes.js";
import { getWidth } from "./get_width.js";

export const getAvailableWidth = (
  element,
  parentWidth = getWidth(element.parentElement),
) => {
  const parentElement = element.parentElement;
  const paddingSizes = getPaddingSizes(parentElement);
  const borderSizes = getBorderSizes(parentElement);
  let availableWidth = parentWidth;
  availableWidth -=
    paddingSizes.left +
    paddingSizes.right +
    borderSizes.left +
    borderSizes.right;
  if (availableWidth < 0) {
    availableWidth = 0;
  }
  return availableWidth;
};
