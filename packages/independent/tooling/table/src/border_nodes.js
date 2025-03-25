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

// sides
export const createBorderLeftNode = ({ bold, color }) => {
  const char = bold ? "┃" : "│";

  return {
    type: "border_left",
    color,
    rects: [{ width: 1, render: char }],
    xAlign: "end",
    yAlign: "center",
    yPadChar: char,
  };
};
export const createBorderRightNode = ({ bold, color }) => {
  const char = bold ? "┃" : "│";

  return {
    type: "border_right",
    color,
    rects: [{ width: 1, render: char }],
    xAlign: "start",
    yAlign: "center",
    yPadChar: char,
  };
};
export const createBorderTopNode = ({ bold, color }) => {
  const char = bold ? "━" : "─";

  return {
    type: "border_top",
    color,
    rects: [
      { width: "fill", render: ({ columnWidth }) => char.repeat(columnWidth) },
    ],
    yAlign: "end",
  };
};
export const createBorderBottomNode = ({ bold, color }) => {
  const char = bold ? "━" : "─";

  return {
    type: "border_bottom",
    color,
    rects: [
      { width: "fill", render: ({ columnWidth }) => char.repeat(columnWidth) },
    ],
    yAlign: "start",
  };
};
// half sides
export const createBorderHalfLeftNode = ({ bold, color }) => {
  return {
    type: "border_half_left",
    color,
    rects: [{ width: 1, render: bold ? "╸" : "╴" }],
    xAlign: "end",
    xPadChar: bold ? "━" : "─",
    yAlign: "end",
  };
};
export const createBorderHalfRightNode = ({ bold, color }) => {
  return {
    type: "border_half_right",
    color,
    rects: [{ width: 1, render: bold ? "╺" : "╶" }],
    xAlign: "end",
    xPadChar: bold ? "━" : "─",
    yAlign: "end",
  };
};
export const createBorderHalfUpNode = ({ bold, color }) => {
  return {
    type: "border_half_up",
    color,
    rects: [{ width: 1, render: bold ? "╹" : "╵" }],
    xAlign: "start",
    yAlign: "start",
    yPadChar: bold ? "┃" : "│",
  };
};
export const createBorderHalfDownNode = ({ bold, color }) => {
  return {
    type: "border_half_down",
    color,
    rects: [{ width: 1, render: bold ? "╻" : "╷" }],
    xAlign: "end",
    yAlign: "start",
    yPadChar: bold ? "┃" : "│",
  };
};

