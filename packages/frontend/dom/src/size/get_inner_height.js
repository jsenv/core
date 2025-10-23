import { getBorderSizes } from "./get_border_sizes.js";
import { getHeight } from "./get_height.js";
import { getPaddingSizes } from "./get_padding_sizes.js";

export const getInnerHeight = (element) => {
  // Always subtract paddings and borders to get the content height
  const paddingSizes = getPaddingSizes(element);
  const borderSizes = getBorderSizes(element);
  const height = getHeight(element);
  const verticalSpaceTakenByPaddings = paddingSizes.top + paddingSizes.bottom;
  const verticalSpaceTakenByBorders = borderSizes.top + borderSizes.bottom;
  const innerHeight =
    height - verticalSpaceTakenByPaddings - verticalSpaceTakenByBorders;
  return innerHeight;
};
