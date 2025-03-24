/**
 *
 * https://www.w3schools.com/charsets/ref_utf_box.asp
 * https://github.com/Automattic/cli-table
 *
 *
 * remaining:
 * border collapse (par defaut ce sera false et on refera tout les tests en mode collapse)
 * border color conflicts
 * ability to control border chars
 * multiline (for later)
 *
 * ideally keep the word cell for content and
 * all the rest should be named "node" or something
 * and when we render we render border nodes, cell nodes and blank nodes
 * not cells, because cells are displaying content
 */

import { ANSI, humanizeFileSize } from "@jsenv/humanize";
import stringWidth from "string-width";

const SLOT_CONTENT_TYPES = {};
{
  // blank content is a fluid content that will take whatever size they are requested to take
  // they can seen as placeholders that are removed when a line or column is composed only by blank cells
  // this is useful to enforce a given amount of line / columns that can be adjusted later if nothing use the reserved line/column
  // (used to implement borders because any cell can suddenly enable a border meaning all previous cells must now have blank spaces
  // where the border is)
  const blankCell = {
    type: "blank",
    rects: [
      { width: "fill", render: ({ columnWidth }) => " ".repeat(columnWidth) },
    ],
  };
  const borderLeftCell = {
    type: "border_left",
    xAlign: "end",
    yAlignChar: "│",
    rects: [{ width: 1, render: () => "│" }],
  };
  const borderRightCell = {
    type: "border_right",
    xAlign: "start",
    yAlignChar: "│",
    rects: [{ width: 1, render: () => "│" }],
  };
  const borderTopCell = {
    type: "border_top",
    yAlign: "end",
    rects: [
      { width: "fill", render: ({ columnWidth }) => "─".repeat(columnWidth) },
    ],
  };
  const borderBottomCell = {
    type: "border_bottom",
    yAlign: "start",
    rects: [
      { width: "fill", render: ({ columnWidth }) => "─".repeat(columnWidth) },
    ],
  };
  const borderHalfRightCell = {
    type: "border_half_right",
    xAlign: "end",
    yAlign: "end",
    rects: [{ width: 1, render: () => "╶" }],
  };
  const borderHalfLeftCell = {
    type: "border_half_left",
    xAlign: "start",
    yAlign: "end",
    rects: [{ width: 1, render: () => "╴" }],
  };
  const borderHalfUpCell = {
    type: "border_half_up",
    xAlign: "start",
    yAlign: "start",
    rects: [{ width: 1, render: () => "╵" }],
  };
  const borderHalfDownCell = {
    type: "border_half_right",
    xAlign: "end",
    yAlign: "start",
    rects: [{ width: 1, render: () => "╷" }],
  };
  const borderTopLeftCell = {
    xAlign: "start",
    yAlign: "start",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [{ width: 1, render: () => "┌" }],
  };
  const borderTopRightCell = {
    xAlign: "end",
    yAlign: "start",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [{ width: 1, render: () => "┐" }],
  };
  const borderBottomRightCell = {
    xAlign: "end",
    yAlign: "end",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [{ width: 1, render: () => "┘" }],
  };
  const borderBottomLeftCell = {
    xAlign: "start",
    yAlign: "end",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [{ width: 1, render: () => "└" }],
  };
  const borderTopMidCell = {
    xAlign: "center",
    yAlign: "start",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [{ width: 1, render: () => "┬" }],
  };
  const borderBottomMidCell = {
    xAlign: "center",
    yAlign: "end",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [{ width: 1, render: () => "┴" }],
  };
  const borderLeftMidCell = {
    xAlign: "start",
    yAlign: "center",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [{ width: 1, render: () => "├" }],
  };
  const borderRightMidCell = {
    xAlign: "end",
    yAlign: "center",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [{ width: 1, render: () => "┤" }],
  };
  const borderMidCell = {
    type: "border_mid",
    xAlign: "center",
    yAlign: "center",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [{ width: 1, render: () => "┼" }],
  };

  Object.assign(SLOT_CONTENT_TYPES, {
    blank: blankCell,
    border_left: borderLeftCell,
    border_right: borderRightCell,
    border_top: borderTopCell,
    border_bottom: borderBottomCell,
    border_top_left: borderTopLeftCell,
    border_top_right: borderTopRightCell,
    border_bottom_left: borderBottomLeftCell,
    border_bottom_right: borderBottomRightCell,
    border_half_left: borderHalfLeftCell,
    border_half_right: borderHalfRightCell,
    border_half_up: borderHalfUpCell,
    border_half_down: borderHalfDownCell,
    border_left_mid: borderLeftMidCell,
    border_right_mid: borderRightMidCell,
    border_top_mid: borderTopMidCell,
    border_bottom_mid: borderBottomMidCell,
    border_mid: borderMidCell,
  });
}

