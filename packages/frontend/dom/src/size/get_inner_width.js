import { getBorderSizes } from "./get_border_sizes.js";
import { getPaddingSizes } from "./get_padding_sizes.js";
import { getWidth } from "./get_width.js";

export const getInnerWidth = (element) => {
  const paddingSizes = getPaddingSizes(element);
  const borderSizes = getBorderSizes(element);
  const width = getWidth(element);
  const horizontalSpaceTakenByPaddings = paddingSizes.left + paddingSizes.right;
  const horizontalSpaceTakenByBorders = borderSizes.left + borderSizes.right;
  const innerWidth =
    width - horizontalSpaceTakenByPaddings - horizontalSpaceTakenByBorders;
  return innerWidth;
};
