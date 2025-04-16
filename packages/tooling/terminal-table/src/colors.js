import { ANSI } from "@jsenv/humanize";

export const COLORS = {
  RED: ANSI.RED,
  BLUE: ANSI.BLUE,
  YELLOW: ANSI.YELLOW,
  GREEN: ANSI.GREEN,
  MAGENTA: ANSI.MAGENTA,
  CYAN: ANSI.CYAN,
  WHITE: ANSI.WHITE,
  BLACK: ANSI.BLACK,
  GREY: ANSI.GREY,
};

export const pickBorderColor = (...borders) => {
  if (borders.length === 0) {
    return borders[0].color;
  }
  if (borders.lenth === 2) {
    const [first, second] = borders;
    const firstColor = first.color;
    const secondColor = second.color;
    return compareTwoColors(firstColor, secondColor) === 1
      ? secondColor
      : firstColor;
  }
  return borders.map((border) => border.color).sort()[0];
};

const compareTwoColors = (a, b) => {
  if (!b && !a) {
    return 0;
  }
  if (!b) {
    return 1;
  }
  if (!a) {
    return 1;
  }
  const aPrio = COLORS_PRIO.indexOf(a);
  const bPrio = COLORS_PRIO.indexOf(b);
  return aPrio - bPrio;
};
const COLORS_PRIO = [
  COLORS.GREY,
  COLORS.WHITE,
  COLORS.BLACK,
  COLORS.BLUE,
  COLORS.CYAN,
  COLORS.MAGENTA,
  COLORS.GREEN,
  COLORS.YELLOW,
  COLORS.RED,
];