// intersections between 2 borders
export const createBorderTopLeftNode = (topBorder, leftBorder) => {
  const { color } = topBorder;
  const innerCreateBorder = (char, props) => {
    return {
      type: "border_top_left",
      color,
      xAlign: "start",
      yAlign: "start",
      rects: [{ width: 1, render: char }],
      ...props,
    };
  };

  const topIsBold = topBorder.bold;
  const leftIsBold = leftBorder.bold;
  const noneAreBold = !topIsBold && !leftIsBold;
  if (noneAreBold) {
    return innerCreateBorder("┌", {
      xPadChar: "│",
      yPadChar: "─",
    });
  }
  const bothAreBold = topIsBold && leftIsBold;
  if (bothAreBold) {
    return innerCreateBorder("┏", {
      xPadChar: "┃",
      yPadChar: "━",
    });
  }
  const onlyTopIsBold = topIsBold && !leftIsBold;
  if (onlyTopIsBold) {
    return innerCreateBorder("┍", {
      xPadChar: "━",
      yPadChar: "│",
    });
  }
  // only left is bold
  return innerCreateBorder("┎", {
    xPadChar: "┃",
    yPadChar: "─",
  });
};
export const createBorderTopRightNode = (topBorder, rightBorder) => {
  const { color } = topBorder;
  const innerCreateBorder = (char, props) => {
    return {
      type: "border_top_right",
      color,
      xAlign: "end",
      yAlign: "start",
      rects: [{ width: 1, render: char }],
      ...props,
    };
  };

  const topIsBold = topBorder.bold;
  const rightIsBold = rightBorder.bold;
  const noneAreBold = !topIsBold && !rightIsBold;
  if (noneAreBold) {
    return innerCreateBorder("┐", {
      xPadChar: "│",
      yPadChar: "─",
    });
  }
  const bothAreBold = topIsBold && rightIsBold;
  if (bothAreBold) {
    return innerCreateBorder("┓", {
      xPadChar: "┃",
      yPadChar: "━",
    });
  }
  const onlyTopIsBold = topIsBold && !rightIsBold;
  if (onlyTopIsBold) {
    return innerCreateBorder("┑", {
      xPadChar: "━",
      yPadChar: "│",
    });
  }
  // only right is bold
  return innerCreateBorder("┒", {
    xPadChar: "┃",
    yPadChar: "─",
  });
};
export const createBorderBottomRightNode = (bottomBorder, rightBorder) => {
  const { color } = bottomBorder;
  const innerCreateBorder = (char, props) => {
    return {
      type: "border_bottom_right",
      color,
      xAlign: "end",
      yAlign: "end",
      rects: [{ width: 1, render: char }],
      ...props,
    };
  };

  const bottomIsBold = bottomBorder.bold;
  const rightIsBold = rightBorder.bold;
  const noneAreBold = !bottomIsBold && !rightIsBold;
  if (noneAreBold) {
    return innerCreateBorder("┘", {
      xPadChar: "│",
      yPadChar: "─",
    });
  }
  const bothAreBold = bottomIsBold && rightIsBold;
  if (bothAreBold) {
    return innerCreateBorder("┛", {
      xPadChar: "┃",
      yPadChar: "━",
    });
  }
  const onlyBottomIsBold = bottomIsBold && !rightIsBold;
  if (onlyBottomIsBold) {
    return innerCreateBorder("┙", {
      xPadChar: "━",
      yPadChar: "│",
    });
  }
  // only right is bold
  return innerCreateBorder("┚", {
    xPadChar: "┃",
    yPadChar: "─",
  });
};
export const createBorderBottomLeftNode = (bottomBorder, leftBorder) => {
  const { color } = bottomBorder;
  const innerCreateBorder = (char, props) => {
    return {
      type: "border_bottom_left",
      color,
      xAlign: "start",
      yAlign: "end",
      rects: [{ width: 1, render: char }],
      ...props,
    };
  };

  const bottomIsBold = bottomBorder.bold;
  const leftIsBold = leftBorder.bold;
  const noneAreBold = !bottomIsBold && !leftIsBold;
  if (noneAreBold) {
    return innerCreateBorder("└", {
      xPadChar: "│",
      yPadChar: "─",
    });
  }
  const bothAreBold = bottomIsBold && leftIsBold;
  if (bothAreBold) {
    return innerCreateBorder("┗", {
      xPadChar: "┃",
      yPadChar: "━",
    });
  }
  const onlyBottomIsBold = bottomIsBold && !leftIsBold;
  if (onlyBottomIsBold) {
    return innerCreateBorder("┕", {
      xPadChar: "━",
      yPadChar: "│",
    });
  }
  // only left is bold
  return innerCreateBorder("┖", {
    xPadChar: "┃",
    yPadChar: "─",
  });
};

