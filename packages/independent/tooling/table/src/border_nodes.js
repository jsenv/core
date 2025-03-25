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

// 2 way intersections
export const createBorderTopLeftNode = (
  topBorder,
  // leftBorder
) => {
  const { color } = topBorder;

  return {
    type: "border_top_left",
    color,
    xAlign: "start",
    yAlign: "start",
    xPadChar: "│",
    yPadChar: "─",
    rects: [{ width: 1, render: "┌" }],
  };
};
export const createBorderTopRightNode = (
  topBorder,
  // rightBorder
) => {
  const { color } = topBorder;
  return {
    type: "border_top_right",
    color,
    xAlign: "end",
    yAlign: "start",
    xPadChar: "│",
    yPadChar: "─",
    rects: [{ width: 1, render: "┐" }],
  };
};
export const createBorderBottomRightNode = (
  bottomBorder,
  // rightBorder
) => {
  const { color } = bottomBorder;

  return {
    type: "border_bottom_right",
    color,
    xAlign: "end",
    yAlign: "end",
    xPadChar: "│",
    yPadChar: "─",
    rects: [{ width: 1, render: "┘" }],
  };
};
export const createBorderBottomLeftNode = (
  bottomBorder,
  // leftBorder
) => {
  const { color } = bottomBorder;

  return {
    type: "border_bottom_left",
    color,
    xAlign: "start",
    yAlign: "end",
    xPadChar: "│",
    yPadChar: "─",
    rects: [{ width: 1, render: "└" }],
  };
};

export const createBorderMidTopNode = (leftBorder, downBorder, rightBorder) => {
  const { color } = leftBorder;
  const leftBold = leftBorder.bold;
  const downBold = downBorder.bold;
  const rightBold = rightBorder.bold;
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

  const nothingIsBold = !leftBold && !downBold && !rightBold;
  if (nothingIsBold) {
    return innerCreateBorder("┬", {
      xPadChar: "─",
      yPadChar: "│",
    });
  }
  const onlyLeftIsBold = leftBold && !downBold && !rightBold;
  if (onlyLeftIsBold) {
    return innerCreateBorder("┭", {
      xPadChar: ["━", "─"],
      yPadChar: "│",
    });
  }
  const onlyRightIsBold = !leftBold && !downBold && rightBold;
  if (onlyRightIsBold) {
    return innerCreateBorder("┮", {
      xPadChar: ["─", "━"],
      yPadChar: "┃",
    });
  }
  const onlyDownIsBold = !leftBold && downBold && !rightBold;
  if (onlyDownIsBold) {
    return innerCreateBorder("┰", {
      xPadChar: "─",
      yPadChar: "┃",
    });
  }
  const leftAndRightAreBold = leftBold && !downBold && rightBold;
  if (leftAndRightAreBold) {
    return innerCreateBorder("┯", {
      xPadChar: "━",
      yPadChar: "│",
    });
  }
  return innerCreateBorder("┳", {
    xPadChar: "━",
    yPadChar: "┃",
  });
};
export const createBorderMidBottomNode = (
  leftBorder,
  // upBorder,
  // rightBorder,
) => {
  const { color } = leftBorder;

  return {
    type: "border_mid_bottom",
    color,
    xAlign: "center",
    yAlign: "end",
    xPadChar: "─",
    yPadChar: "│",
    rects: [{ width: 1, render: "┴" }],
  };
};
export const createBorderMidLeftNode = (
  upBorder,
  // middleBorder,
  // downBorder,
) => {
  const { color } = upBorder;

  return {
    type: "border_mid_left",
    color,
    xAlign: "start",
    yAlign: "center",
    xPadChar: "─",
    yPadChar: "│",
    rects: [{ width: 1, render: "├" }],
  };
};
export const createBorderMidRightNode = (
  upBorder,
  // middleBorder,
  // downBorder,
) => {
  const { color } = upBorder;

  return {
    type: "border_mid_right",
    color,
    xAlign: "end",
    yAlign: "center",
    xPadChar: "─",
    yPadChar: "│",
    rects: [{ width: 1, render: "┤" }],
  };
};

// 4 way intersection
export const createBorderMidNode = (
  leftBorder,
  // rightBorder,
  // downBorder,
  // upBorder
) => {
  const { color } = leftBorder;

  return {
    type: "border_mid",
    color,
    xAlign: "center",
    yAlign: "center",
    xPadChar: "─",
    yPadChar: "│",
    rects: [{ width: 1, render: "┼" }],
  };
};
