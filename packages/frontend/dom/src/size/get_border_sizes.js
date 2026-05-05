import { snapToPixel } from "./snap_to_pixel.js";

export const getBorderSizes = (element) => {
  const {
    borderLeftWidth,
    borderRightWidth,
    borderTopWidth,
    borderBottomWidth,
  } = window.getComputedStyle(element, null);

  return {
    left: snapToPixel(parseFloat(borderLeftWidth)),
    right: snapToPixel(parseFloat(borderRightWidth)),
    top: snapToPixel(parseFloat(borderTopWidth)),
    bottom: snapToPixel(parseFloat(borderBottomWidth)),
  };
};
