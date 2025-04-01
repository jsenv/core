import { COLORS } from "./colors.js";

export const createSkippedColumnTopNode = () => {
  return {
    type: "skipped_column_top",
    rects: [
      {
        width: "fill",
        color: COLORS.GREY,
        render: ({ columnWidth }) => "┈".repeat(columnWidth),
      },
    ],
    yAlign: "end",
  };
};
export const createSkippedColumnBottomNode = () => {
  return {
    type: "skipped_column_bottom",
    rects: [
      {
        width: "fill",
        color: COLORS.GREY,
        render: ({ columnWidth }) => "┈".repeat(columnWidth),
      },
    ],
    yAlign: "start",
  };
};
export const createSkippedColumnTopRightNode = () => {
  return {
    type: "skipped_column_top_right",
    rects: [{ width: 1, color: COLORS.GREY, render: "→" }],
    xAlign: "end",
    yAlign: "start",
    xPadChar: "┈",
  };
};
export const createSkippedColumnBottomRightNode = () => {
  return {
    type: "skipped_column_bottom_right",
    rects: [{ width: 1, color: COLORS.GREY, render: "→" }],
    xAlign: "end",
    yAlign: "end",
    xPadChar: "┈",
  };
};

export const createSkippedRowLeftNode = () => {
  return {
    type: "skipped_row_left",
    rects: [{ width: 1, color: COLORS.GREY, render: "┊" }],
    xAlign: "end",
    yAlign: "center",
    yPadChar: "┊",
  };
};
export const createSkippedRowRightNode = () => {
  return {
    type: "skipped_row_right",
    rects: [{ width: 1, color: COLORS.GREY, render: "┊" }],
    xAlign: "end",
    yAlign: "center",
    yPadChar: "┊",
  };
};
export const createSkippedRowBottomLeftNode = () => {
  return {
    type: "skipped_row_bottom_left",
    rects: [{ width: 1, color: COLORS.GREY, render: "↓" }],
    xAlign: "start",
    yAlign: "center",
    yPadChar: "┊",
  };
};
export const createSkippedRowBottomRightNode = () => {
  return {
    type: "skipped_row_bottom_right",
    rects: [{ width: 1, color: COLORS.GREY, render: "↓" }],
    xAlign: "end",
    yAlign: "end",
    yPadChar: "┊",
  };
};
