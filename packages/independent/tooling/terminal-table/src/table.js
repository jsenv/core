/**
 *
 * https://github.com/Automattic/cli-table
 *
 *
 * remaining:
 *
 * - head/foot styles with a "real" example
 *
 * - color inheritance and priority
 *   une fonction pickColor(...borders)
 *   en fonction de nb de borders il pick.
 * Et on rangera les couleurs par prio, genre
 * [BLUE, GREEN, YELLOW, RED]
 *
 * - multiline
 *
 * - max line, max column (la dernier ligne/colonne afficheras "and 3 more...")
 *
 * - maxWidth (defaults to stdout.columns, will put ... at the end of the cell when it exceeds the remaining width
 *
 * - colspan/rowspan
 *
 * - test border style conflict (double -> single heavy)
 */

import { ANSI, humanizeFileSize } from "@jsenv/humanize";
import { measureTextWidth } from "@jsenv/terminal-text-size";
import {
  createBlankNode,
  createBorderBottomLeftNode,
  createBorderBottomNode,
  createBorderBottomRightNode,
  createBorderHalfDownNode,
  createBorderHalfLeftNode,
  createBorderHalfRightNode,
  createBorderHalfUpNode,
  createBorderLeftNode,
  createBorderMidBottomNode,
  createBorderMidLeftNode,
  createBorderMidNode,
  createBorderMidRightNode,
  createBorderMidTopNode,
  createBorderRightNode,
  createBorderTopLeftNode,
  createBorderTopNode,
  createBorderTopRightNode,
} from "./border_nodes.js";

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