// intersections between 3 borders
export const createBorderMidTopNode = (
  westBorderTop,
  downBorder,
  eastBorderTop,
) => {
  const { color } = westBorderTop;
  const innerCreateBorder = (char, props) => {
    return {
      type: "border_mid_top",
      color,
      xAlign: "center",
      yAlign: "start",
      rects: [{ width: 1, render: char }],
      ...props,
    };
  };

  const westIsBold = westBorderTop.bold;
  const downIsBold = downBorder.bold;
  const rightIsBold = eastBorderTop.bold;
  const noneAreBold = !westIsBold && !downIsBold && !rightIsBold;
  if (noneAreBold) {
    return innerCreateBorder("┬", {
      xPadChar: "─",
      yPadChar: "│",
    });
  }
  const allAreBold = westIsBold && downIsBold && rightIsBold;
  if (allAreBold) {
    return innerCreateBorder("┳", {
      xPadChar: "━",
      yPadChar: "┃",
    });
  }
  const westAndEastAreBold = westIsBold && !downIsBold && rightIsBold;
  if (westAndEastAreBold) {
    return innerCreateBorder("┯", {
      xPadChar: "━",
      yPadChar: "│",
    });
  }
  const westAndDownAreBold = westIsBold && downIsBold && !rightIsBold;
  if (westAndDownAreBold) {
    return innerCreateBorder("┱", {
      xPadChar: ["━", "─"],
      yPadChar: "┃",
    });
  }
  const eastAndDownAreBold = !westIsBold && downIsBold && rightIsBold;
  if (eastAndDownAreBold) {
    return innerCreateBorder("┲", {
      xPadChar: ["─", "━"],
      yPadChar: "┃",
    });
  }
  const onlyWestIsBold = westIsBold && !downIsBold && !rightIsBold;
  if (onlyWestIsBold) {
    return innerCreateBorder("┭", {
      xPadChar: ["━", "─"],
      yPadChar: "│",
    });
  }
  const onlyEastIsBold = !westIsBold && !downIsBold && rightIsBold;
  if (onlyEastIsBold) {
    return innerCreateBorder("┮", {
      xPadChar: ["─", "━"],
      yPadChar: "┃",
    });
  }
  // only down is bold
  return innerCreateBorder("┰", {
    xPadChar: "─",
    yPadChar: "┃",
  });
};
export const createBorderMidBottomNode = (
  westBorderBottom,
  upBorder,
  eastBorderBottom,
) => {
  const { color } = westBorderBottom;
  const innerCreateBorder = (char, props) => {
    return {
      type: "border_mid_bottom",
      color,
      xAlign: "center",
      yAlign: "end",
      rects: [{ width: 1, render: char }],
      ...props,
    };
  };

  const leftIsBold = westBorderBottom.bold;
  const upIsBold = upBorder.bold;
  const rightIsBold = eastBorderBottom.bold;
  const noneAreBold = !leftIsBold && !upIsBold && !rightIsBold;
  if (noneAreBold) {
    return innerCreateBorder("┴", {
      xPadChar: "─",
      yPadChar: "│",
    });
  }
  const allAreBold = leftIsBold && upIsBold && rightIsBold;
  if (allAreBold) {
    return innerCreateBorder("┻", {
      xPadChar: "━",
      yPadChar: "┃",
    });
  }
  const leftAndRightAreBold = leftIsBold && !upIsBold && rightIsBold;
  if (leftAndRightAreBold) {
    return innerCreateBorder("┷", {
      xPadChar: "━",
      yPadChar: "│",
    });
  }
  const leftAndUpAreBold = leftIsBold && upIsBold && !rightIsBold;
  if (leftAndUpAreBold) {
    return innerCreateBorder("┹", {
      xPadChar: ["━", "─"],
      yPadChar: "┃",
    });
  }
  const rightAndUpAreBold = !leftIsBold && upIsBold && rightIsBold;
  if (rightAndUpAreBold) {
    return innerCreateBorder("┺", {
      xPadChar: ["─", "━"],
      yPadChar: "┃",
    });
  }
  const onlyLeftIsBold = leftIsBold && !upIsBold && !rightIsBold;
  if (onlyLeftIsBold) {
    return innerCreateBorder("┵", {
      xPadChar: ["━", "─"],
      yPadChar: "│",
    });
  }
  const onlyRightIsBold = !leftIsBold && !upIsBold && rightIsBold;
  if (onlyRightIsBold) {
    return innerCreateBorder("┶", {
      xPadChar: ["─", "━"],
      yPadChar: "┃",
    });
  }
  // only up is bold
  return innerCreateBorder("┸", {
    xPadChar: "─",
    yPadChar: "┃",
  });
};
export const createBorderMidLeftNode = (
  northBorder,
  middleBorder,
  southBorder,
) => {
  const { color } = southBorder;
  const innerCreateBorder = (char, props) => {
    return {
      type: "border_mid_left",
      color,
      xAlign: "start",
      yAlign: "center",
      rects: [{ width: 1, render: char }],
      ...props,
    };
  };

  const upIsBold = northBorder.bold;
  const middleIsBold = middleBorder.bold;
  const downIsBold = southBorder.bold;
  const nothingIsBold = !upIsBold && !middleIsBold && !downIsBold;
  if (nothingIsBold) {
    return innerCreateBorder("├", {
      xPadChar: "─",
      yPadChar: "│",
    });
  }
  const allAreBold = upIsBold && middleIsBold && downIsBold;
  if (allAreBold) {
    return innerCreateBorder("┣", {
      xPadChar: "━",
      yPadChar: "┃",
    });
  }
  const upAndDownAreBold = upIsBold && !middleIsBold && downIsBold;
  if (upAndDownAreBold) {
    return innerCreateBorder("┠", {
      xPadChar: "─",
      yPadChar: "┃",
    });
  }
  const middleAndDownAreBold = !upIsBold && middleIsBold && downIsBold;
  if (middleAndDownAreBold) {
    return innerCreateBorder("┢", {
      xPadChar: "━",
      yPadChar: ["│", "┃"],
    });
  }
  const middleAndUpAreBold = upIsBold && middleIsBold && !downIsBold;
  if (middleAndUpAreBold) {
    return innerCreateBorder("┡", {
      xPadChar: "━",
      yPadChar: ["┃", "│"],
    });
  }
  const onlyUpIsBold = upIsBold && !middleIsBold && !downIsBold;
  if (onlyUpIsBold) {
    return innerCreateBorder("┞", {
      xPadChar: "─",
      yPadChar: ["┃", "│"],
    });
  }
  const onlyMiddleIsBold = !upIsBold && middleIsBold && !downIsBold;
  if (onlyMiddleIsBold) {
    return innerCreateBorder("┝", {
      xPadChar: "━",
      yPadChar: "│",
    });
  }
  // only down is bold
  return innerCreateBorder("┟", {
    xPadChar: "─",
    yPadChar: ["│", "┃"],
  });
};
export const createBorderMidRightNode = (
  northBorder,
  middleBorder,
  southBorder,
) => {
  const { color } = southBorder;
  const innerCreateBorder = (char, props) => {
    return {
      type: "border_mid_right",
      color,
      xAlign: "end",
      yAlign: "center",
      rects: [{ width: 1, render: char }],
      ...props,
    };
  };

  const upIsBold = northBorder.bold;
  const middleIsBold = middleBorder.bold;
  const downIsBold = southBorder.bold;
  const noneAreBold = !upIsBold && !middleIsBold && !downIsBold;
  if (noneAreBold) {
    return innerCreateBorder("┤", {
      xPadChar: "─",
      yPadChar: "│",
    });
  }
  const allAreBold = upIsBold && middleIsBold && downIsBold;
  if (allAreBold) {
    return innerCreateBorder("┫", {
      xPadChar: "━",
      yPadChar: "┃",
    });
  }
  const upAndDownAreBold = upIsBold && !middleIsBold && downIsBold;
  if (upAndDownAreBold) {
    return innerCreateBorder("┨", {
      xPadChar: "─",
      yPadChar: "┃",
    });
  }
  const middleAndDownAreBold = !upIsBold && middleIsBold && downIsBold;
  if (middleAndDownAreBold) {
    return innerCreateBorder("┪", {
      xPadChar: "━",
      yPadChar: ["│", "┃"],
    });
  }
  const middleAndUpAreBold = upIsBold && middleIsBold && !downIsBold;
  if (middleAndUpAreBold) {
    return innerCreateBorder("┩", {
      xPadChar: "━",
      yPadChar: ["│", "┃"],
    });
  }
  const onlyUpIsBold = upIsBold && !middleIsBold && !downIsBold;
  if (onlyUpIsBold) {
    return innerCreateBorder("┦", {
      xPadChar: "─",
      yPadChar: ["┃", "│"],
    });
  }
  const onlyMiddleIsBold = !upIsBold && middleIsBold && !downIsBold;
  if (onlyMiddleIsBold) {
    return innerCreateBorder("┥", {
      xPadChar: "━",
      yPadChar: "│",
    });
  }
  // only down is bold
  return innerCreateBorder("┧", {
    xPadChar: "─",
    yPadChar: ["│", "┃"],
  });
};

