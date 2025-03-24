/**
 *
 * https://www.w3schools.com/charsets/ref_utf_box.asp
 * https://github.com/Automattic/cli-table
 *
 *
 * remaining:
 * border color and color conflicts
 *
 *  (plus tard il pourra aussi y avoir un conflit entre double et bold parce qu'il n'y a pas de double bold)
 * border bold/light (+ connection between bold and light)
 * multiline
 */

import { ANSI, humanizeFileSize } from "@jsenv/humanize";
import stringWidth from "string-width";
import { borderCharsetHeavy, borderCharsetLight } from "./border_charsets.js";

const SLOT_CONTENT_TYPES = {};
{
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
  const borderLeftNode = {
    type: "border_left",
    xAlign: "end",
    yAlignChar: {
      light: borderCharsetLight.left,
      bold: borderCharsetLight.left,
    },
    rects: [
      {
        width: 1,
        render: {
          light: borderCharsetLight.left,
          bold: borderCharsetHeavy.left,
        },
      },
    ],
    color: (cell) => {
      const { borderLeft, borderTop } = cell;
      return (borderLeft || borderTop).color;
    },
  };
  const borderRightNode = {
    type: "border_right",
    xAlign: "start",
    yAlignChar: borderCharsetLight.right,
    rects: [
      {
        width: 1,
        render: {
          light: borderCharsetLight.right,
          bold: borderCharsetHeavy.right,
        },
      },
    ],
  };
  const borderTopNode = {
    type: "border_top",
    yAlign: "end",
    rects: [
      {
        width: "fill",
        render: {
          light: ({ columnWidth }) =>
            borderCharsetLight.top.repeat(columnWidth),
          bold: ({ columnWidth }) => borderCharsetHeavy.top.repeat(columnWidth),
        },
      },
    ],
  };
  const borderBottomNode = {
    type: "border_bottom",
    yAlign: "start",
    rects: [
      {
        width: "fill",
        render: {
          light: ({ columnWidth }) =>
            borderCharsetLight.bottom.repeat(columnWidth),
          bold: ({ columnWidth }) =>
            borderCharsetHeavy.bottom.repeat(columnWidth),
        },
      },
    ],
  };
  const borderHalfRightNode = {
    type: "border_half_right",
    xAlign: "end",
    yAlign: "end",
    rects: [{ width: 1, render: () => borderCharsetLight.half_right }],
  };
  const borderHalfLeftNode = {
    type: "border_half_left",
    xAlign: "start",
    yAlign: "end",
    rects: [{ width: 1, render: () => borderCharsetLight.half_left }],
  };
  const borderHalfUpNode = {
    type: "border_half_up",
    xAlign: "start",
    yAlign: "start",
    rects: [{ width: 1, render: () => borderCharsetLight.half_up }],
  };
  const borderHalfDownNode = {
    type: "border_half_right",
    xAlign: "end",
    yAlign: "start",
    rects: [{ width: 1, render: () => borderCharsetLight.half_down }],
  };
  const borderTopLeftNode = {
    xAlign: "start",
    yAlign: "start",
    xAlignChar: borderCharsetLight.top,
    yAlignChar: borderCharsetLight.left,
    rects: [{ width: 1, render: () => borderCharsetLight.top_left }],
  };
  const borderTopRightNode = {
    xAlign: "end",
    yAlign: "start",
    xAlignChar: borderCharsetLight.top,
    yAlignChar: borderCharsetLight.right,
    rects: [{ width: 1, render: () => borderCharsetLight.top_right }],
  };
  const borderBottomRightNode = {
    xAlign: "end",
    yAlign: "end",
    xAlignChar: borderCharsetLight.bottom,
    yAlignChar: borderCharsetLight.right,
    rects: [{ width: 1, render: () => borderCharsetLight.bottom_right }],
  };
  const borderBottomLeftNode = {
    xAlign: "start",
    yAlign: "end",
    xAlignChar: borderCharsetLight.bottom,
    yAlignChar: borderCharsetLight.left,
    rects: [{ width: 1, render: () => borderCharsetLight.bottom_left }],
  };
  const borderMidTopNode = {
    xAlign: "center",
    yAlign: "start",
    xAlignChar: borderCharsetLight.top,
    yAlignChar: borderCharsetLight.left,
    rects: [{ width: 1, render: () => borderCharsetLight.mid_top }],
  };
  const borderMidBottomNode = {
    xAlign: "center",
    yAlign: "end",
    xAlignChar: borderCharsetLight.top,
    yAlignChar: borderCharsetLight.right,
    rects: [{ width: 1, render: () => borderCharsetLight.mid_bottom }],
  };
  const borderMidLeftNode = {
    xAlign: "start",
    yAlign: "center",
    xAlignChar: borderCharsetLight.top,
    yAlignChar: borderCharsetLight.right,
    rects: [{ width: 1, render: () => borderCharsetLight.mid_left }],
  };
  const borderMidRightNode = {
    xAlign: "end",
    yAlign: "center",
    xAlignChar: borderCharsetLight.top,
    yAlignChar: borderCharsetLight.right,
    rects: [{ width: 1, render: () => borderCharsetLight.mid_right }],
  };
  const borderMidNode = {
    type: "border_mid",
    xAlign: "center",
    yAlign: "center",
    xAlignChar: borderCharsetLight.top,
    yAlignChar: borderCharsetLight.right,
    rects: [{ width: 1, render: () => borderCharsetLight.mid }],
  };

  Object.assign(SLOT_CONTENT_TYPES, {
    blank: blankNode,
    border_left: borderLeftNode,
    border_right: borderRightNode,
    border_top: borderTopNode,
    border_bottom: borderBottomNode,
    border_top_left: borderTopLeftNode,
    border_top_right: borderTopRightNode,
    border_bottom_left: borderBottomLeftNode,
    border_bottom_right: borderBottomRightNode,
    border_half_left: borderHalfLeftNode,
    border_half_right: borderHalfRightNode,
    border_half_up: borderHalfUpNode,
    border_half_down: borderHalfDownNode,
    border_mid_left: borderMidLeftNode,
    border_mid_right: borderMidRightNode,
    border_mid_top: borderMidTopNode,
    border_mid_bottom: borderMidBottomNode,
    border_mid: borderMidNode,
  });
}