const leftSlot = {
  type: "left",
  adapt: (cell) => {
    const { borderLeft } = cell;
    if (borderLeft) {
      return createBorderLeftNode(borderLeft);
    }
    return createBlankNode();
  },
};
const rightSlot = {
  type: "right",
  adapt: (cell) => {
    const { borderRight } = cell;
    if (borderRight) {
      return createBorderRightNode(borderRight);
    }
    return createBlankNode();
  },
};
const topSlot = {
  type: "top",
  adapt: (cell) => {
    const { borderTop } = cell;
    if (borderTop) {
      return createBorderTopNode(borderTop);
    }
    return createBlankNode();
  },
};
const bottomSlot = {
  type: "bottom",
  adapt: (cell) => {
    const { borderBottom } = cell;
    if (borderBottom) {
      return createBorderBottomNode(borderBottom);
    }
    return createBlankNode();
  },
};
const topLeftSlot = {
  type: "top_left",
  adapt: (cell) => {
    const { borderTop, borderLeft, westCell, northCell } = cell;
    if (!borderTop && !borderLeft) {
      return createBlankNode();
    }

    let northConnected =
      northCell && !northCell.borderBottom && northCell.borderLeft;
    let westConnected = westCell && westCell.borderTop && !westCell.borderRight;
    let northWestConnected = northConnected && westConnected;
    if (borderTop && borderLeft) {
      if (northWestConnected) {
        return createBorderMidNode(
          westCell.borderTop,
          northCell.borderLeft,
          borderTop,
          borderLeft,
        );
      }
      if (westConnected) {
        return createBorderMidTopNode(
          borderTop,
          borderLeft,
          westCell.borderTop,
        );
      }
      if (northConnected) {
        return createBorderMidLeftNode(
          northCell.borderLeft,
          borderTop,
          borderLeft,
        );
      }
      return createBorderTopLeftNode(borderTop, borderLeft);
    }
    if (borderLeft) {
      northConnected =
        northCell && (northCell.borderBottom || northCell.borderLeft);
      northWestConnected = northConnected && westConnected;
      if (northWestConnected) {
        return createBorderMidRightNode(
          northCell.borderLeft || northCell.westCell.borderRight,
          westCell.borderTop,
          borderLeft,
        );
      }
      if (westConnected) {
        return createBorderTopRightNode(westCell.borderTop, borderLeft);
      }
      if (northConnected) {
        return createBorderLeftNode(borderLeft);
      }
      return createBorderHalfDownNode(borderLeft);
    }
    // borderTop
    westConnected = westCell && (westCell.borderTop || westCell.borderRight);
    northWestConnected = northConnected && westConnected;
    if (northWestConnected) {
      return createBorderMidBottomNode(
        borderTop,
        northCell.borderLeft,
        westCell.borderTop || northCell.westCell.borderBottom,
      );
    }
    if (northConnected) {
      return createBorderBottomLeftNode(borderTop, northCell.borderLeft);
    }
    if (westConnected) {
      return createBorderTopNode(borderTop);
    }
    return createBorderHalfRightNode(borderTop);
  },
};
const topRightSlot = {
  type: "top_right",
  adapt: (cell) => {
    const { borderTop, borderRight, eastCell, northCell } = cell;
    if (!borderTop && !borderRight) {
      return createBlankNode();
    }

    let northConnected =
      northCell && !northCell.borderBottom && northCell.borderRight;
    let eastConnected = eastCell && eastCell.borderTop && !eastCell.borderLeft;
    let northEastConnected = northConnected && eastConnected;
    if (borderTop && borderRight) {
      if (northEastConnected) {
        return createBorderMidNode(
          borderTop,
          northCell.borderRight,
          eastCell.borderTop,
          borderRight,
        );
      }
      if (northConnected) {
        return createBorderMidRightNode(
          northCell.borderRight,
          borderTop,
          borderRight,
        );
      }
      if (eastConnected) {
        return createBorderMidTopNode(
          borderTop,
          borderRight,
          eastCell.borderTop,
        );
      }
      return createBorderTopRightNode(borderTop, borderRight);
    }
    if (borderRight) {
      northConnected =
        northCell && (northCell.borderBottom || northCell.borderRight);
      northEastConnected = northConnected && eastConnected;
      if (northEastConnected) {
        return createBorderMidLeftNode(
          northCell.borderRight || northCell.eastCell.borderLeft,
          eastCell.borderTop,
          borderRight,
        );
      }
      if (northConnected) {
        return createBorderRightNode(
          northCell.borderRight || northCell.borderBottom,
        );
      }
      if (eastConnected) {
        return createBorderTopLeftNode(eastCell.borderTop, borderRight);
      }
      return createBorderHalfDownNode(borderRight);
    }
    // borderTop
    eastConnected = eastCell && (eastCell.borderTop || eastCell.borderLeft);
    northEastConnected = northConnected && eastConnected;
    if (northEastConnected) {
      return createBorderMidBottomNode(
        borderTop,
        northCell.borderRight,
        eastCell.borderTop || eastCell.northCell.borderBottom,
      );
    }
    if (northConnected) {
      return createBorderBottomRightNode(borderTop, northCell.borderRight);
    }
    if (eastConnected) {
      return createBorderTopNode(borderTop);
    }
    return createBorderHalfLeftNode(borderTop);
  },
};
const bottomRightSlot = {
  type: "bottom_right",
  adapt: (cell) => {
    const { borderBottom, borderRight, eastCell, southCell } = cell;
    if (!borderBottom && !borderRight) {
      return createBlankNode();
    }

    let southConnected =
      southCell && !southCell.borderTop && southCell.borderRight;
    let eastConnected =
      eastCell && eastCell.borderBottom && !eastCell.borderLeft;
    let southEastConnected = southConnected && eastConnected;
    if (borderBottom && borderRight) {
      if (southEastConnected) {
        return createBorderMidNode(
          borderBottom,
          borderRight,
          eastCell.borderBottom,
          southCell.borderRight,
        );
      }
      if (eastConnected) {
        return createBorderMidBottomNode(
          borderBottom,
          borderRight,
          eastCell.borderBottom,
        );
      }
      if (southConnected) {
        return createBorderMidRightNode(
          borderRight,
          borderBottom,
          southCell.borderRight,
        );
      }
      return createBorderBottomRightNode(borderBottom, borderRight);
    }
    if (borderRight) {
      southConnected =
        southCell && (southCell.borderTop || southCell.borderRight);
      southEastConnected = southConnected && eastConnected;
      if (southEastConnected) {
        return createBorderMidTopNode(
          borderRight,
          southCell.borderTop || southCell.eastCell.borderBottom,
          eastCell.borderBottom,
        );
      }
      if (eastConnected) {
        return createBorderBottomLeftNode(eastCell.borderBottom, borderRight);
      }
      if (southConnected) {
        return createBorderRightNode(borderRight);
      }
      return createBorderHalfUpNode(borderRight);
    }
    // border bottom
    eastConnected = eastCell && (eastCell.borderBottom || eastCell.borderLeft);
    southEastConnected = southConnected && eastConnected;
    if (southEastConnected) {
      return createBorderMidTopNode(
        borderBottom,
        southCell.borderRight,
        eastCell.borderBottom || eastCell.southCell.borderTop,
      );
    }
    if (southConnected) {
      return createBorderTopRightNode(borderBottom, southCell.borderRight);
    }
    if (eastConnected) {
      return createBorderBottomNode(borderBottom);
    }
    return createBorderHalfLeftNode(borderBottom);
  },
};
const bottomLeftSlot = {
  type: "bottom_left",
  adapt: (cell) => {
    const { borderBottom, borderLeft, westCell, southCell } = cell;
    if (!borderBottom && !borderLeft) {
      return createBlankNode();
    }

    let southConnected =
      southCell && !southCell.borderTop && southCell.borderLeft;
    let westConnected =
      westCell && westCell.borderBottom && !westCell.borderRight;
    let southWestConnected = southConnected && westConnected;
    if (borderBottom && borderLeft) {
      if (southWestConnected) {
        return createBorderMidNode(
          westCell.borderBottom,
          borderLeft,
          borderBottom,
          southCell.borderLeft,
        );
      }
      if (southConnected) {
        return createBorderMidLeftNode(
          borderLeft,
          borderBottom,
          southCell.borderLeft,
        );
      }
      if (westConnected) {
        return createBorderMidBottomNode(
          borderBottom,
          borderLeft,
          westCell.borderBottom,
        );
      }
      return createBorderBottomLeftNode(borderBottom, borderLeft);
    }
    if (borderLeft) {
      southConnected =
        southCell && (southCell.borderTop || southCell.borderLeft);
      southWestConnected = southConnected && westConnected;
      if (southWestConnected) {
        return createBorderMidRightNode(
          borderLeft,
          southCell.borderTop || southCell.westCell.borderBottom,
          southCell.borderLeft || southCell.westCell.borderRight,
        );
      }
      if (westConnected) {
        return createBorderBottomRightNode(westCell.borderBottom, borderLeft);
      }
      if (southConnected) {
        return createBorderLeftNode(borderLeft);
      }
      return createBorderHalfUpNode(borderLeft);
    }
    // borderBottom
    westConnected = westCell && (westCell.borderBottom || westCell.borderRight);
    southWestConnected = southConnected && westConnected;
    if (southWestConnected) {
      return createBorderMidTopNode(
        westCell.borderBottom || southCell.borderTop,
        southCell.borderLeft,
        borderBottom,
      );
    }
    if (southConnected) {
      return createBorderTopLeftNode(borderBottom, southCell.borderLeft);
    }
    if (westConnected) {
      return createBorderBottomNode(borderBottom);
    }
    return createBorderHalfRightNode(borderBottom);
  },
};

