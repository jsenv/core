/**
 *
 * https://www.w3schools.com/charsets/ref_utf_box.asp
 * https://github.com/Automattic/cli-table
 *
 * OK UN TRUC: les corners sont pas adapté ou plutot on réutilise
 * les left/right au lieu d'avoir des slots dédiés
 * il faut en gros stocker les corners dans un truc a part et les render a part
 *
 * remaining:
 * border collapse on advanced scenario
 * border color conflicts
 * ability to control border chars
 * multiline (for later)
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
    yAlignChar: "|",
    rects: [{ width: 1, render: () => "|" }],
  };
  const borderRightCell = {
    type: "border_right",
    xAlign: "start",
    yAlignChar: "|",
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
  const borderTopLeftHalfCell = {
    type: "border_top_left_half",
    xAlign: "end",
    yAlign: "end",
    rects: [{ width: 1, render: () => "╷" }],
  };
  const borderTopRightHalfCell = {
    type: "border_top_right_half",
    xAlign: "start",
    yAlign: "end",
    rects: [{ width: 1, render: () => "╷" }],
  };
  const borderBottomRightHalfCell = {
    type: "border_bottom_right_half",
    xAlign: "start",
    yAlign: "start",
    rects: [{ width: 1, render: () => "╵" }],
  };
  const borderBottomLeftHalfCell = {
    type: "border_bottom_left_half",
    xAlign: "end",
    yAlign: "start",
    rects: [{ width: 1, render: () => "╵" }],
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
    border_top_left_half: borderTopLeftHalfCell,
    border_top_right_half: borderTopRightHalfCell,
    border_bottom_left_half: borderBottomLeftHalfCell,
    border_bottom_right_half: borderBottomRightHalfCell,
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
  adapt: ({ cell, westCell }) => {
    if (cell.borderTop) {
      return SLOT_CONTENT_TYPES.border_top_left;
    }
    if (westCell && westCell.borderTop && !westCell.borderRight) {
      return SLOT_CONTENT_TYPES.border_top_right;
    }
    if (cell.borderLeft) {
      return SLOT_CONTENT_TYPES.border_left_half;
    }
    return SLOT_CONTENT_TYPES.blank;
  },
};
const topRightSlot = {
  type: "top_right",
  adapt: ({ cell, eastCell }) => {
    if (cell.borderTop) {
      return SLOT_CONTENT_TYPES.border_top_right;
    }
    if (eastCell && eastCell.borderTop && !eastCell.borderLeft) {
      return SLOT_CONTENT_TYPES.border_top_left;
    }
    if (cell.borderRight) {
      return SLOT_CONTENT_TYPES.border_right_half;
    }
    return SLOT_CONTENT_TYPES.blank;
  },
};
const bottomRightSlot = {
  type: "bottom_right",
  adapt: ({ cell, eastCell }) => {
    if (cell.borderBottom) {
      return SLOT_CONTENT_TYPES.border_bottom_right;
    }
    if (eastCell && eastCell.borderBottom && !eastCell.borderLeft) {
      return SLOT_CONTENT_TYPES.border_bottom_left;
    }
    if (cell.borderRight) {
      return SLOT_CONTENT_TYPES.border_right_half;
    }
    return SLOT_CONTENT_TYPES.blank;
  },
};
const bottomLeftSlot = {
  type: "bottom_left",
  adapt: ({ cell, westCell }) => {
    if (cell.borderBottom) {
      return SLOT_CONTENT_TYPES.border_bottom_right;
    }
    if (westCell && westCell.borderBottom && !westCell.borderRight) {
      return SLOT_CONTENT_TYPES.border_bottom_left;
    }
    if (cell.borderLeft) {
      return SLOT_CONTENT_TYPES.border_left_half;
    }
    return SLOT_CONTENT_TYPES.blank;
  },
};

export const renderTable = (inputGrid, { ansi = true } = {}) => {
  const grid = [];

  const leftSlotRowMap = new Map();
  const rightSlotRowMap = new Map();
  const topSlotRowMap = new Map();
  const bottomSlotRowMap = new Map();
  const onBorderLeft = (x, y) => {
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
  // detect borders
  {
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
        if (topSlotRow && leftSlotRow) {
          topLeftSlotRow[x] = topLeftSlot;
        }
        if (topSlotRow && rightSlotRow) {
          topRightSlotRow[x] = topRightSlot;
        }
        if (bottomSlotRow && leftSlotRow) {
          bottomLeftSlotRow[x] = bottomLeftSlot;
        }
        if (bottomSlotRow && rightSlotRow) {
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
  // fill holes in slot rows
  {
    let y = 0;
    while (y < grid.length) {
      const letSlotRow = leftSlotRowMap.get(y);
      const rightSlotRow = rightSlotRowMap.get(y);
      const topSlotRow = topSlotRowMap.get(y);
      const bottomSlotRow = bottomSlotRowMap.get(y);
      let x = 0;
      while (x < grid[y].length) {
        if (letSlotRow && !letSlotRow[x]) {
          letSlotRow[x] = leftSlot;
        }
        if (rightSlotRow && !rightSlotRow[x]) {
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
  // transform slots into what they should be (border or blank)
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

        if (leftSlotRow) {
          const leftSlot = leftSlotRow[x];
          const leftSlotContent = leftSlot.adapt({
            cell,
            westCell,
            eastCell,
            northCell,
            southCell,
          });
          leftSlot.content = leftSlotContent;
        }
        if (rightSlotRow) {
          const rightSlot = rightSlotRow[y];
          const rightSlotContent = rightSlot.adapt({
            cell,
            westCell,
            eastCell,
            northCell,
            southCell,
          });
          rightSlot.content = rightSlotContent;
        }
        if (topSlotRow) {
          const topSlot = topSlotRow[x];
          const topSlotContent = topSlot.adapt({
            cell,
            westCell,
            eastCell,
            northCell,
            southCell,
          });
          topSlot.content = topSlotContent;
        }
        if (bottomSlotRow) {
          const bottomSlot = bottomSlotRow[x];
          const bottomSlotContent = bottomSlot.adapt({
            cell,
            westCell,
            eastCell,
            northCell,
            southCell,
          });
          bottomSlot.content = bottomSlotContent;
        }
        // corners
        if (topLeftSlotRow) {
          const topLeftSlot = topLeftSlotRow[x];
          const topLeftSlotContent = topLeftSlot.adapt({
            cell,
            westCell,
            eastCell,
            northCell,
            southCell,
          });
          topLeftSlot.content = topLeftSlotContent;
        }
        if (topRightSlotRow) {
          const topRightSlot = topRightSlotRow[x];
          const topRightSlotContent = topRightSlot.adapt({
            cell,
            westCell,
            eastCell,
            northCell,
            southCell,
          });
          topRightSlot.content = topRightSlotContent;
        }
        if (bottomRightSlotRow) {
          const bottomRightSlot = bottomRightSlotRow[x];
          const bottomRightSlotContent = bottomRightSlot.adapt({
            cell,
            westCell,
            eastCell,
            northCell,
            southCell,
          });
          bottomRightSlot.content = bottomRightSlotContent;
        }
        if (bottomLeftSlotRow) {
          const bottomLeftSlot = bottomLeftSlotRow[x];
          const bottomLeftSlotContent = bottomLeftSlot.adapt({
            cell,
            westCell,
            eastCell,
            northCell,
            southCell,
          });
          bottomLeftSlot.content = bottomLeftSlotContent;
        }
        x++;
      }
      y++;
    }
  }
  // // collapse left and right borders
  // {
  //   // if every right border can collapse with the left border next to it
  //   // then we collapse all right borders of the column
  //   const getHowToCollapseAdjacentCells = (leftCell, rightCell) => {
  //     if (isBlankCell(leftCell)) {
  //       return [
  //         // left cell becomes right cell
  //         rightCell,
  //         // right cell becomes blank (it's redundant)
  //         blankCell,
  //       ];
  //     }
  //     if (isBlankCell(rightCell)) {
  //       // keep as it is
  //       return [leftCell, rightCell];
  //     }
  //     if (isBorderTopRight(leftCell) && isBorderTopLeft(rightCell)) {
  //       return [
  //         createTopMidBorderCell({ color: leftCell.color }),
  //         blankCell, // merged into the left cell
  //       ];
  //     }
  //     if (isBorderBottomRight(leftCell) && isBorderBottomLeft(rightCell)) {
  //       return [
  //         createBottomMidBorderCell({ color: leftCell.color }),
  //         blankCell, // merged into the left cell
  //       ];
  //     }
  //     if (isBorderRight(leftCell) && isBorderLeft(rightCell)) {
  //       return [
  //         leftCell,
  //         blankCell, // merged into the left cell
  //       ];
  //     }

  //     return null;
  //   };

  //   let x = 2;
  //   const columnCount = grid[0].length;
  //   while (x < columnCount - 1) {
  //     let hasConlict;
  //     let y = 0;
  //     const collapseInfoSet = new Set();
  //     while (y < grid.length) {
  //       const columnCell = grid[y][x];
  //       const eastColumnCell = grid[y][x + 1];
  //       const howToCollapseCells = getHowToCollapseAdjacentCells(
  //         columnCell,
  //         eastColumnCell,
  //         x,
  //         y,
  //       );
  //       if (!howToCollapseCells) {
  //         hasConlict = true;
  //         break;
  //       }
  //       collapseInfoSet.add({ x, y, howToCollapseCells });
  //       y++;
  //     }
  //     if (!hasConlict) {
  //       for (const collapseInfo of collapseInfoSet) {
  //         const { x, y, howToCollapseCells } = collapseInfo;
  //         const collapsedCells = Array.isArray(howToCollapseCells)
  //           ? howToCollapseCells
  //           : howToCollapseCells();
  //         const [leftCollapsed, rightCollapsed] = collapsedCells;
  //         grid[y][x] = leftCollapsed;
  //         grid[y][x + 1] = rightCollapsed;
  //       }
  //     }
  //     x += 3;
  //   }
  // }
  // // collapse top and bottom borders
  // {
  //   const getHowToCollapseAdjacentCells = (cell, cellBelow, x, y) => {
  //     if (
  //       isBorderBottom(cell) &&
  //       x % 3 === 0 && // there is a bottom left every 3 column
  //       y <= grid.length - 2 &&
  //       isBlankCell(grid[y + 1][x]) &&
  //       isBorderLeft(grid[y + 2][x]) // south south cell is a border left
  //     ) {
  //       return [createTopLeftBorderCell(), cellBelow];
  //     }
  //     if (
  //       isBorderTop(cellBelow) &&
  //       x % 3 === 0 &&
  //       y > 1 &&
  //       isBorderLeft(grid[y - 1][x]) // north cell is a border left
  //     ) {
  //       return [createBottomLeftBorderCell(), cell];
  //     }
  //     if (isBlankCell(cell)) {
  //       return [
  //         cellBelow, // cell becomes cell below
  //         blankCell, // cell below becomes blank
  //       ];
  //     }
  //     if (isBlankCell(cellBelow)) {
  //       return [
  //         // keep both as is
  //         cell,
  //         cellBelow,
  //       ];
  //     }
  //     if (isBorderTopRight(cell) && isBorderTopLeft(cellBelow)) {
  //       return [
  //         createTopMidBorderCell({ color: cell.color }),
  //         blankCell, // merged into the top cell
  //       ];
  //     }
  //     if (isBorderBottomRight(cell) && isBorderBottomLeft(cellBelow)) {
  //       return [
  //         createBottomMidBorderCell({ color: cell.color }),
  //         blankCell, // merged into the cell
  //       ];
  //     }
  //     if (isBorderBottomLeft(cell) && isBorderTopLeft(cellBelow)) {
  //       return [
  //         createLeftMidBorderCell({ color: cell.color }),
  //         blankCell, // merged into the cell
  //       ];
  //     }
  //     if (isBorderBottomRight(cell) && isBorderTopRight(cellBelow)) {
  //       return [
  //         createRightMidBorderCell({ color: cell.color }),
  //         blankCell, // merged into the cell
  //       ];
  //     }
  //     if (isBorderBottomRight(cell) && isBorderTop(cellBelow)) {
  //       return [
  //         cell,
  //         blankCell, // merged into the cell
  //       ];
  //     }
  //     if (isBorderBottom(cell) && isBorderTopLeft(cellBelow)) {
  //       return [
  //         cellBelow,
  //         blankCell, // merged into the top cell
  //       ];
  //     }
  //     if (isBorderBottom(cell) && isBorderTop(cellBelow)) {
  //       return [
  //         cell,
  //         blankCell, // merged into the top cell
  //       ];
  //     }
  //     return null;
  //   };

  //   let y = 2;
  //   const lineCount = grid.length;
  //   while (y < lineCount - 1) {
  //     let hasConflict;
  //     let x = 0;
  //     const line = grid[y];
  //     const lineBelow = grid[y + 1];
  //     const collapseInfoSet = new Set();
  //     while (x < line.length) {
  //       const cell = line[x];
  //       const cellBelow = lineBelow[x];
  //       const howToCollapseCells = getHowToCollapseAdjacentCells(
  //         cell,
  //         cellBelow,
  //         x,
  //         y,
  //       );
  //       if (!howToCollapseCells) {
  //         hasConflict = true;
  //         break;
  //       }
  //       collapseInfoSet.add({ x, y, howToCollapseCells });
  //       x++;
  //     }
  //     if (!hasConflict) {
  //       for (const collapseInfo of collapseInfoSet) {
  //         const { x, y, howToCollapseCells } = collapseInfo;
  //         const collapsedCells = Array.isArray(howToCollapseCells)
  //           ? howToCollapseCells
  //           : howToCollapseCells();
  //         const [cellCollapsed, cellBelowCollapsed] = collapsedCells;
  //         grid[y][x] = cellCollapsed;
  //         grid[y + 1][x] = cellBelowCollapsed;
  //       }
  //     }
  //     y += 3;
  //   }
  // }
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
    const renderRow = (cells, { rowHeight, leftSlowRow, rightSlotRow }) => {
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
          if (leftSlowRow) {
            leftSlotLineText = renderCell(leftSlowRow[x], {
              columnWidth: 1,
              rowHeight,
              lineIndex,
            });
          }
          if (rightSlotRow) {
            rightSlotLineText = renderCell(rightSlotRow[y], {
              columnWidth: 1,
              rowHeight,
              lineIndex,
            });
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
      if (cell.type !== "content") {
        cell = cell.content; // for now this is how we interact with slots
      }

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
        if (lineIndex > lineStartIndex && lineIndex < lineEndIndex) {
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
