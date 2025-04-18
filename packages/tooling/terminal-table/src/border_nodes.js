/**
 * https://www.w3.org/TR/xml-entity-names/025.html?fbclid=IwZXh0bgNhZW0CMTEAAR0jL81PDwl6kfzRMUvjOSIfmuesvCdqr11lQpOS-9bpx7u1Q2LD1G7fJ1E_aem_URrWt-55lP_byLA6tjLleQ
 * https://www.w3schools.com/charsets/ref_utf_box.asp
 *
 *
 */

import { pickBorderColor } from "./colors.js";

// blank node is a fluid node that will take whatever size it will be requested to take
// this is useful to enforce a given amount of space is taken in x/y
// It is used to implement borders because any cell can suddenly
// enable a border on X/Y meaning all previous cells must now have blank spaces where the border is
const blankNode = {
  type: "blank",
  rects: [
    { width: "fill", render: ({ columnWidth }) => " ".repeat(columnWidth) },
  ],
};
export const createBlankNode = () => {
  return blankNode;
};

const getHorizontalLineChar = (style, bold) => {
  const char = {
    solid: ["─", "━"],
    dash: ["╌", "╍"],
    dash_3: ["┄", "┅"],
    dash_4: ["┈", "┉"],
    double: ["═", "═"],
  }[style][bold ? 1 : 0];
  return char;
};
const getVerticalLineChar = (style, bold) => {
  const char = {
    solid: ["│", "┃"],
    dash: ["╎", "╏"],
    dash_3: ["┆", "┇"],
    dash_4: ["┊", "┋"],
    double: ["║", "║"],
  }[style][bold ? 1 : 0];
  return char;
};

// sides
export const createBorderLeftNode = ({ style = "solid", bold, color }) => {
  const char = getVerticalLineChar(style, bold);
  return {
    type: "border_left",
    rects: [{ width: 1, color, render: char }],
    xAlign: "end",
    yAlign: "center",
    yPadChar: char,
  };
};
export const createBorderRightNode = ({ style = "solid", bold, color }) => {
  const char = getVerticalLineChar(style, bold);
  return {
    type: "border_right",
    rects: [{ width: 1, color, render: char }],
    xAlign: "start",
    yAlign: "center",
    yPadChar: char,
  };
};
export const createBorderTopNode = ({ style = "solid", bold, color }) => {
  const char = getHorizontalLineChar(style, bold);
  return {
    type: "border_top",
    rects: [
      {
        width: "fill",
        color,
        render: ({ columnWidth }) => char.repeat(columnWidth),
      },
    ],
    yAlign: "end",
  };
};
export const createBorderBottomNode = ({ style = "solid", bold, color }) => {
  const char = getHorizontalLineChar(style, bold);
  return {
    type: "border_bottom",
    rects: [
      {
        width: "fill",
        color,
        render: ({ columnWidth }) => char.repeat(columnWidth),
      },
    ],
    yAlign: "start",
  };
};
// half sides
export const createBorderHalfLeftNode = ({ style = "solid", bold, color }) => {
  return {
    type: "border_half_left",
    rects: [
      {
        width: 1,
        color,
        render: bold ? "╸" : "╴",
      },
    ],
    xAlign: "end",
    xPadChar: getHorizontalLineChar(style, bold),
    yAlign: "end",
  };
};
export const createBorderHalfRightNode = ({ style = "solid", bold, color }) => {
  return {
    type: "border_half_right",
    rects: [
      {
        width: 1,
        color,
        render: bold ? "╺" : "╶",
      },
    ],
    xAlign: "end",
    xPadChar: getHorizontalLineChar(style, bold),
    yAlign: "end",
  };
};
export const createBorderHalfUpNode = ({ style = "solid", bold, color }) => {
  return {
    type: "border_half_up",
    rects: [
      {
        width: 1,
        color,
        render: bold ? "╹" : "╵",
      },
    ],
    xAlign: "start",
    yAlign: "start",
    yPadChar: getVerticalLineChar(style, bold),
  };
};
export const createBorderHalfDownNode = ({ style = "solid", bold, color }) => {
  return {
    type: "border_half_down",
    rects: [
      {
        width: 1,
        color,
        render: bold ? "╻" : "╷",
      },
    ],
    xAlign: "end",
    yAlign: "start",
    yPadChar: getVerticalLineChar(style, bold),
  };
};