export const renderTable = (
  inputGrid,
  { ansi, borderCollapse, borderSeparatedOnColorConflict } = {},
) => {
  if (!Array.isArray(inputGrid)) {
    throw new TypeError(`The first arg must be an array, got ${inputGrid}`);
  }
  if (inputGrid.length === 0) {
    return "";
  }

  const grid = [];
  const columnWithLeftSlotSet = new Set();
  const columnWithRightSlotSet = new Set();
  const rowHasTopSlot = (y) => topSlotRowMap.has(y);
  const rowHasBottomSlot = (y) => bottomSlotRowMap.has(y);
  const columnHasLeftSlot = (x) => columnWithLeftSlotSet.has(x);
  const columnHasRightSlot = (x) => columnWithRightSlotSet.has(x);
  const leftSlotRowMap = new Map();
  const rightSlotRowMap = new Map();
  const topSlotRowMap = new Map();
  const bottomSlotRowMap = new Map();
  // create cells and fill grid + detect borders
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
        const cell = createCell(props, { ansi, x, y });
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
        cell.borderLeft = borderLeft;
        if (borderLeft) {
          cell.borderLeft = borderLeft;
          onBorderLeft(x, y);
        }
        if (borderRight) {
          cell.borderRight = borderRight;
          onBorderRight(x, y);
        }
        if (borderTop) {
          cell.borderTop = borderTop;
          onBorderTop(x, y);
        }
        if (borderBottom) {
          cell.borderBottom = borderBottom;
          onBorderBottom(x, y);
        }

        cell.borderRight = borderRight;
        cell.borderTop = borderTop;
        cell.borderBottom = borderBottom;
        row[x] = cell;
        x++;
      }
      grid[y] = row;
      y++;
    }
  }

  // border collapse
  if (borderCollapse) {
    const canCollapse = (border, otherBorder) => {
      if (!borderSeparatedOnColorConflict) {
        return true;
      }
      if (border.color !== otherBorder.color) {
        return false;
      }
      return true;
    };

    // try to collapse top borders of this row with bottom borders of the previous row
    const tryToCollapseRowSlot = (y) => {
      const firstCellInThatRow = grid[y][0];
      let cellInThatRow = firstCellInThatRow;
      while (cellInThatRow) {
        const border = cellInThatRow.borderTop;
        if (!border) {
          cellInThatRow = cellInThatRow.eastCell;
          continue;
        }
        const otherBorder = cellInThatRow.northCell.borderBottom;
        if (!otherBorder) {
          cellInThatRow = cellInThatRow.eastCell;
          continue;
        }
        if (!canCollapse(border, otherBorder)) {
          return false;
        }
        cellInThatRow = cellInThatRow.eastCell;
      }
      for (const cell of grid[y - 1]) {
        cell.borderBottom = null;
      }
      bottomSlotRowMap.delete(y - 1);
      return true;
    };
    // try to collapse left borders of this column with right borders of the previous column
    const tryToCollapseColumnSlot = (x) => {
      const firstCellInThatColumn = grid[0][x];
      let cellInThatColumn = firstCellInThatColumn;
      while (cellInThatColumn) {
        const border = cellInThatColumn.borderLeft;
        if (!border) {
          cellInThatColumn = cellInThatColumn.southCell;
          continue;
        }
        const otherBorder = cellInThatColumn.westCell.borderRight;
        if (!otherBorder) {
          cellInThatColumn = cellInThatColumn.southCell;
          continue;
        }
        if (!canCollapse(border, otherBorder)) {
          return false;
        }
        cellInThatColumn = cellInThatColumn.southCell;
      }
      let y = 0;
      while (y < grid.length) {
        const rightSlotRow = rightSlotRowMap.get(y);
        rightSlotRow[x - 1] = undefined;
        grid[y][x - 1].borderRight = null;
        y++;
      }
      columnWithRightSlotSet.delete(x);
      return true;
    };

    {
      let y = 0;
      while (y < grid.length) {
        if (rowHasBottomSlot(y) && rowHasTopSlot(y + 1)) {
          tryToCollapseRowSlot(y + 1);
        }
        let x = 0;
        const row = grid[y];
        while (x < row.length) {
          if (columnHasRightSlot(x) && columnHasLeftSlot(x + 1)) {
            tryToCollapseColumnSlot(x + 1);
          }
          x++;
        }
        y++;
      }
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
          const node = slot.adapt(cell);
          return node;
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
          if (typeof render === "function") {
            rect.render = (...args) => {
              const text = render(...args);
              return " ".repeat(leftSpacing) + text + " ".repeat(rightSpacing);
            };
          } else {
            rect.render =
              " ".repeat(leftSpacing) + render + " ".repeat(rightSpacing);
          }
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
        xAlign,
        xPadChar = " ",
        yAlign,
        yPadChar = " ",
        rects,
        color,
        bold,
        backgroundColor,
      } = node;

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

        if (lineIndex < lineStartIndex) {
          if (Array.isArray(yPadChar)) {
            yPadChar = yPadChar[0];
          }
        } else if (lineIndex < lineEndIndex) {
          rect = rects[lineIndex];
        } else if (Array.isArray(yPadChar)) {
          yPadChar = yPadChar[1];
        }
      } else {
        const lineStartIndex = rowHeight - nodeHeight;
        if (lineIndex >= lineStartIndex) {
          rect = rects[lineIndex];
        }
      }

      const applyStyles = (text) => {
        if (!ansi) {
          return text;
        }
        let textWithStyles = text;

        text_bold: {
          if (typeof bold === "function") {
            bold = bold(cell, { columnWidth });
          }
          if (bold) {
            textWithStyles = ANSI.effect(textWithStyles, ANSI.BOLD);
          }
        }
        text_color: {
          if (typeof color === "function") {
            color = color(cell, { columnWidth });
          }
          if (color) {
            textWithStyles = ANSI.color(textWithStyles, color);
          }
        }
        background_color: {
          if (typeof backgroundColor === "function") {
            backgroundColor = backgroundColor(cell, { columnWidth });
          }
          if (backgroundColor) {
            textWithStyles = ANSI.backgroundColor(
              textWithStyles,
              backgroundColor,
            );
          }
        }
        return textWithStyles;
      };

      if (rect) {
        let { width, render } = rect;
        let rectText;
        if (typeof render === "function") {
          rectText = render({
            cell,
            columnWidth,
          });
        } else {
          rectText = render;
        }
        if (width === "fill") {
          return applyStyles(rectText);
        }
        return applyStyles(
          applyXAlign(rectText, {
            width,
            desiredWidth: columnWidth,
            align: xAlign,
            padChar: xPadChar,
          }),
        );
      }
      return applyStyles(
        applyXAlign(yPadChar, {
          width: 1,
          desiredWidth: columnWidth,
          align: xAlign,
          padChar: " ",
        }),
      );
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

