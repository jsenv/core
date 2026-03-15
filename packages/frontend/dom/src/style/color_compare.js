import { parseCSSColor } from "./parsing/css_color.js";

export const isSameColor = (color1, color2) => {
  if (color1 === color2) {
    return true;
  }
  const color1Rgba = parseCSSColor(color1);
  const color2Rgba = parseCSSColor(color2);
  return (
    color1Rgba[0] === color2Rgba[0] &&
    color1Rgba[1] === color2Rgba[1] &&
    color1Rgba[2] === color2Rgba[2] &&
    color1Rgba[3] === color2Rgba[3]
  );
};
