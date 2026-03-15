import { parseCSSColor } from "./parsing/css_color.js";

export const isSameColor = (color1, color2) => {
  if (color1 === color2) {
    return true;
  }
  const color1String = String(parseCSSColor(color1));
  const color2String = String(parseCSSColor(color2));
  return color1String === color2String;
};