const leftSlot = {
  type: "left",
  adapt: (cell, { renderOptionsRef }) => {
    const { borderLeft } = cell;
    if (borderLeft) {
      renderOptionsRef.current = borderLeft;
      return SLOT_CONTENT_TYPES.border_left;
    }
    return SLOT_CONTENT_TYPES.blank;
  },
};
const rightSlot = {
  type: "right",
  adapt: (cell, { renderOptionsRef }) => {
    const { borderRight } = cell;
    if (borderRight) {
      renderOptionsRef.current = borderRight;
      return SLOT_CONTENT_TYPES.border_right;
    }
    return SLOT_CONTENT_TYPES.blank;
  },
};
const topSlot = {
  type: "top",
  adapt: (cell, { renderOptionsRef }) => {
    const { borderTop } = cell;
    if (borderTop) {
      renderOptionsRef.current = borderTop;
      return SLOT_CONTENT_TYPES.border_top;
    }
    return SLOT_CONTENT_TYPES.blank;
  },
};
const bottomSlot = {
  type: "top",
  adapt: (cell, { renderOptionsRef }) => {
    const { borderBottom } = cell;
    if (borderBottom) {
      renderOptionsRef.current = borderBottom;
      return SLOT_CONTENT_TYPES.border_bottom;
    }
    return SLOT_CONTENT_TYPES.blank;
  },
};
const topLeftSlot = {
  type: "top_left",
  adapt: (cell, { renderOptionsRef }) => {
    const { borderTop, borderLeft, westCell, northCell } = cell;
    if (!borderTop && !borderLeft) {
      return SLOT_CONTENT_TYPES.blank;
    }
    renderOptionsRef.current = borderTop;

    let northConnected =
      northCell && northCell.borderLeft && !northCell.borderBottom;
    let westConnected = westCell && westCell.borderTop && !westCell.borderRight;
    let northWestConnected = northConnected && westConnected;
    if (borderTop && borderLeft) {
      if (northWestConnected) {
        return SLOT_CONTENT_TYPES.border_mid;
      }
      if (westConnected) {
        return SLOT_CONTENT_TYPES.border_mid_top;
      }
      if (northConnected) {
        return SLOT_CONTENT_TYPES.border_mid_left;
      }
      return SLOT_CONTENT_TYPES.border_top_left;
    }
    if (borderLeft) {
      northConnected =
        northCell && (northCell.borderLeft || northCell.borderBottom);
      northWestConnected = northConnected && westConnected;
      if (northWestConnected) {
        return SLOT_CONTENT_TYPES.border_mid_right;
      }
      if (westConnected) {
        return SLOT_CONTENT_TYPES.border_top_right;
      }
      if (northConnected) {
        return SLOT_CONTENT_TYPES.border_left;
      }
      return SLOT_CONTENT_TYPES.border_half_down;
    }
    // borderTop
    westConnected = westCell && (westCell.borderTop || westCell.borderRight);
    northWestConnected = northConnected && westConnected;
    if (northWestConnected) {
      return SLOT_CONTENT_TYPES.border_mid_bottom;
    }
    if (northConnected) {
      return SLOT_CONTENT_TYPES.border_bottom_left;
    }
    if (westConnected) {
      return SLOT_CONTENT_TYPES.border_top;
    }
    return SLOT_CONTENT_TYPES.border_half_right;
  },
};
const topRightSlot = {
  type: "top_right",
  adapt: (cell, { renderOptionsRef }) => {
    const { borderTop, borderRight, eastCell, northCell } = cell;
    if (!borderTop && !borderRight) {
      return SLOT_CONTENT_TYPES.blank;
    }
    renderOptionsRef.current = borderTop;
    let northConnected =
      northCell && northCell.borderRight && !northCell.borderBottom;
    let eastConnected = eastCell && eastCell.borderTop && !eastCell.borderLeft;
    let northEastConnected = northConnected && eastConnected;
    if (borderTop && borderRight) {
      if (northEastConnected) {
        return SLOT_CONTENT_TYPES.border_mid;
      }
      if (northConnected) {
        return SLOT_CONTENT_TYPES.border_mid_right;
      }
      if (eastConnected) {
        return SLOT_CONTENT_TYPES.border_mid_top;
      }
      return SLOT_CONTENT_TYPES.border_top_right;
    }
    if (borderRight) {
      northConnected =
        northCell && (northCell.borderRight || northCell.borderBottom);
      northEastConnected = northConnected && eastConnected;
      if (northEastConnected) {
        return SLOT_CONTENT_TYPES.border_mid_left;
      }
      if (northConnected) {
        return SLOT_CONTENT_TYPES.border_right;
      }
      if (eastConnected) {
        return SLOT_CONTENT_TYPES.border_top_left;
      }
      return SLOT_CONTENT_TYPES.border_half_down;
    }
    // borderTop
    eastConnected = eastCell && (eastCell.borderTop || eastCell.borderLeft);
    northEastConnected = northConnected && eastConnected;
    if (northEastConnected) {
      return SLOT_CONTENT_TYPES.border_mid_bottom;
    }
    if (northConnected) {
      return SLOT_CONTENT_TYPES.border_bottom_right;
    }
    if (eastConnected) {
      return SLOT_CONTENT_TYPES.border_top;
    }
    return SLOT_CONTENT_TYPES.border_half_left;
  },
};
const bottomRightSlot = {
  type: "bottom_right",
  adapt: (cell, { renderOptionsRef }) => {
    const { borderBottom, borderRight, eastCell, southCell } = cell;
    if (!borderBottom && !borderRight) {
      return SLOT_CONTENT_TYPES.blank;
    }
    renderOptionsRef.current = borderBottom;

    let southConnected =
      southCell && southCell.borderRight && !southCell.borderTop;
    let eastConnected =
      eastCell && eastCell.borderBottom && !eastCell.borderLeft;
    let southEastConnected = southConnected && eastConnected;
    if (borderBottom && borderRight) {
      if (southEastConnected) {
        return SLOT_CONTENT_TYPES.border_mid;
      }
      if (eastConnected) {
        return SLOT_CONTENT_TYPES.border_mid_bottom;
      }
      if (southConnected) {
        return SLOT_CONTENT_TYPES.border_mid_right;
      }
      return SLOT_CONTENT_TYPES.border_bottom_right;
    }
    if (borderRight) {
      southConnected =
        southCell && (southCell.borderRight || southCell.borderTop);
      southEastConnected = southConnected && eastConnected;
      if (southEastConnected) {
        return SLOT_CONTENT_TYPES.border_mid_top;
      }
      if (eastConnected) {
        return SLOT_CONTENT_TYPES.border_bottom_left;
      }
      if (southConnected) {
        return SLOT_CONTENT_TYPES.border_right;
      }
      return SLOT_CONTENT_TYPES.border_half_up;
    }
    // border bottom
    eastConnected = eastCell && (eastCell.borderBottom || eastCell.borderLeft);
    southEastConnected = southConnected && eastConnected;
    if (southEastConnected) {
      return SLOT_CONTENT_TYPES.border_mid_top;
    }
    if (southConnected) {
      return SLOT_CONTENT_TYPES.border_top_right;
    }
    if (eastConnected) {
      return SLOT_CONTENT_TYPES.border_bottom;
    }
    return SLOT_CONTENT_TYPES.border_half_left;
  },
};
const bottomLeftSlot = {
  type: "bottom_left",
  adapt: (cell, { renderOptionsRef }) => {
    const { borderBottom, borderLeft, westCell, southCell } = cell;
    if (!borderBottom && !borderLeft) {
      return SLOT_CONTENT_TYPES.blank;
    }
    renderOptionsRef.current = borderBottom;

    let southConnected =
      southCell && southCell.borderLeft && !southCell.borderTop;
    let westConnected =
      westCell && westCell.borderBottom && !westCell.borderRight;
    let southWestConnected = southConnected && westConnected;
    if (borderBottom && borderLeft) {
      if (southWestConnected) {
        return SLOT_CONTENT_TYPES.border_mid;
      }
      if (southConnected) {
        return SLOT_CONTENT_TYPES.border_mid_left;
      }
      if (westConnected) {
        return SLOT_CONTENT_TYPES.border_mid_bottom;
      }
      return SLOT_CONTENT_TYPES.border_bottom_left;
    }
    if (borderLeft) {
      southConnected =
        southCell && (southCell.borderLeft || southCell.borderTop);
      southWestConnected = southConnected && westConnected;
      if (southWestConnected) {
        return SLOT_CONTENT_TYPES.border_mid_right;
      }
      if (westConnected) {
        return SLOT_CONTENT_TYPES.border_bottom_right;
      }
      if (southConnected) {
        return SLOT_CONTENT_TYPES.border_left;
      }
      return SLOT_CONTENT_TYPES.border_half_up;
    }
    // borderBottom
    westConnected = westCell && (westCell.borderBottom || westCell.borderRight);
    southWestConnected = southConnected && westConnected;
    if (southWestConnected) {
      return SLOT_CONTENT_TYPES.border_mid_top;
    }
    if (southConnected) {
      return SLOT_CONTENT_TYPES.border_top_left;
    }
    if (westConnected) {
      return SLOT_CONTENT_TYPES.border_bottom;
    }
    return SLOT_CONTENT_TYPES.border_half_right;
  },
};