const topLeftCharProps = {
  "╔": { xPadChar: "║", yPadChar: "═" },
  "╒": { xPadChar: "═", yPadChar: "│" },
  "╓": { xPadChar: "─", yPadChar: "║" },
  "┌": { xPadChar: "│", yPadChar: "─" },
  "┏": { xPadChar: "┃", yPadChar: "━" },
  "┍": { xPadChar: "━", yPadChar: "│" },
  "┎": { xPadChar: "┃", yPadChar: "─" },
  "╭": { xPadChar: "│", yPadChar: "─" },
};
export const createBorderTopLeftNode = (topBorder, leftBorder) => {
  const color = pickBorderColor(topBorder, leftBorder);
  const rounded = topBorder.rounded && leftBorder.rounded;
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = topLeftCharProps[char];
    return {
      type: "border_top_left",
      rects: [{ width: 1, color, render: char }],
      xAlign: "start",
      yAlign: "start",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const topIsDouble = topBorder.style === "double";
    const leftIsDouble = leftBorder.style === "double";
    const bothAreDouble = topIsDouble && leftIsDouble;
    if (bothAreDouble) {
      return innerCreateBorder("╔");
    }
    const onlyTopIsDouble = topIsDouble && !leftIsDouble;
    if (onlyTopIsDouble) {
      return innerCreateBorder("╒");
    }
    const onlyLeftIsDouble = leftIsDouble && !topIsDouble;
    if (onlyLeftIsDouble) {
      return innerCreateBorder("╓");
    }
  }

  // bold
  const topIsBold = topBorder.bold;
  const leftIsBold = leftBorder.bold;
  const noneAreBold = !topIsBold && !leftIsBold;
  if (noneAreBold) {
    return innerCreateBorder(rounded ? "╭" : "┌");
  }
  const bothAreBold = topIsBold && leftIsBold;
  if (bothAreBold) {
    return innerCreateBorder("┏");
  }
  const onlyTopIsBold = topIsBold && !leftIsBold;
  if (onlyTopIsBold) {
    return innerCreateBorder("┍");
  }
  // only left is bold
  return innerCreateBorder("┎");
};

const topRightCharProps = {
  "╗": { xPadChar: "║", yPadChar: "═" },
  "╕": { xPadChar: "═", yPadChar: "│" },
  "╖": { xPadChar: "─", yPadChar: "║" },
  "┐": { xPadChar: "│", yPadChar: "─" },
  "┓": { xPadChar: "┃", yPadChar: "━" },
  "┑": { xPadChar: "━", yPadChar: "│" },
  "┒": { xPadChar: "┃", yPadChar: "─" },
  "╮": { xPadChar: "│", yPadChar: "─" },
};
export const createBorderTopRightNode = (topBorder, rightBorder) => {
  const color = pickBorderColor(topBorder, rightBorder);
  const rounded = topBorder.rounded && rightBorder.rounded;
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = topRightCharProps[char];
    return {
      type: "border_top_right",
      rects: [{ width: 1, color, render: char }],
      xAlign: "end",
      yAlign: "start",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const topIsDouble = topBorder.style === "double";
    const rightIsDouble = rightBorder.style === "double";
    const bothAreDouble = topIsDouble && rightIsDouble;
    if (bothAreDouble) {
      return innerCreateBorder("╗");
    }
    const onlyTopIsDouble = topIsDouble && !rightIsDouble;
    if (onlyTopIsDouble) {
      return innerCreateBorder("╕");
    }
    const onlyRightIsDouble = rightIsDouble && !topIsDouble;
    if (onlyRightIsDouble) {
      return innerCreateBorder("╖");
    }
  }

  const topIsBold = topBorder.bold;
  const rightIsBold = rightBorder.bold;
  const noneAreBold = !topIsBold && !rightIsBold;
  if (noneAreBold) {
    return innerCreateBorder(rounded ? "╮" : "┐");
  }
  const bothAreBold = topIsBold && rightIsBold;
  if (bothAreBold) {
    return innerCreateBorder("┓");
  }
  const onlyTopIsBold = topIsBold && !rightIsBold;
  if (onlyTopIsBold) {
    return innerCreateBorder("┑");
  }
  // only right is bold
  return innerCreateBorder("┒");
};
const bottomRightCharProps = {
  "╝": { xPadChar: "║", yPadChar: "═" },
  "╛": { xPadChar: "═", yPadChar: "│" },
  "╜": { xPadChar: "─", yPadChar: "║" },
  "┘": { xPadChar: "│", yPadChar: "─" },
  "┛": { xPadChar: "┃", yPadChar: "━" },
  "┙": { xPadChar: "━", yPadChar: "│" },
  "┚": { xPadChar: "┃", yPadChar: "─" },
  "╯": { xPadChar: "│", yPadChar: "─" },
};
export const createBorderBottomRightNode = (bottomBorder, rightBorder) => {
  const color = pickBorderColor(bottomBorder, rightBorder);
  const rounded = bottomBorder.rounded && rightBorder.rounded;
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = bottomRightCharProps[char];
    return {
      type: "border_bottom_right",
      rects: [{ width: 1, color, render: char }],
      xAlign: "end",
      yAlign: "end",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const bottomIsDouble = bottomBorder.style === "double";
    const rightIsDouble = rightBorder.style === "double";
    const bothAreDouble = bottomIsDouble && rightIsDouble;
    if (bothAreDouble) {
      return innerCreateBorder("╝");
    }
    const onlyBottomIsDouble = bottomIsDouble && !rightIsDouble;
    if (onlyBottomIsDouble) {
      return innerCreateBorder("╛");
    }
    const onlyRightIsDouble = rightIsDouble && !bottomIsDouble;
    if (onlyRightIsDouble) {
      return innerCreateBorder("╜");
    }
  }

  const bottomIsBold = bottomBorder.bold;
  const rightIsBold = rightBorder.bold;
  const noneAreBold = !bottomIsBold && !rightIsBold;
  if (noneAreBold) {
    return innerCreateBorder(rounded ? "╯" : "┘");
  }
  const bothAreBold = bottomIsBold && rightIsBold;
  if (bothAreBold) {
    return innerCreateBorder("┛");
  }
  const onlyBottomIsBold = bottomIsBold && !rightIsBold;
  if (onlyBottomIsBold) {
    return innerCreateBorder("┙");
  }
  // only right is bold
  return innerCreateBorder("┚");
};
const bottomLeftCharProps = {
  "╚": { xPadChar: "║", yPadChar: "═" },
  "╘": { xPadChar: "═", yPadChar: "│" },
  "╙": { xPadChar: "─", yPadChar: "║" },
  "└": { xPadChar: "│", yPadChar: "─" },
  "┗": { xPadChar: "┃", yPadChar: "━" },
  "┕": { xPadChar: "━", yPadChar: "│" },
  "┖": { xPadChar: "┃", yPadChar: "─" },
  "╰": { xPadChar: "│", yPadChar: "─" },
};
export const createBorderBottomLeftNode = (bottomBorder, leftBorder) => {
  const color = pickBorderColor(bottomBorder, leftBorder);
  const rounded = bottomBorder.rounded && leftBorder.rounded;
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = bottomLeftCharProps[char];
    return {
      type: "border_bottom_left",
      rects: [{ width: 1, color, render: char }],
      xAlign: "start",
      yAlign: "end",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const bottomIsDouble = bottomBorder.style === "double";
    const leftIsDouble = leftBorder.style === "double";
    const bothAreDouble = bottomIsDouble && leftIsDouble;
    if (bothAreDouble) {
      return innerCreateBorder("╚");
    }
    const onlyBottomIsDouble = bottomIsDouble && !leftIsDouble;
    if (onlyBottomIsDouble) {
      return innerCreateBorder("╘");
    }
    const onlyLeftIsDouble = leftIsDouble && !bottomIsDouble;
    if (onlyLeftIsDouble) {
      return innerCreateBorder("╙");
    }
  }

  const bottomIsBold = bottomBorder.bold;
  const leftIsBold = leftBorder.bold;
  const noneAreBold = !bottomIsBold && !leftIsBold;
  if (noneAreBold) {
    return innerCreateBorder(rounded ? "╰" : "└");
  }
  const bothAreBold = bottomIsBold && leftIsBold;
  if (bothAreBold) {
    return innerCreateBorder("┗");
  }
  const onlyBottomIsBold = bottomIsBold && !leftIsBold;
  if (onlyBottomIsBold) {
    return innerCreateBorder("┕");
  }
  // only left is bold
  return innerCreateBorder("┖");
};