const leftSlot = {
  type: "left",
  adapt: ({ cell }) => {
    return cell.borderLeft
      ? SLOT_CONTENT_TYPES.border_left
      : SLOT_CONTENT_TYPES.blank;
  },
};
const rightSlot = {
  type: "right",
  adapt: ({ cell }) => {
    return cell.borderRight
      ? SLOT_CONTENT_TYPES.border_right
      : SLOT_CONTENT_TYPES.blank;
  },
};
const topSlot = {
  type: "top",
  adapt: ({ cell }) => {
    return cell.borderTop
      ? SLOT_CONTENT_TYPES.border_top
      : SLOT_CONTENT_TYPES.blank;
  },
};
const bottomSlot = {
  type: "top",
  adapt: ({ cell }) => {
    return cell.borderBottom
      ? SLOT_CONTENT_TYPES.border_bottom
      : SLOT_CONTENT_TYPES.blank;
  },
};
const topLeftSlot = {
  type: "top_left",
  adapt: ({ cell, westCell, northCell }) => {
    const { borderTop, borderLeft } = cell;
    if (!borderTop && !borderLeft) {
      return SLOT_CONTENT_TYPES.blank;
    }

    let northConnected =
      northCell && northCell.borderLeft && !northCell.borderBottom;
    let westConnected = westCell && westCell.borderTop && !westCell.borderRight;
    let northWestConnected = northConnected && westConnected;
    if (borderTop && borderLeft) {
      if (northWestConnected) {
        return SLOT_CONTENT_TYPES.border_mid;
      }
      if (westConnected) {
        return SLOT_CONTENT_TYPES.border_top_mid;
      }
      if (northConnected) {
        return SLOT_CONTENT_TYPES.border_left_mid;
      }
      return SLOT_CONTENT_TYPES.border_top_left;
    }
    if (borderLeft) {
      northConnected =
        northCell && (northCell.borderLeft || northCell.borderBottom);
      northWestConnected = northConnected && westConnected;
      if (northWestConnected) {
        return SLOT_CONTENT_TYPES.border_right_mid;
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
      return SLOT_CONTENT_TYPES.border_bottom_mid;
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
  adapt: ({ cell, eastCell, northCell }) => {
    const { borderTop, borderRight } = cell;
    if (!borderTop && !borderRight) {
      return SLOT_CONTENT_TYPES.blank;
    }

    let northConnected =
      northCell && northCell.borderRight && !northCell.borderBottom;
    let eastConnected = eastCell && eastCell.borderTop && !eastCell.borderLeft;
    let northEastConnected = northConnected && eastConnected;
    if (borderTop && borderRight) {
      if (northEastConnected) {
        return SLOT_CONTENT_TYPES.border_mid;
      }
      if (northConnected) {
        return SLOT_CONTENT_TYPES.border_right_mid;
      }
      if (eastConnected) {
        return SLOT_CONTENT_TYPES.border_top_mid;
      }
      return SLOT_CONTENT_TYPES.border_top_right;
    }
    if (borderRight) {
      northConnected =
        northCell && (northCell.borderRight || northCell.borderBottom);
      northEastConnected = northConnected && eastConnected;
      if (northEastConnected) {
        return SLOT_CONTENT_TYPES.border_left_mid;
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
      return SLOT_CONTENT_TYPES.border_bottom_mid;
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
  adapt: ({ cell, eastCell, southCell }) => {
    const { borderBottom, borderRight } = cell;
    if (!borderBottom && !borderRight) {
      return SLOT_CONTENT_TYPES.blank;
    }

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
        return SLOT_CONTENT_TYPES.border_bottom_mid;
      }
      if (southConnected) {
        return SLOT_CONTENT_TYPES.border_right_mid;
      }
      return SLOT_CONTENT_TYPES.border_bottom_right;
    }
    if (borderRight) {
      southConnected =
        southCell && (southCell.borderRight || southCell.borderTop);
      southEastConnected = southConnected && eastConnected;
      if (southEastConnected) {
        return SLOT_CONTENT_TYPES.border_top_mid;
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
      return SLOT_CONTENT_TYPES.border_top_mid;
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
  adapt: ({ cell, westCell, southCell }) => {
    const { borderBottom, borderLeft } = cell;
    if (!borderBottom && !borderLeft) {
      return SLOT_CONTENT_TYPES.blank;
    }

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
        return SLOT_CONTENT_TYPES.border_left_mid;
      }
      if (westConnected) {
        return SLOT_CONTENT_TYPES.border_bottom_mid;
      }
      return SLOT_CONTENT_TYPES.border_bottom_left;
    }
    if (borderLeft) {
      southConnected =
        southCell && (southCell.borderLeft || southCell.borderTop);
      southWestConnected = southConnected && westConnected;
      if (southWestConnected) {
        return SLOT_CONTENT_TYPES.border_right_mid;
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
      return SLOT_CONTENT_TYPES.border_top_mid;
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

export const renderTable = (inputGrid, { ansi = true } = {}) => {
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
        const contentCell = createContentCell(props, { ansi });
        row[x] = contentCell;
        if (borderLeft) {
          contentCell.borderLeft = borderLeft;
          onBorderLeft(x, y);
        }
        if (borderRight) {
          contentCell.borderRight = borderRight;
          onBorderRight(x, y);
        }
        if (borderTop) {
          contentCell.borderTop = borderTop;
          onBorderTop(x, y);
        }
        if (borderBottom) {
          contentCell.borderBottom = borderBottom;
          onBorderBottom(x, y);
        }
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
        const westCell = x === 0 ? null : row[x - 1];
        const eastCell = x === row.length - 1 ? null : row[x + 1];
        const northCell = y === 0 ? null : grid[y - 1][x];
        const southCell = y === grid.length - 1 ? null : grid[y + 1][x];
        const northEastCell =
          y === 0 || x === row.length - 1 ? null : grid[y - 1][x + 1];
        const southEastCell =
          y === grid.length - 1 || x === row.length - 1
            ? null
            : grid[y + 1][x + 1];
        const southWestCell =
          y === grid.length - 1 || x === 0 ? null : grid[y + 1][x - 1];
        const northWestCell = y === 0 || x === 0 ? null : grid[y - 1][x - 1];
        const adaptParams = {
          cell,
          westCell,
          eastCell,
          northCell,
          southCell,
          northEastCell,
          southEastCell,
          southWestCell,
          northWestCell,
        };

        if (leftSlotRow) {
          const leftSlot = leftSlotRow[x];
          if (leftSlot) {
            const leftSlotContent = leftSlot.adapt(adaptParams);
            leftSlotRow[x] = leftSlotContent;
          }
        }
        if (rightSlotRow) {
          const rightSlot = rightSlotRow[x];
          if (rightSlot) {
            const rightSlotContent = rightSlot.adapt(adaptParams);
            rightSlotRow[x] = rightSlotContent;
          }
        }
        if (topSlotRow) {
          const topSlot = topSlotRow[x];
          const topSlotContent = topSlot.adapt(adaptParams);
          topSlotRow[x] = topSlotContent;
        }
        if (bottomSlotRow) {
          const bottomSlot = bottomSlotRow[x];
          const bottomSlotContent = bottomSlot.adapt(adaptParams);
          bottomSlotRow[x] = bottomSlotContent;
        }
        // corners
        if (topLeftSlotRow) {
          const topLeftSlot = topLeftSlotRow[x];
          if (topLeftSlot) {
            const topLeftSlotCell = topLeftSlot.adapt(adaptParams);
            topLeftSlotRow[x] = topLeftSlotCell;
          }
        }
        if (topRightSlotRow) {
          const topRightSlot = topRightSlotRow[x];
          if (topRightSlot) {
            const topRightSlotCell = topRightSlot.adapt(adaptParams);
            topRightSlotRow[x] = topRightSlotCell;
          }
        }
        if (bottomRightSlotRow) {
          const bottomRightSlot = bottomRightSlotRow[x];
          if (bottomRightSlot) {
            const bottomRightSlotCell = bottomRightSlot.adapt(adaptParams);
            bottomRightSlotRow[x] = bottomRightSlotCell;
          }
        }
        if (bottomLeftSlotRow) {
          const bottomLeftSlot = bottomLeftSlotRow[x];
          if (bottomLeftSlot) {
            const bottomLeftSlotCell = bottomLeftSlot.adapt(adaptParams);
            bottomLeftSlotRow[x] = bottomLeftSlotCell;
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
    const measureCell = (cell) => {
      const {
        rects,
        leftSpacing = 0,
        rightSpacing = 0,
        topSpacing = 0,
        bottomSpacing = 0,
      } = cell;
      let cellWidth = -1;
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
        if (width > cellWidth) {
          cellWidth = width;
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
      const cellHeight = rects.length;

      return [cellWidth, cellHeight];
    };

    let y = 0;
    for (const line of grid) {
      let x = 0;
      for (const cell of line) {
        const columnWidth = columnWidthMap.get(x) || -1;
        const rowHeight = rowHeightMap.get(y) || -1;
        const [cellWidth, cellHeight] = measureCell(cell);
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
    const renderRow = (cells, { rowHeight, leftSlotRow, rightSlotRow }) => {
      let rowText = "";
      let lastLineIndex = rowHeight;
      let lineIndex = 0;
      while (lineIndex !== lastLineIndex) {
        let x = 0;
        let lineText = "";
        for (const cell of cells) {
          const cellLineText = renderCell(cell, {
            columnWidth: columnWidthMap.get(x),
            rowHeight,
            lineIndex,
          });
          let leftSlotLineText;
          let rightSlotLineText;
          if (leftSlotRow) {
            const leftSlotCell = leftSlotRow[x];
            if (leftSlotCell) {
              leftSlotLineText = renderCell(leftSlotCell, {
                columnWidth: 1,
                rowHeight,
                lineIndex,
              });
            }
          }
          if (rightSlotRow) {
            const rightSlotCell = rightSlotRow[x];
            if (rightSlotCell) {
              rightSlotLineText = renderCell(rightSlotCell, {
                columnWidth: 1,
                rowHeight,
                lineIndex,
              });
            }
          }
          if (leftSlotLineText && rightSlotLineText) {
            lineText += leftSlotLineText + cellLineText + rightSlotLineText;
          } else if (leftSlotLineText) {
            lineText += leftSlotLineText + cellLineText;
          } else if (rightSlotLineText) {
            lineText += cellLineText + rightSlotLineText;
          } else {
            lineText += cellLineText;
          }
          x++;
        }
        rowText += lineText;
        lineIndex++;
        rowText += "\n";
      }
      return rowText;
    };
    const renderCell = (
      cell,
      { columnWidth, rowHeight, lineIndex, ...rest },
    ) => {
      let { xAlign, xAlignChar = " ", yAlign, yAlignChar = " ", rects } = cell;
      const cellHeight = rects.length;

      let rect;
      if (yAlign === "start") {
        if (lineIndex < cellHeight) {
          rect = rects[lineIndex];
        }
      } else if (yAlign === "center") {
        const topSpacing = Math.floor((rowHeight - cellHeight) / 2);
        // const bottomSpacing = rowHeight - cellHeight - topSpacing;
        const lineStartIndex = topSpacing;
        const lineEndIndex = topSpacing + cellHeight;
        if (lineIndex >= lineStartIndex && lineIndex < lineEndIndex) {
          rect = rects[lineIndex];
        }
      } else {
        const lineStartIndex = rowHeight - cellHeight;
        if (lineIndex >= lineStartIndex) {
          rect = rects[lineIndex];
        }
      }

      if (rect) {
        const { width, render } = rect;
        let rectText = render({
          columnWidth,
          ...rest,
          updateOptions: (options) => {
            if (options.xAlign) {
              xAlign = options.xAlign;
            }
            if (options.xAlignChar) {
              xAlignChar = options.xAlignChar;
            }
            if (options.yAlign) {
              yAlign = options.yAlign;
            }
            if (options.yAlignChar) {
              yAlignChar = options.yAlignChar;
            }
          },
        });
        if (width === "fill") {
          return rectText;
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
            rowHeight: 1,
            leftSlotRow: topLeftSlotRowMap.get(y),
            rightSlotRow: topRightSlotRowMap.get(y),
          });
          log += topSlotRowText;
        }
      }
      content_row: {
        const contentRowText = renderRow(row, {
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

const createContentCell = (
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