// intersection between 4 borders
export const createBorderMidNode = (
  leftBorder,
  rightBorder,
  downBorder,
  upBorder,
) => {
  const { color } = upBorder;
  const innerCreateBorder = (char, props) => {
    return {
      type: "border_mid",
      color,
      xAlign: "center",
      yAlign: "center",
      rects: [{ width: 1, render: char }],
      ...props,
    };
  };

  const leftIsBold = leftBorder.bold;
  const rightIsBold = rightBorder.bold;
  const downIsBold = downBorder.bold;
  const upIsBold = upBorder.bold;
  const noneAreBold = !leftIsBold && !rightIsBold && !downIsBold && !upIsBold;
  if (noneAreBold) {
    return innerCreateBorder("┼", {
      xPadChar: "─",
      yPadChar: "│",
    });
  }
  const allAreBold = leftIsBold && rightIsBold && downIsBold && upIsBold;
  if (allAreBold) {
    return innerCreateBorder("╋", {
      xPadChar: "━",
      yPadChar: "┃",
    });
  }
  const leftAndRightAreBold =
    leftIsBold && rightIsBold && !downIsBold && !upIsBold;
  if (leftAndRightAreBold) {
    return innerCreateBorder("┿", {
      xPadChar: "━",
      yPadChar: "│",
    });
  }
  const upAndDownAreBold =
    !leftIsBold && !rightIsBold && downIsBold && upIsBold;
  if (upAndDownAreBold) {
    return innerCreateBorder("╂", {
      xPadChar: "─",
      yPadChar: "┃",
    });
  }
  const leftAndDownAreBold =
    leftIsBold && !rightIsBold && downIsBold && !upIsBold;
  if (leftAndDownAreBold) {
    return innerCreateBorder("╅", {
      xPadChar: ["━", "─"],
      yPadChar: ["│", "┃"],
    });
  }
  const leftAndUpAreBold =
    leftIsBold && !rightIsBold && !downIsBold && upIsBold;
  if (leftAndUpAreBold) {
    return innerCreateBorder("╃", {
      xPadChar: ["━", "─"],
      yPadChar: ["┃", "│"],
    });
  }
  const rightAndUpAreBold =
    !leftIsBold && rightIsBold && !downIsBold && upIsBold;
  if (rightAndUpAreBold) {
    return innerCreateBorder("╄", {
      xPadChar: ["─", "━"],
      yPadChar: ["┃", "│"],
    });
  }
  const rightAndDownAreBold =
    !leftIsBold && rightIsBold && downIsBold && !upIsBold;
  if (rightAndDownAreBold) {
    return innerCreateBorder("╆", {
      xPadChar: ["─", "━"],
      yPadChar: ["│", "┃"],
    });
  }
  const leftAndRightAndDownAreBold =
    leftIsBold && rightIsBold && downIsBold && !upIsBold;
  if (leftAndRightAndDownAreBold) {
    return innerCreateBorder("╉", {
      xPadChar: ["━", "─"],
      yPadChar: "┃",
    });
  }
  const leftAndRightAndUpAreBold =
    leftIsBold && rightIsBold && !downIsBold && upIsBold;
  if (leftAndRightAndUpAreBold) {
    return innerCreateBorder("╇", {
      xPadChar: "━",
      yPadChar: ["┃", "│"],
    });
  }
  const upAndRightAndDownAreBold =
    !leftIsBold && rightIsBold && downIsBold && upIsBold;
  if (upAndRightAndDownAreBold) {
    return innerCreateBorder("╊", {
      xPadChar: ["─", "━"],
      yPadChar: "┃",
    });
  }
  // rigthAndDownAndLeftAreBold
  return innerCreateBorder("╈", {
    xPadChar: "━",
    yPadChar: ["│", "┃"],
  });
};