export const renderTable = (inputGrid, { ansi, borderCollapse } = {}) => {
  if (!Array.isArray(inputGrid)) {
    throw new TypeError(`The first arg must be an array, got ${inputGrid}`);
  }
  if (inputGrid.length === 0) {
    return "";
  }

  const grid = [];
  const columnWithLeftSlotSet = new Set();
  const columnWithRightSlotSet = new Set();
  const columnHasLeftSlot = (x) => columnWithLeftSlotSet.has(x);
  const columnHasRightSlot = (x) => columnWithRightSlotSet.has(x);
  const leftSlotRowMap = new Map();
  const rightSlotRowMap = new Map();
  const topSlotRowMap = new Map();
  const bottomSlotRowMap = new Map();
  // detect borders
  {
    const onBorderLeft = (x, y) => {
      columnWithLeftSlotSet.add(x);
      const leftSlotRow = leftSlotRowMap.get(y);
      if (!leftSlotRow) {
        const leftSlotRow = [];
        leftSlotRowMap.set(y, leftSlotRow);
        leftSlotRow[x] = leftSlot;
      } else {
        leftSlotRow[x] = leftSlot;
      }
    };
    const onBorderRight = (x, y) => {
      columnWithRightSlotSet.add(x);
      const rightSlotRow = rightSlotRowMap.get(y);
      if (!rightSlotRow) {
        const rightSlotRow = [];
        rightSlotRowMap.set(y, rightSlotRow);
        rightSlotRow[x] = rightSlot;
      } else {
        rightSlotRow[x] = rightSlot;
      }
    };
    const onBorderTop = (x, y) => {
      const topSlotRow = topSlotRowMap.get(y);
      if (!topSlotRow) {
        const topSlotRow = [];
        topSlotRowMap.set(y, topSlotRow);
        topSlotRow[x] = topSlot;
      } else {
        topSlotRow[x] = topSlot;
      }
    };
    const onBorderBottom = (x, y) => {
      const bottomSlotRow = bottomSlotRowMap.get(y);
      if (!bottomSlotRow) {
        const bottomSlotRow = [];
        bottomSlotRowMap.set(y, bottomSlotRow);
        bottomSlotRow[x] = bottomSlot;
      } else {
        bottomSlotRow[x] = bottomSlot;
      }
    };

    let y = 0;
    for (const inputRow of inputGrid) {
      let x = 0;
      const row = [];
      for (const inputCell of inputRow) {
        const {
          border,
          borderLeft = border,
          borderRight = border,
          borderTop = border,
          borderBottom = border,
          ...props
        } = inputCell;
        const cell = createCell(props, { ansi });
        const westCell = x === 0 ? null : row[x - 1];
        const northCell = y === 0 ? null : grid[y - 1][x];
        cell.westCell = westCell;
        cell.northCell = northCell;
        if (westCell) {
          westCell.eastCell = cell;
        }
        if (northCell) {
          northCell.southCell = cell;
        }
        if (borderLeft) {
          if (borderCollapse && westCell && westCell.borderRight) {
          } else {
            cell.borderLeft = borderLeft;
            onBorderLeft(x, y);
          }
        }
        if (borderRight) {
          cell.borderRight = borderRight;
          onBorderRight(x, y);
        }
        if (borderTop) {
          if (borderCollapse && northCell && northCell.borderBottom) {
          } else {
            cell.borderTop = borderTop;
            onBorderTop(x, y);
          }
        }
        if (borderBottom) {
          cell.borderBottom = borderBottom;
          onBorderBottom(x, y);
        }
        row[x] = cell;
        x++;
      }
      grid[y] = row;
      y++;
    }
  }
  // fill holes in slot rows
  {
    let y = 0;
    while (y < grid.length) {
      let leftSlotRow = leftSlotRowMap.get(y);
      let rightSlotRow = rightSlotRowMap.get(y);
      const topSlotRow = topSlotRowMap.get(y);
      const bottomSlotRow = bottomSlotRowMap.get(y);
      let x = 0;
      while (x < grid[y].length) {
        if (leftSlotRow) {
          if (!leftSlotRow[x] && columnHasLeftSlot(x)) {
            leftSlotRow[x] = leftSlot;
          }
        } else if (columnHasLeftSlot(x)) {
          leftSlotRow = [];
          leftSlotRowMap.set(y, leftSlotRow);
          leftSlotRow[x] = leftSlot;
        }

        if (rightSlotRow) {
          if (!rightSlotRow[x] && columnHasRightSlot(x)) {
            rightSlotRow[x] = rightSlot;
          }
        } else if (columnHasRightSlot(x)) {
          rightSlotRow = [];
          rightSlotRowMap.set(y, rightSlotRow);
          rightSlotRow[x] = rightSlot;
        }

        if (topSlotRow && !topSlotRow[x]) {
          topSlotRow[x] = topSlot;
        }
        if (bottomSlotRow && !bottomSlotRow[x]) {
          bottomSlotRow[x] = bottomSlot;
        }
        x++;
      }
      y++;
    }
  }
  // create corners
  const topLeftSlotRowMap = new Map();
  const topRightSlotRowMap = new Map();
  const bottomLeftSlotRowMap = new Map();
  const bottomRightSlotRowMap = new Map();
  {
    let y = 0;
    while (y < grid.length) {
      const leftSlotRow = leftSlotRowMap.get(y);
      const rightSlotRow = rightSlotRowMap.get(y);
      if (!leftSlotRow && !rightSlotRow) {
        y++;
        continue;
      }
      const topSlotRow = topSlotRowMap.get(y);
      const bottomSlotRow = bottomSlotRowMap.get(y);
      if (!topSlotRow && !bottomSlotRow) {
        y++;
        continue;
      }
      const topLeftSlotRow = [];
      const topRightSlotRow = [];
      const bottomLeftSlotRow = [];
      const bottomRightSlotRow = [];
      let x = 0;
      while (x < grid[y].length) {
        const leftSlot = leftSlotRow && leftSlotRow[x];
        const rightSlot = rightSlotRow && rightSlotRow[x];

        if (topSlotRow && leftSlot) {
          topLeftSlotRow[x] = topLeftSlot;
        }
        if (topSlotRow && rightSlot) {
          topRightSlotRow[x] = topRightSlot;
        }
        if (bottomSlotRow && leftSlot) {
          bottomLeftSlotRow[x] = bottomLeftSlot;
        }
        if (bottomSlotRow && rightSlot) {
          bottomRightSlotRow[x] = bottomRightSlot;
        }
        x++;
      }
      if (topLeftSlotRow.length) {
        topLeftSlotRowMap.set(y, topLeftSlotRow);
      }
      if (topRightSlotRow.length) {
        topRightSlotRowMap.set(y, topRightSlotRow);
      }
      if (bottomLeftSlotRow.length) {
        bottomLeftSlotRowMap.set(y, bottomLeftSlotRow);
      }
      if (bottomRightSlotRow.length) {
        bottomRightSlotRowMap.set(y, bottomRightSlotRow);
      }
      y++;
    }
  }
  // replace slots with content that will be rendered in that slot (border or blank)
  {
    let y = 0;
    while (y < grid.length) {
      const row = grid[y];
      const leftSlotRow = leftSlotRowMap.get(y);
      const rightSlotRow = rightSlotRowMap.get(y);
      const topSlotRow = topSlotRowMap.get(y);
      const bottomSlotRow = bottomSlotRowMap.get(y);
      const topLeftSlotRow = topLeftSlotRowMap.get(y);
      const topRightSlotRow = topRightSlotRowMap.get(y);
      const bottomLeftSlotRow = bottomLeftSlotRowMap.get(y);
      const bottomRightSlotRow = bottomRightSlotRowMap.get(y);
      let x = 0;
      while (x < row.length) {
        const cell = row[x];
        const adapt = (slot) => {
          const renderOptionsRef = { current: null };
          renderOptionsRef.current = null;
          const node = slot.adapt(cell, { renderOptionsRef });
          const renderOptions = renderOptionsRef.current;
          if (!renderOptions) {
            return node;
          }
          const { bold, color } = renderOptions;
          const nodeWithOptions = { ...node, color, bold };
          return nodeWithOptions;
        };

        if (leftSlotRow) {
          const leftSlot = leftSlotRow[x];
          if (leftSlot) {
            const leftSlotNode = adapt(leftSlot);
            leftSlotRow[x] = leftSlotNode;
          }
        }
        if (rightSlotRow) {
          const rightSlot = rightSlotRow[x];
          if (rightSlot) {
            const rightSlotNode = adapt(rightSlot);
            rightSlotRow[x] = rightSlotNode;
          }
        }
        if (topSlotRow) {
          const topSlot = topSlotRow[x];
          const topSlotNode = adapt(topSlot);
          topSlotRow[x] = topSlotNode;
        }
        if (bottomSlotRow) {
          const bottomSlot = bottomSlotRow[x];
          const bottomSlotNode = adapt(bottomSlot);
          bottomSlotRow[x] = bottomSlotNode;
        }
        // corners
        if (topLeftSlotRow) {
          const topLeftSlot = topLeftSlotRow[x];
          if (topLeftSlot) {
            const topLeftSlotNode = adapt(topLeftSlot);
            topLeftSlotRow[x] = topLeftSlotNode;
          }
        }
        if (topRightSlotRow) {
          const topRightSlot = topRightSlotRow[x];
          if (topRightSlot) {
            const topRightSlotNode = adapt(topRightSlot);
            topRightSlotRow[x] = topRightSlotNode;
          }
        }
        if (bottomRightSlotRow) {
          const bottomRightSlot = bottomRightSlotRow[x];
          if (bottomRightSlot) {
            const bottomRightSlotNode = adapt(bottomRightSlot);
            bottomRightSlotRow[x] = bottomRightSlotNode;
          }
        }
        if (bottomLeftSlotRow) {
          const bottomLeftSlot = bottomLeftSlotRow[x];
          if (bottomLeftSlot) {
            const bottomLeftSlotNode = adapt(bottomLeftSlot);
            bottomLeftSlotRow[x] = bottomLeftSlotNode;
          }
        }
        x++;
      }
      y++;
    }
  }
  // measure column and row dimensions (biggest of all cells in the column/row)
  const columnWidthMap = new Map();
  const rowHeightMap = new Map();
  {
    const measureNode = (node) => {
      const {
        rects,
        leftSpacing = 0,
        rightSpacing = 0,
        topSpacing = 0,
        bottomSpacing = 0,
      } = node;
      let nodeWidth = -1;
      for (const rect of rects) {
        let { width } = rect;
        if (width === "fill") {
          continue;
        }
        if (leftSpacing || rightSpacing) {
          width += leftSpacing + rightSpacing;
          rect.width = width;
          const { render } = rect;
          rect.render = (...args) => {
            const text = render(...args);
            return " ".repeat(leftSpacing) + text + " ".repeat(rightSpacing);
          };
        }
        if (width > nodeWidth) {
          nodeWidth = width;
        }
      }
      if (topSpacing) {
        let lineToInsertAbove = topSpacing;
        while (lineToInsertAbove--) {
          rects.unshift({
            width: "fill",
            render: ({ columnWidth }) => " ".repeat(columnWidth),
          });
        }
      }
      if (bottomSpacing) {
        let lineToInsertBelow = bottomSpacing;
        while (lineToInsertBelow--) {
          rects.push({
            width: "fill",
            render: ({ columnWidth }) => " ".repeat(columnWidth),
          });
        }
      }
      const nodeHeight = rects.length;
      return [nodeWidth, nodeHeight];
    };

    let y = 0;
    for (const line of grid) {
      let x = 0;
      for (const cell of line) {
        const columnWidth = columnWidthMap.get(x) || -1;
        const rowHeight = rowHeightMap.get(y) || -1;
        const [cellWidth, cellHeight] = measureNode(cell);
        if (cellWidth > columnWidth) {
          columnWidthMap.set(x, cellWidth);
        }
        if (cellHeight > rowHeight) {
          rowHeightMap.set(y, cellHeight);
        }
        x++;
      }
      y++;
    }
  }

  // render table
  let log = "";
  {
    const renderRow = (
      nodeArray,
      { cells, rowHeight, leftSlotRow, rightSlotRow },
    ) => {
      let rowText = "";
      let lastLineIndex = rowHeight;
      let lineIndex = 0;
      while (lineIndex !== lastLineIndex) {
        let x = 0;
        let lineText = "";
        for (const node of nodeArray) {
          const cell = cells[x];
          const nodeLineText = renderNode(node, {
            cell,
            columnWidth: columnWidthMap.get(x),
            rowHeight,
            lineIndex,
          });
          let leftSlotLineText;
          let rightSlotLineText;
          if (leftSlotRow) {
            const leftSlot = leftSlotRow[x];
            if (leftSlot) {
              leftSlotLineText = renderNode(leftSlot, {
                cell,
                columnWidth: 1,
                rowHeight,
                lineIndex,
              });
            }
          }
          if (rightSlotRow) {
            const rightSlot = rightSlotRow[x];
            if (rightSlot) {
              rightSlotLineText = renderNode(rightSlot, {
                cell,
                columnWidth: 1,
                rowHeight,
                lineIndex,
              });
            }
          }
          if (leftSlotLineText && rightSlotLineText) {
            lineText += leftSlotLineText + nodeLineText + rightSlotLineText;
          } else if (leftSlotLineText) {
            lineText += leftSlotLineText + nodeLineText;
          } else if (rightSlotLineText) {
            lineText += nodeLineText + rightSlotLineText;
          } else {
            lineText += nodeLineText;
          }
          x++;
        }
        rowText += lineText;
        lineIndex++;
        rowText += "\n";
      }
      return rowText;
    };
    const renderNode = (node, { cell, columnWidth, rowHeight, lineIndex }) => {
      let {
        bold,
        xAlign,
        xAlignChar = " ",
        yAlign,
        yAlignChar = " ",
        rects,
        color,
      } = node;
      if (typeof xAlignChar === "object") {
        xAlignChar = bold ? xAlignChar.bold : xAlignChar.light;
      }
      if (typeof yAlignChar === "object") {
        yAlignChar = bold ? yAlignChar.bold : yAlignChar.light;
      }

      const nodeHeight = rects.length;
      let rect;
      if (yAlign === "start") {
        if (lineIndex < nodeHeight) {
          rect = rects[lineIndex];
        }
      } else if (yAlign === "center") {
        const topSpacing = Math.floor((rowHeight - nodeHeight) / 2);
        // const bottomSpacing = rowHeight - cellHeight - topSpacing;
        const lineStartIndex = topSpacing;
        const lineEndIndex = topSpacing + nodeHeight;
        if (lineIndex >= lineStartIndex && lineIndex < lineEndIndex) {
          rect = rects[lineIndex];
        }
      } else {
        const lineStartIndex = rowHeight - nodeHeight;
        if (lineIndex >= lineStartIndex) {
          rect = rects[lineIndex];
        }
      }

      if (rect) {
        let { width, render } = rect;
        if (typeof render === "object") {
          render = bold ? render.bold : render.light;
        }
        let rectText;
        if (typeof render === "function") {
          rectText = render({
            cell,
            columnWidth,
            bold,
          });
        } else {
          rectText = render;
        }
        if (width === "fill") {
          return rectText;
        }
        if (ansi && color) {
          if (typeof color === "function") {
            color = color(cell, { columnWidth, bold });
          }
          rectText = ANSI.color(rectText, color);
        }
        return applyXAlign(rectText, {
          width,
          desiredWidth: columnWidth,
          align: xAlign,
          alignChar: xAlignChar,
        });
      }
      return applyXAlign(yAlignChar, {
        width: 1,
        desiredWidth: columnWidth,
        align: xAlign,
        alignChar: " ",
      });
    };

    let y = 0;
    for (const row of grid) {
      top_slot_row: {
        const topSlotRow = topSlotRowMap.get(y);
        if (topSlotRow) {
          const topSlotRowText = renderRow(topSlotRow, {
            cells: row,
            rowHeight: 1,
            leftSlotRow: topLeftSlotRowMap.get(y),
            rightSlotRow: topRightSlotRowMap.get(y),
          });
          log += topSlotRowText;
        }
      }
      content_row: {
        const contentRowText = renderRow(row, {
          cells: row,
          rowHeight: rowHeightMap.get(y),
          leftSlotRow: leftSlotRowMap.get(y),
          rightSlotRow: rightSlotRowMap.get(y),
        });
        log += contentRowText;
      }
      bottom_slot_row: {
        const bottomSlotRow = bottomSlotRowMap.get(y);
        if (bottomSlotRow) {
          const bottomSlotRowText = renderRow(bottomSlotRow, {
            cells: row,
            rowHeight: 1,
            leftSlotRow: bottomLeftSlotRowMap.get(y),
            rightSlotRow: bottomRightSlotRowMap.get(y),
          });
          log += bottomSlotRowText;
        }
      }
      y++;
    }
  }
  return log;
};