// intersections between 3 borders
/**
 * notons aussi que pour double le cas ou 3 bord et 4 borde se connecte ne supporte pas
 * qu'un des axes ne soit pas double (left/right style et top/bottom peutvent changer mais par exemple il
 * n'y a pas de cher pour le cas suivant:
 *
 * ═ ─
 *  ║
 *
 * Les seuls connecteur dispo sont:
 *
 * ╦, ╥ et ╤
 *
 * donnant ainsi
 *
 * ═╦─  ou   ═╥─  ou  ═╤─
 *  ║         ║        ║
 *
 * ah mais on peut faire ça: (utiliser le top right corner)
 * et ça rend pas trop mal
 *
 * ═╗─
 *  ║
 */
const borderMidTopCharProps = {
  "╦": { xPadChar: "║", yPadChar: "═" },
  "╤": { xPadChar: "═", yPadChar: "│" },
  "╥": { xPadChar: "─", yPadChar: "║" },
  "╗": { xPadChar: ["═", "─"], yPadChar: "║" },
  "╔": { xPadChar: ["─", "═"], yPadChar: "║" },
  "┌": { xPadChar: ["═", "─"], yPadChar: "│" },
  "┐": { xPadChar: ["─", "═"], yPadChar: "│" },
  "┬": { xPadChar: "─", yPadChar: "│" },
  "┳": { xPadChar: "━", yPadChar: "┃" },
  "┯": { xPadChar: "━", yPadChar: "│" },
  "┱": { xPadChar: ["━", "─"], yPadChar: "┃" },
  "┲": { xPadChar: ["─", "━"], yPadChar: "┃" },
  "┭": { xPadChar: ["━", "─"], yPadChar: "│" },
  "┮": { xPadChar: ["─", "━"], yPadChar: "┃" },
  "┰": { xPadChar: "─", yPadChar: "┃" },
};
export const createBorderMidTopNode = (
  westBorderTop,
  downBorder,
  eastBorderTop,
) => {
  const color = pickBorderColor(westBorderTop, downBorder, eastBorderTop);
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = borderMidTopCharProps[char];
    return {
      type: "border_mid_top",
      rects: [{ width: 1, color, render: char }],
      xAlign: "center",
      yAlign: "start",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const westIsDouble = westBorderTop.style === "double";
    const downIsDouble = downBorder.style === "double";
    const eastIsDouble = eastBorderTop.style === "double";
    const allAreDouble = westIsDouble && downIsDouble && eastIsDouble;
    if (allAreDouble) {
      return innerCreateBorder("╦");
    }
    const onlyXIsDouble = westIsDouble && !downIsDouble && eastIsDouble;
    if (onlyXIsDouble) {
      return innerCreateBorder("╤");
    }
    const onlyYIsDouble = !westIsDouble && downIsDouble && !eastIsDouble;
    if (onlyYIsDouble) {
      return innerCreateBorder("╥");
    }
    const onlyWestAndDownAreDouble =
      westIsDouble && downIsDouble && !eastIsDouble;
    if (onlyWestAndDownAreDouble) {
      return innerCreateBorder("╗");
    }
    const onlyEastAndDownAreDouble =
      !westIsDouble && downIsDouble && eastIsDouble;
    if (onlyEastAndDownAreDouble) {
      return innerCreateBorder("╔");
    }
    const onlyWestIsDouble = westIsDouble && !downIsDouble && !eastIsDouble;
    if (onlyWestIsDouble) {
      return innerCreateBorder("┌");
    }
    const onlyEastIsDouble = !westIsDouble && !downIsDouble && eastIsDouble;
    if (onlyEastIsDouble) {
      return innerCreateBorder("┐");
    }
  }

  const westIsBold = westBorderTop.bold;
  const downIsBold = downBorder.bold;
  const rightIsBold = eastBorderTop.bold;
  const noneAreBold = !westIsBold && !downIsBold && !rightIsBold;
  if (noneAreBold) {
    return innerCreateBorder("┬");
  }
  const allAreBold = westIsBold && downIsBold && rightIsBold;
  if (allAreBold) {
    return innerCreateBorder("┳");
  }
  const westAndEastAreBold = westIsBold && !downIsBold && rightIsBold;
  if (westAndEastAreBold) {
    return innerCreateBorder("┯");
  }
  const westAndDownAreBold = westIsBold && downIsBold && !rightIsBold;
  if (westAndDownAreBold) {
    return innerCreateBorder("┱");
  }
  const eastAndDownAreBold = !westIsBold && downIsBold && rightIsBold;
  if (eastAndDownAreBold) {
    return innerCreateBorder("┲");
  }
  const onlyWestIsBold = westIsBold && !downIsBold && !rightIsBold;
  if (onlyWestIsBold) {
    return innerCreateBorder("┭");
  }
  const onlyEastIsBold = !westIsBold && !downIsBold && rightIsBold;
  if (onlyEastIsBold) {
    return innerCreateBorder("┮");
  }
  // only down is bold
  return innerCreateBorder("┰");
};
const borderMidBottomCharProps = {
  "╩": { xPadChar: "║", yPadChar: "═" },
  "╧": { xPadChar: "═", yPadChar: "│" },
  "╨": { xPadChar: "─", yPadChar: "║" },
  "╝": { xPadChar: ["═", "─"], yPadChar: "║" },
  "╚": { xPadChar: ["─", "═"], yPadChar: "║" },
  "└": { xPadChar: ["═", "─"], yPadChar: "│" },
  "┘": { xPadChar: ["─", "═"], yPadChar: "│" },
  "┴": { xPadChar: "─", yPadChar: "│" },
  "┻": { xPadChar: "━", yPadChar: "┃" },
  "┷": { xPadChar: "━", yPadChar: "│" },
  "┹": { xPadChar: ["━", "─"], yPadChar: "┃" },
  "┺": { xPadChar: ["─", "━"], yPadChar: "┃" },
  "┵": { xPadChar: ["━", "─"], yPadChar: "│" },
  "┶": { xPadChar: ["─", "━"], yPadChar: "┃" },
  "┸": { xPadChar: "─", yPadChar: "┃" },
};
export const createBorderMidBottomNode = (
  westBorderBottom,
  upBorder,
  eastBorderBottom,
) => {
  const color = pickBorderColor(westBorderBottom, eastBorderBottom, upBorder);
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = borderMidBottomCharProps[char];
    return {
      type: "border_mid_bottom",
      rects: [{ width: 1, color, render: char }],
      xAlign: "center",
      yAlign: "end",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const westIsDouble = westBorderBottom.style === "double";
    const upIsDouble = upBorder.style === "double";
    const eastIsDouble = eastBorderBottom.style === "double";
    const allAreDouble = westIsDouble && upIsDouble && eastIsDouble;
    if (allAreDouble) {
      return innerCreateBorder("╩");
    }
    const onlyXIsDouble = westIsDouble && !upIsDouble && eastIsDouble;
    if (onlyXIsDouble) {
      return innerCreateBorder("╧");
    }
    const onlyYIsDouble = !westIsDouble && upIsDouble && !eastIsDouble;
    if (onlyYIsDouble) {
      return innerCreateBorder("╨");
    }
    const onlyWestAndUpAreDouble = westIsDouble && upIsDouble && !eastIsDouble;
    if (onlyWestAndUpAreDouble) {
      return innerCreateBorder("╝");
    }
    const onlyEastAndUpAreDouble = !westIsDouble && upIsDouble && eastIsDouble;
    if (onlyEastAndUpAreDouble) {
      return innerCreateBorder("╚");
    }
    const onlyWestIsDouble = westIsDouble && !upIsDouble && !eastIsDouble;
    if (onlyWestIsDouble) {
      return innerCreateBorder("└");
    }
    const onlyEastIsDouble = !westIsDouble && !upIsDouble && eastIsDouble;
    if (onlyEastIsDouble) {
      return innerCreateBorder("┘");
    }
  }

  const leftIsBold = westBorderBottom.bold;
  const upIsBold = upBorder.bold;
  const rightIsBold = eastBorderBottom.bold;
  const noneAreBold = !leftIsBold && !upIsBold && !rightIsBold;
  if (noneAreBold) {
    return innerCreateBorder("┴");
  }
  const allAreBold = leftIsBold && upIsBold && rightIsBold;
  if (allAreBold) {
    return innerCreateBorder("┻");
  }
  const leftAndRightAreBold = leftIsBold && !upIsBold && rightIsBold;
  if (leftAndRightAreBold) {
    return innerCreateBorder("┷");
  }
  const leftAndUpAreBold = leftIsBold && upIsBold && !rightIsBold;
  if (leftAndUpAreBold) {
    return innerCreateBorder("┹");
  }
  const rightAndUpAreBold = !leftIsBold && upIsBold && rightIsBold;
  if (rightAndUpAreBold) {
    return innerCreateBorder("┺");
  }
  const onlyLeftIsBold = leftIsBold && !upIsBold && !rightIsBold;
  if (onlyLeftIsBold) {
    return innerCreateBorder("┵");
  }
  const onlyRightIsBold = !leftIsBold && !upIsBold && rightIsBold;
  if (onlyRightIsBold) {
    return innerCreateBorder("┶");
  }
  // only up is bold
  return innerCreateBorder("┸");
};
const borderMifLeftCharProps = {
  "╠": { xPadChar: "═", yPadChar: "║" },
  "╟": { xPadChar: "─", yPadChar: "║" },
  "╞": { xPadChar: "═", yPadChar: "│" },
  "╚": { xPadChar: "═", yPadChar: ["║", "│"] },
  "╔": { xPadChar: "═", yPadChar: ["│", "║"] },
  "┌": { xPadChar: "─", yPadChar: ["║", "│"] },
  "└": { xPadChar: "─", yPadChar: ["│", "║"] },
  "├": { xPadChar: "─", yPadChar: "│" },
  "┣": { xPadChar: "━", yPadChar: "┃" },
  "┠": { xPadChar: "─", yPadChar: "┃" },
  "┢": { xPadChar: "━", yPadChar: ["│", "┃"] },
  "┡": { xPadChar: "━", yPadChar: ["┃", "│"] },
  "┞": { xPadChar: "─", yPadChar: ["┃", "│"] },
  "┝": { xPadChar: "━", yPadChar: "│" },
  "┟": { xPadChar: "─", yPadChar: ["│", "┃"] },
};
export const createBorderMidLeftNode = (
  northBorder,
  middleBorder,
  southBorder,
) => {
  const color = pickBorderColor(middleBorder, northBorder, southBorder);
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = borderMifLeftCharProps[char];
    return {
      type: "border_mid_left",
      rects: [{ width: 1, color, render: char }],
      xAlign: "start",
      yAlign: "center",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const upIsDouble = northBorder.style === "double";
    const middleIsDouble = middleBorder.style === "double";
    const downIsDouble = southBorder.style === "double";
    const allAreDouble = upIsDouble && middleIsDouble && downIsDouble;
    if (allAreDouble) {
      return innerCreateBorder("╠");
    }
    const onlyYIsDouble = upIsDouble && !middleIsDouble && downIsDouble;
    if (onlyYIsDouble) {
      return innerCreateBorder("╟");
    }
    const onlyXIsDouble = !upIsDouble && middleIsDouble && !downIsDouble;
    if (onlyXIsDouble) {
      return innerCreateBorder("╞");
    }
    const onlyUpAndLeftAreDouble =
      upIsDouble && middleIsDouble && !downIsDouble;
    if (onlyUpAndLeftAreDouble) {
      return innerCreateBorder("╚");
    }
    const onlyDownAndLeftAreDouble =
      !upIsDouble && middleIsDouble && downIsDouble;
    if (onlyDownAndLeftAreDouble) {
      return innerCreateBorder("╔");
    }
    const onlyUpIsDouble = upIsDouble && !middleIsDouble && !downIsDouble;
    if (onlyUpIsDouble) {
      return innerCreateBorder("┌");
    }
    const onlyDownIsDouble = !upIsDouble && !middleIsDouble && downIsDouble;
    if (onlyDownIsDouble) {
      return innerCreateBorder("└");
    }
  }

  const upIsBold = northBorder.bold;
  const middleIsBold = middleBorder.bold;
  const downIsBold = southBorder.bold;
  const nothingIsBold = !upIsBold && !middleIsBold && !downIsBold;
  if (nothingIsBold) {
    return innerCreateBorder("├");
  }
  const allAreBold = upIsBold && middleIsBold && downIsBold;
  if (allAreBold) {
    return innerCreateBorder("┣");
  }
  const upAndDownAreBold = upIsBold && !middleIsBold && downIsBold;
  if (upAndDownAreBold) {
    return innerCreateBorder("┠");
  }
  const middleAndDownAreBold = !upIsBold && middleIsBold && downIsBold;
  if (middleAndDownAreBold) {
    return innerCreateBorder("┢");
  }
  const middleAndUpAreBold = upIsBold && middleIsBold && !downIsBold;
  if (middleAndUpAreBold) {
    return innerCreateBorder("┡");
  }
  const onlyUpIsBold = upIsBold && !middleIsBold && !downIsBold;
  if (onlyUpIsBold) {
    return innerCreateBorder("┞");
  }
  const onlyMiddleIsBold = !upIsBold && middleIsBold && !downIsBold;
  if (onlyMiddleIsBold) {
    return innerCreateBorder("┝");
  }
  // only down is bold
  return innerCreateBorder("┟");
};
const borderMidRightCharProps = {
  "╣": { xPadChar: "║", yPadChar: "═" },
  "╢": { xPadChar: "─", yPadChar: "║" },
  "╡": { xPadChar: "═", yPadChar: "│" },
  "╝": { xPadChar: "═", yPadChar: ["║", "│"] },
  "╗": { xPadChar: "═", yPadChar: ["│", "║"] },
  "┘": { xPadChar: "─", yPadChar: ["║", "│"] },
  "└": { xPadChar: "─", yPadChar: ["│", "║"] },
  "┤": { xPadChar: "─", yPadChar: "│" },
  "┫": { xPadChar: "━", yPadChar: "┃" },
  "┨": { xPadChar: "─", yPadChar: "┃" },
  "┪": { xPadChar: "━", yPadChar: ["│", "┃"] },
  "┩": { xPadChar: "━", yPadChar: ["│", "┃"] },
  "┦": { xPadChar: "─", yPadChar: ["┃", "│"] },
  "┥": { xPadChar: "━", yPadChar: "│" },
  "┧": { xPadChar: "─", yPadChar: ["│", "┃"] },
};
export const createBorderMidRightNode = (
  northBorder,
  middleBorder,
  southBorder,
) => {
  const color = pickBorderColor(middleBorder, northBorder, southBorder);
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = borderMidRightCharProps[char];
    return {
      type: "border_mid_right",
      rects: [{ width: 1, color, render: char }],
      xAlign: "end",
      yAlign: "center",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const upIsDouble = northBorder.style === "double";
    const middleIsDouble = middleBorder.style === "double";
    const downIsDouble = southBorder.style === "double";
    const allAreDouble = upIsDouble && middleIsDouble && downIsDouble;
    if (allAreDouble) {
      return innerCreateBorder("╣");
    }
    const onlyYIsDouble = upIsDouble && !middleIsDouble && downIsDouble;
    if (onlyYIsDouble) {
      return innerCreateBorder("╢");
    }
    const onlyXIsDouble = !upIsDouble && middleIsDouble && !downIsDouble;
    if (onlyXIsDouble) {
      return innerCreateBorder("╡");
    }
    const onlyUpAndRightAreDouble =
      upIsDouble && middleIsDouble && !downIsDouble;
    if (onlyUpAndRightAreDouble) {
      return innerCreateBorder("╝");
    }
    const onlyDownAndRightAreDouble =
      !upIsDouble && middleIsDouble && downIsDouble;
    if (onlyDownAndRightAreDouble) {
      return innerCreateBorder("╗");
    }
    const onlyUpIsDouble = upIsDouble && !middleIsDouble && !downIsDouble;
    if (onlyUpIsDouble) {
      return innerCreateBorder("┘");
    }
    const onlyDownIsDouble = !upIsDouble && !middleIsDouble && downIsDouble;
    if (onlyDownIsDouble) {
      return innerCreateBorder("└");
    }
  }

  const upIsBold = northBorder.bold;
  const middleIsBold = middleBorder.bold;
  const downIsBold = southBorder.bold;
  const noneAreBold = !upIsBold && !middleIsBold && !downIsBold;
  if (noneAreBold) {
    return innerCreateBorder("┤");
  }
  const allAreBold = upIsBold && middleIsBold && downIsBold;
  if (allAreBold) {
    return innerCreateBorder("┫");
  }
  const upAndDownAreBold = upIsBold && !middleIsBold && downIsBold;
  if (upAndDownAreBold) {
    return innerCreateBorder("┨");
  }
  const middleAndDownAreBold = !upIsBold && middleIsBold && downIsBold;
  if (middleAndDownAreBold) {
    return innerCreateBorder("┪");
  }
  const middleAndUpAreBold = upIsBold && middleIsBold && !downIsBold;
  if (middleAndUpAreBold) {
    return innerCreateBorder("┩");
  }
  const onlyUpIsBold = upIsBold && !middleIsBold && !downIsBold;
  if (onlyUpIsBold) {
    return innerCreateBorder("┦");
  }
  const onlyMiddleIsBold = !upIsBold && middleIsBold && !downIsBold;
  if (onlyMiddleIsBold) {
    return innerCreateBorder("┥");
  }
  // only down is bold
  return innerCreateBorder("┧");
};