const applyXAlign = (text, { width, desiredWidth, align, padChar }) => {
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
    return text + padChar.repeat(missingWidth);
  }
  if (align === "center") {
    const leftSpacing = Math.floor(missingWidth / 2);
    const rightSpacing = missingWidth - leftSpacing;
    let padStartChar = padChar;
    let padEndChar = padChar;
    if (Array.isArray(padChar)) {
      padStartChar = padChar[0];
      padEndChar = padChar[1];
    }
    return (
      padStartChar.repeat(leftSpacing) + text + padEndChar.repeat(rightSpacing)
    );
  }
  // "end"
  return padChar.repeat(missingWidth) + text;
};

const createCell = (
  {
    value,
    color,
    backgroundColor,
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
  { ansi, x, y },
) => {
  let text = format === "size" ? humanizeFileSize(value) : String(value);
  const lines = text.split("\n");
  let lineIndex = 0;
  const rects = [];
  for (const line of lines) {
    const isLastLine = lineIndex === lines.length - 1;
    let lineWidth = measureTextWidth(line);
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
      render: () => {
        return lineText;
      },
    });
    lineIndex++;
  }

  const cell = {
    type: "content",
    value,
    xAlign,
    yAlign,
    leftSpacing,
    rightSpacing,
    topSpacing,
    bottomSpacing,
    color,
    backgroundColor,
    bold,
    rects,
    x,
    y,
  };
  return cell;
};
