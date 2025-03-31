/**
 *
 * https://github.com/Automattic/cli-table
 *
 *
 * remaining:
 *
 * - multiline
 *
 * - max rows, max columns (sur la table) (la dernier ligne/colonne afficheras "and 3 more...")
 *
 * - maxWidth/maxHeight sur la cell (+une option cellMaxWidth, cellMaxHeight sur la table)
 *
 * - maxWidth on the table (defaults to stdout.columns, will put ... at the end of the cell when it exceeds the remaining width
 *
 * - colspan/rowspan
 *
 * - test border style conflict (double -> single heavy)
 *
 * - une option corner borders only (c'est relativement joli genre)
 * ┌       ┐┌       ┐┌         ┐
 *   Name     Price    Texture
 * └       ┘└       ┘└         ┘
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
  {
    ansi,
    borderCollapse,
    borderSeparatedOnColorConflict,
    borderSpacing = 0,
  } = {},
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
    const getHowToCollapseBorders = (borderToCollapse, intoBorder) => {
      if (
        borderSeparatedOnColorConflict &&
        borderToCollapse.color !== intoBorder.color
      ) {
        return null;
      }
      return () => {
        const collapsedBorder = { ...intoBorder };
        if (!intoBorder.style && borderToCollapse.style) {
          collapsedBorder.style = borderToCollapse.style;
        }
        if (!intoBorder.color && borderToCollapse.color) {
          collapsedBorder.color = borderToCollapse.color;
        }
        return collapsedBorder;
      };
    };

    const collapsePreviousRowBottomBorders = (y) => {
      const firstCellInThatRow = grid[y][0];
      let cellInThatRow = firstCellInThatRow;
      const collapseCallbackSet = new Set();
      while (cellInThatRow) {
        const borderTop = cellInThatRow.borderTop;
        if (!borderTop) {
          return false;
        }
        const northCell = cellInThatRow.northCell;
        const northCellBorderBottom = northCell.borderBottom;
        if (!northCellBorderBottom) {
          cellInThatRow = cellInThatRow.eastCell;
          continue;
        }
        const collapseBorders = getHowToCollapseBorders(
          northCellBorderBottom,
          borderTop,
        );
        if (!collapseBorders) {
          return false;
        }
        const cell = cellInThatRow;
        collapseCallbackSet.add(() => {
          cell.borderTop = collapseBorders();
          northCell.borderBottom = null;
        });
        cellInThatRow = cellInThatRow.eastCell;
      }
      for (const collapseCallback of collapseCallbackSet) {
        collapseCallback();
      }
      bottomSlotRowMap.delete(y - 1);
      return true;
    };
    const collapseTopBorders = (y) => {
      const firstCellInThatRow = grid[y][0];
      let cellInThatRow = firstCellInThatRow;
      const collapseCallbackSet = new Set();
      while (cellInThatRow) {
        const borderTop = cellInThatRow.borderTop;
        if (!borderTop) {
          cellInThatRow = cellInThatRow.eastCell;
          continue;
        }
        const northCell = cellInThatRow.northCell;
        const northCellBorderBottom = northCell.borderBottom;
        if (!northCellBorderBottom) {
          return false;
        }
        const collapseBorders = getHowToCollapseBorders(
          borderTop,
          northCellBorderBottom,
        );
        if (!collapseBorders) {
          return false;
        }
        const cell = cellInThatRow;
        collapseCallbackSet.add(() => {
          northCell.borderBottom = collapseBorders();
          cell.borderTop = null;
        });
        cellInThatRow = cellInThatRow.eastCell;
      }
      for (const collapseCallback of collapseCallbackSet) {
        collapseCallback();
      }
      topSlotRowMap.delete(y);
      return true;
    };
    const collapsePreviousColumnRightBorders = (x) => {
      const firstCellInThatColumn = grid[0][x];
      let cellInThatColumn = firstCellInThatColumn;
      const collapseCallbackSet = new Set();
      while (cellInThatColumn) {
        const border = cellInThatColumn.borderLeft;
        if (!border) {
          return false;
        }
        const westCell = cellInThatColumn.westCell;
        const westCellBorderRight = westCell.borderRight;
        if (!westCellBorderRight) {
          cellInThatColumn = cellInThatColumn.southCell;
          continue;
        }
        const collapseBorders = getHowToCollapseBorders(
          westCellBorderRight,
          border,
        );
        if (!collapseBorders) {
          return false;
        }
        const cell = cellInThatColumn;
        collapseCallbackSet.add(() => {
          cell.borderLeft = collapseBorders();
          westCell.borderRight = null;
        });
        cellInThatColumn = cellInThatColumn.southCell;
      }
      for (const collapseCallback of collapseCallbackSet) {
        collapseCallback();
      }
      let y = 0;
      while (y < grid.length) {
        const rightSlotRow = rightSlotRowMap.get(y);
        if (rightSlotRow) {
          rightSlotRow[x - 1] = undefined;
        }
        y++;
      }
      columnWithRightSlotSet.delete(x - 1);
      return true;
    };
    const collapseLeftBorders = (x) => {
      const firstCellInThatColumn = grid[0][x];
      let cellInThatColumn = firstCellInThatColumn;
      const collapseCallbackSet = new Set();
      while (cellInThatColumn) {
        const border = cellInThatColumn.borderLeft;
        if (!border) {
          cellInThatColumn = cellInThatColumn.southCell;
          continue;
        }
        const westCell = cellInThatColumn.westCell;
        const otherBorder = westCell.borderRight;
        if (!otherBorder) {
          return false;
        }
        const collapseBorders = getHowToCollapseBorders(border, otherBorder);
        if (!collapseBorders) {
          return false;
        }
        const cell = cellInThatColumn;
        collapseCallbackSet.add(() => {
          westCell.borderRight = collapseBorders();
          cell.borderLeft = null;
        });
        cellInThatColumn = cellInThatColumn.southCell;
      }
      for (const collapseCallback of collapseCallbackSet) {
        collapseCallback();
      }
      let y = 0;
      while (y < grid.length) {
        const leftSlotRow = leftSlotRowMap.get(y);
        if (leftSlotRow) {
          leftSlotRow[x] = undefined;
        }
        y++;
      }
      columnWithLeftSlotSet.delete(x);
      return true;
    };

    {
      let y = 0;
      while (y < grid.length) {
        let x = 0;
        const row = grid[y];
        while (x < row.length) {
          if (
            x !== row.length - 1 &&
            columnHasRightSlot(x) &&
            columnHasLeftSlot(x + 1)
          ) {
            collapsePreviousColumnRightBorders(x + 1);
          }
          if (x > 0 && columnHasLeftSlot(x) && columnHasRightSlot(x - 1)) {
            collapseLeftBorders(x);
          }
          x++;
        }
        if (
          y !== grid.length - 1 &&
          rowHasBottomSlot(y) &&
          rowHasTopSlot(y + 1)
        ) {
          collapsePreviousRowBottomBorders(y + 1);
        }
        if (y > 0 && rowHasTopSlot(y) && rowHasBottomSlot(y - 1)) {
          collapseTopBorders(y);
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
        const options = { borderSpacing };
        const adapt = (slot) => {
          const node = slot.adapt(cell, options);
          if (borderSpacing && node.type !== "blank") {
            if (slot.type === "top_left") {
              if (!cell.northCell || !cell.northCell.borderBottom) {
                node.spacingTop = borderSpacing;
              }
              if (!cell.westCell || !cell.westCell.borderRight) {
                node.spacingLeft = borderSpacing;
              }
            }
            if (slot.type === "top_right") {
              if (!cell.northCell || !cell.northCell.borderBottom) {
                node.spacingTop = borderSpacing;
              }
              node.spacingRight = borderSpacing;
            }
            if (slot.type === "bottom_left") {
              node.spacingBottom = borderSpacing;
              if (!cell.westCell || !cell.westCell.borderRight) {
                node.spacingLeft = borderSpacing;
              }
            }
            if (slot.type === "bottom_right") {
              node.spacingBottom = borderSpacing;
              node.spacingRight = borderSpacing;
            }
          }
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
  const leftColumnWidthMap = new Map();
  const rightColumnWidthMap = new Map();
  const topRowHeightMap = new Map();
  const bottomRowHeightMap = new Map();
  {
    const measureNode = (node) => {
      const {
        rects,
        spacing = 0,
        spacingLeft = spacing,
        spacingRight = spacing,
        spacingTop = spacing,
        spacingBottom = spacing,
      } = node;
      let nodeWidth = -1;
      for (const rect of rects) {
        let { width } = rect;
        if (width === "fill") {
          continue;
        }
        if (spacingLeft || spacingRight) {
          width += spacingLeft + spacingRight;
          rect.width = width;
          const { render } = rect;
          if (typeof render === "function") {
            rect.render = (...args) => {
              const text = render(...args);
              return " ".repeat(spacingLeft) + text + " ".repeat(spacingRight);
            };
          } else {
            rect.render =
              " ".repeat(spacingLeft) + render + " ".repeat(spacingRight);
          }
        }
        if (width > nodeWidth) {
          nodeWidth = width;
        }
      }
      if (spacingTop) {
        let lineToInsertAbove = spacingTop;
        while (lineToInsertAbove--) {
          rects.unshift({
            width: "fill",
            render: ({ columnWidth }) => " ".repeat(columnWidth),
          });
        }
      }
      if (spacingBottom) {
        let lineToInsertBelow = spacingBottom;
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
      const topSlotRow = topSlotRowMap.get(y);
      const bottomSlotRow = bottomSlotRowMap.get(y);
      const leftSlotRow = leftSlotRowMap.get(y);
      const rightSlotRow = rightSlotRowMap.get(y);
      const topLeftSlotRow = topLeftSlotRowMap.get(y);
      const topRightSlotRow = topRightSlotRowMap.get(y);
      const bottomLeftSlotRow = bottomLeftSlotRowMap.get(y);
      const bottomRightSlotRow = bottomRightSlotRowMap.get(y);
      let x = 0;
      for (const cell of line) {
        if (topSlotRow) {
          const topSlot = topSlotRow[x];
          if (topSlot) {
            const [, topNodeHeight] = measureNode(topSlot);
            const topRowHeight = topRowHeightMap.get(y) || -1;
            if (topNodeHeight > topRowHeight) {
              topRowHeightMap.set(y, topNodeHeight);
            }
          }
        }
        if (bottomSlotRow) {
          const bottomSlot = bottomSlotRow[x];
          if (bottomSlot) {
            const [, bottomNodeHeight] = measureNode(bottomSlot);
            const bottomRowHeight = bottomRowHeightMap.get(y) || -1;
            if (bottomNodeHeight > bottomRowHeight) {
              bottomRowHeightMap.set(y, bottomNodeHeight);
            }
          }
        }
        if (leftSlotRow) {
          const leftSlot = leftSlotRow[x];
          if (leftSlot) {
            const [leftNodeWidth] = measureNode(leftSlot);
            const leftColumnWidth = leftColumnWidthMap.get(x) || -1;
            if (leftNodeWidth > leftColumnWidth) {
              leftColumnWidthMap.set(x, leftNodeWidth);
            }
          }
        }
        if (rightSlotRow) {
          const rightSlot = rightSlotRow[x];
          if (rightSlot) {
            const [rightNodeWidth] = measureNode(rightSlot);
            const rightColumnWidth = rightColumnWidthMap.get(x) || -1;
            if (rightNodeWidth > rightColumnWidth) {
              rightColumnWidthMap.set(x, rightNodeWidth);
            }
          }
        }
        if (topLeftSlotRow) {
          const topLeftSlot = topLeftSlotRow[x];
          if (topLeftSlot) {
            const [topLeftNodeWidth, topLeftNodeHeight] =
              measureNode(topLeftSlot);
            const leftColumnWidth = leftColumnWidthMap.get(x) || -1;
            if (topLeftNodeWidth > leftColumnWidth) {
              leftColumnWidthMap.set(x, topLeftNodeWidth);
            }
            const topRowHeight = topRowHeightMap.get(y) || -1;
            if (topLeftNodeHeight > topRowHeight) {
              topRowHeightMap.set(y, topLeftNodeHeight);
            }
          }
        }
        if (topRightSlotRow) {
          const topRightSlot = topRightSlotRow[x];
          if (topRightSlot) {
            const [topRightNodeWidth, topRightNodeHeight] =
              measureNode(topRightSlot);
            const rightColumnWidth = rightColumnWidthMap.get(x) || -1;
            if (topRightNodeWidth > rightColumnWidth) {
              rightColumnWidthMap.set(x, topRightNodeWidth);
            }
            const topRowHeight = topRowHeightMap.get(y) || -1;
            if (topRightNodeHeight > topRowHeight) {
              topRowHeightMap.set(y, topRightNodeHeight);
            }
          }
        }
        if (bottomLeftSlotRow) {
          const bottomLeftSlot = bottomLeftSlotRow[x];
          if (bottomLeftSlot) {
            const [bottomLeftNodeWidth, bottomLeftNodeHeight] =
              measureNode(bottomLeftSlot);
            const leftColumnWidth = leftColumnWidthMap.get(x) || -1;
            if (bottomLeftNodeWidth > leftColumnWidth) {
              leftColumnWidthMap.set(x, bottomLeftNodeWidth);
            }
            const bottomRowHeight = bottomRowHeightMap.get(y) || -1;
            if (bottomLeftNodeHeight > bottomRowHeight) {
              bottomRowHeightMap.set(y, bottomLeftNodeHeight);
            }
          }
        }
        if (bottomRightSlotRow) {
          const bottomRightSlot = bottomRightSlotRow[x];
          if (bottomRightSlot) {
            const [bottomRightNodeWidth, bottomRightNodeHeight] =
              measureNode(bottomRightSlot);
            const rightColumnWidth = rightColumnWidthMap.get(x) || -1;
            if (bottomRightNodeWidth > rightColumnWidth) {
              rightColumnWidthMap.set(x, bottomRightNodeWidth);
            }
            const bottomRowHeight = bottomRowHeightMap.get(y) || -1;
            if (bottomRightNodeHeight > bottomRowHeight) {
              bottomRowHeightMap.set(y, bottomRightNodeHeight);
            }
          }
        }

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
                columnWidth: leftColumnWidthMap.get(x),
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
                columnWidth: rightColumnWidthMap.get(x),
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
          const rectIndex = lineIndex - lineStartIndex;
          rect = rects[rectIndex];
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
            rowHeight: topRowHeightMap.get(y),
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
            rowHeight: bottomRowHeightMap.get(y),
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
    const widthMissingLeft = Math.floor(missingWidth / 2);
    const widthMissingRight = missingWidth - widthMissingLeft;
    let padStartChar = padChar;
    let padEndChar = padChar;
    if (Array.isArray(padChar)) {
      padStartChar = padChar[0];
      padEndChar = padChar[1];
    }
    return (
      padStartChar.repeat(widthMissingLeft) +
      text +
      padEndChar.repeat(widthMissingRight)
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
    spacing = 0,
    spacingLeft = spacing || 1,
    spacingRight = spacing || 1,
    spacingTop = spacing,
    spacingBottom = spacing,
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
    spacingLeft,
    spacingRight,
    spacingTop,
    spacingBottom,
    color,
    backgroundColor,
    bold,
    rects,
    x,
    y,
  };
  return cell;
};
