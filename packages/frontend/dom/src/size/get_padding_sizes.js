import { snapToPixel } from "./snap_to_pixel.js";

export const getPaddingSizes = (element) => {
  const { paddingLeft, paddingRight, paddingTop, paddingBottom } =
    window.getComputedStyle(element, null);

  return {
    left: snapToPixel(parseFloat(paddingLeft)),
    right: snapToPixel(parseFloat(paddingRight)),
    top: snapToPixel(parseFloat(paddingTop)),
    bottom: snapToPixel(parseFloat(paddingBottom)),
  };
};