// intersection between 4 borders
const borderMidCharProps = {
  "╬": { xPadChar: "═", yPadChar: "║" },
  "╫": { xPadChar: "─", yPadChar: "║" },
  "╪": { xPadChar: "═", yPadChar: "│" },
  "╝": { xPadChar: ["═", "─"], yPadChar: ["║", "│"] },
  "╗": { xPadChar: ["═", "─"], yPadChar: ["│", "║"] },
  "╔": { xPadChar: ["─", "═"], yPadChar: ["│", "║"] },
  "╚": { xPadChar: ["─", "═"], yPadChar: ["║", "│"] },
  "╣": { xPadChar: ["═", "─"], yPadChar: "║" },
  "╠": { xPadChar: ["─", "═"], yPadChar: "║" },
  "╦": { xPadChar: "═", yPadChar: ["│", "║"] },
  "╩": { xPadChar: "═", yPadChar: ["║", "│"] },
  "├": { xPadChar: ["═", "─"], yPadChar: "│" },
  "┤": { xPadChar: ["─", "═"], yPadChar: "│" },
  "┬": { xPadChar: "─", yPadChar: ["║", "│"] },
  "┴": { xPadChar: "─", yPadChar: ["│", "║"] },
  "┼": { xPadChar: "─", yPadChar: "│" },
  "╋": { xPadChar: "━", yPadChar: "┃" },
  "┿": { xPadChar: "━", yPadChar: "│" },
  "╂": { xPadChar: "─", yPadChar: "┃" },
  "╅": { xPadChar: ["━", "─"], yPadChar: ["│", "┃"] },
  "╃": { xPadChar: ["━", "─"], yPadChar: ["┃", "│"] },
  "╄": { xPadChar: ["─", "━"], yPadChar: ["┃", "│"] },
  "╆": { xPadChar: ["─", "━"], yPadChar: ["│", "┃"] },
  "╉": { xPadChar: ["━", "─"], yPadChar: "┃" },
  "╇": { xPadChar: "━", yPadChar: ["┃", "│"] },
  "╊": { xPadChar: ["─", "━"], yPadChar: "┃" },
  "╈": { xPadChar: "━", yPadChar: ["│", "┃"] },
  "┽": { xPadChar: ["━", "─"], yPadChar: "│" },
  "╀": { xPadChar: "─", yPadChar: ["┃", "│"] },
  "┾": { xPadChar: ["─", "━"], yPadChar: "│" },
  "╁": { xPadChar: "─", yPadChar: ["│", "┃"] },
};
export const createBorderMidNode = (
  leftBorder,
  upBorder,
  rightBorder,
  downBorder,
) => {
  const color = pickBorderColor(upBorder, leftBorder, rightBorder, downBorder);
  const innerCreateBorder = (char) => {
    const { xPadChar, yPadChar } = borderMidCharProps[char];
    return {
      type: "border_mid",
      rects: [{ width: 1, color, render: char }],
      xAlign: "center",
      yAlign: "center",
      xPadChar,
      yPadChar,
    };
  };

  // double borders
  {
    const leftIsDouble = leftBorder.style === "double";
    const upIsDouble = upBorder.style === "double";
    const rightIsDouble = rightBorder.style === "double";
    const downIsDouble = downBorder.style === "double";
    const allAreDouble =
      leftIsDouble && upIsDouble && rightIsDouble && downIsDouble;
    if (allAreDouble) {
      return innerCreateBorder("╬");
    }
    const onlyXIsDouble =
      leftIsDouble && !upIsDouble && rightIsDouble && !downIsDouble;
    if (onlyXIsDouble) {
      return innerCreateBorder("╪");
    }
    const onlyYIsDouble =
      !leftIsDouble && upIsDouble && !rightIsDouble && downIsDouble;
    if (onlyYIsDouble) {
      return innerCreateBorder("╫");
    }
    const onlyLeftAndUpAndDownAreDouble =
      leftIsDouble && upIsDouble && downIsDouble && !rightIsDouble;
    if (onlyLeftAndUpAndDownAreDouble) {
      return innerCreateBorder("╣");
    }
    const onlyLeftUpRightAreDouble =
      leftIsDouble && upIsDouble && !rightIsDouble && downIsDouble;
    if (onlyLeftUpRightAreDouble) {
      return innerCreateBorder("╩");
    }
    const onlyUpAndRightAndDownAreDouble =
      !leftIsDouble && upIsDouble && rightIsDouble && downIsDouble;
    if (onlyUpAndRightAndDownAreDouble) {
      return innerCreateBorder("╠");
    }
    const onlyRightDownLeftAreDouble =
      leftIsDouble && !upIsDouble && rightIsDouble && downIsDouble;
    if (onlyRightDownLeftAreDouble) {
      return innerCreateBorder("╦");
    }
    const onlyLeftAndUpAreDouble =
      leftIsDouble && upIsDouble && !rightIsDouble && !downIsDouble;
    if (onlyLeftAndUpAreDouble) {
      return innerCreateBorder("╝");
    }
    const onlyLeftAndDownAreDouble =
      leftIsDouble && !upIsDouble && !rightIsDouble && downIsDouble;
    if (onlyLeftAndDownAreDouble) {
      return innerCreateBorder("╗");
    }
    const onlyRightAndDownAreDouble =
      !leftIsDouble && upIsDouble && rightIsDouble && downIsDouble;
    if (onlyRightAndDownAreDouble) {
      return innerCreateBorder("╔");
    }
    const onlyRightAndUpAreDouble =
      !leftIsDouble && upIsDouble && !rightIsDouble && downIsDouble;
    if (onlyRightAndUpAreDouble) {
      return innerCreateBorder("╚");
    }
    const onlyLeftIsDouble =
      leftIsDouble && !upIsDouble && !rightIsDouble && !downIsDouble;
    if (onlyLeftIsDouble) {
      return innerCreateBorder("├");
    }
    const onlyRightIsDouble =
      !leftIsDouble && !upIsDouble && rightIsDouble && !downIsDouble;
    if (onlyRightIsDouble) {
      return innerCreateBorder("┤");
    }
    const onlyUpIsDouble =
      !leftIsDouble && upIsDouble && !rightIsDouble && !downIsDouble;
    if (onlyUpIsDouble) {
      return innerCreateBorder("┬");
    }
    const onlyDownIsDouble =
      !leftIsDouble && !upIsDouble && !rightIsDouble && downIsDouble;
    if (onlyDownIsDouble) {
      return innerCreateBorder("┴");
    }
  }

  const leftIsBold = leftBorder.bold;
  const rightIsBold = rightBorder.bold;
  const downIsBold = downBorder.bold;
  const upIsBold = upBorder.bold;
  const noneAreBold = !leftIsBold && !rightIsBold && !downIsBold && !upIsBold;
  if (noneAreBold) {
    return innerCreateBorder("┼");
  }
  const allAreBold = leftIsBold && rightIsBold && downIsBold && upIsBold;
  if (allAreBold) {
    return innerCreateBorder("╋");
  }
  const leftAndRightAreBold =
    leftIsBold && rightIsBold && !downIsBold && !upIsBold;
  if (leftAndRightAreBold) {
    return innerCreateBorder("┿");
  }
  const upAndDownAreBold =
    !leftIsBold && !rightIsBold && downIsBold && upIsBold;
  if (upAndDownAreBold) {
    return innerCreateBorder("╂");
  }
  const leftAndDownAreBold =
    leftIsBold && !rightIsBold && downIsBold && !upIsBold;
  if (leftAndDownAreBold) {
    return innerCreateBorder("╅");
  }
  const leftAndUpAreBold =
    leftIsBold && !rightIsBold && !downIsBold && upIsBold;
  if (leftAndUpAreBold) {
    return innerCreateBorder("╃");
  }
  const rightAndUpAreBold =
    !leftIsBold && rightIsBold && !downIsBold && upIsBold;
  if (rightAndUpAreBold) {
    return innerCreateBorder("╄");
  }
  const rightAndDownAreBold =
    !leftIsBold && rightIsBold && downIsBold && !upIsBold;
  if (rightAndDownAreBold) {
    return innerCreateBorder("╆");
  }
  const leftAndRightAndDownAreBold =
    leftIsBold && rightIsBold && downIsBold && !upIsBold;
  if (leftAndRightAndDownAreBold) {
    return innerCreateBorder("╉");
  }
  const leftAndRightAndUpAreBold =
    leftIsBold && rightIsBold && !downIsBold && upIsBold;
  if (leftAndRightAndUpAreBold) {
    return innerCreateBorder("╇");
  }
  const upAndRightAndDownAreBold =
    !leftIsBold && rightIsBold && downIsBold && upIsBold;
  if (upAndRightAndDownAreBold) {
    return innerCreateBorder("╊");
  }
  const rightAndDownAndLeftAreBold =
    leftIsBold && rightIsBold && !downIsBold && upIsBold;
  if (rightAndDownAndLeftAreBold) {
    return innerCreateBorder("╈");
  }
  const onlyLeftIsBold = leftIsBold && !rightIsBold && !downIsBold && !upIsBold;
  if (onlyLeftIsBold) {
    return innerCreateBorder("┽");
  }
  const onlyUpIsBold = !leftIsBold && !rightIsBold && !downIsBold && upIsBold;
  if (onlyUpIsBold) {
    return innerCreateBorder("╀");
  }
  const onlyRightIsBold =
    !leftIsBold && rightIsBold && !downIsBold && !upIsBold;
  if (onlyRightIsBold) {
    return innerCreateBorder("┾");
  }
  // only down is bold
  return innerCreateBorder("╁");
};