const applyXAlign = (text, { width, desiredWidth, align, alignChar }) => {
  const missingWidth = desiredWidth - width;
  if (missingWidth < 0) {
    // never supposed to happen because the width of a column
    // is the biggest width of all cells in this column
    return text;
  }
  if (missingWidth === 0) {
    return text;
  }
  // if (align === "fill") {
  //   let textRepeated = "";
  //   let widthFilled = 0;
  //   while (true) {
  //     textRepeated += text;
  //     widthFilled += width;
  //     if (widthFilled >= desiredWidth) {
  //       break;
  //     }
  //   }
  //   return textRepeated;
  // }
  if (align === "start") {
    return text + alignChar.repeat(missingWidth);
  }
  if (align === "center") {
    const leftSpacing = Math.floor(missingWidth / 2);
    const rightSpacing = missingWidth - leftSpacing;

    return (
      alignChar.repeat(leftSpacing) + text + alignChar.repeat(rightSpacing)
    );
  }
  // "end"
  return alignChar.repeat(missingWidth) + text;
};

const createCell = (
  {
    value,
    quoteAroundStrings,
    color,
    format,
    bold,
    unit,
    unitColor,
    leftSpacing = 1,
    rightSpacing = 1,
    topSpacing = 0,
    bottomSpacing = 0,
    xAlign = "start", // "start", "center", "end"
    yAlign = "start", // "start", "center", "end"
  },
  { ansi },
) => {
  let text;
  if (typeof value === "string") {
    if (quoteAroundStrings) {
      text = `"${value}"`;
      if (color === undefined) {
        color = ANSI.GREEN;
      }
    } else {
      text = value;
    }
  } else if (typeof value === "number") {
    if (format === "size") {
      text = humanizeFileSize(value);
    } else {
      text = String(value);
      if (color === undefined) {
        color = ANSI.YELLOW;
      }
    }
  } else {
    text = String(value);
  }

  if (ansi && bold) {
    text = ANSI.color(text, ANSI.BOLD);
  }
  if (ansi && color) {
    text = ANSI.color(text, color);
  }

  const lines = text.split("\n");

  let lineIndex = 0;
  const rects = [];
  for (const line of lines) {
    const isLastLine = lineIndex === lines.length - 1;
    let lineWidth = stringWidth(line);
    let lineText = line;
    if (isLastLine && unit) {
      lineWidth += ` ${unit}`.length;
      if (ansi && unitColor) {
        unit = ANSI.color(unit, unitColor);
      }
      lineText += ` ${unit}`;
    }
    rects.push({
      width: lineWidth,
      render: () => lineText,
    });
    lineIndex++;
  }

  return {
    type: "content",
    value,
    xAlign,
    yAlign,
    leftSpacing,
    rightSpacing,
    topSpacing,
    bottomSpacing,
    rects,
  };
};
