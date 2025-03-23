/**
 *
 * https://www.w3schools.com/charsets/ref_utf_box.asp
 * https://github.com/Automattic/cli-table
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
// const topLeftSlot = {
//   type: "top_left",
//   adapt: ({ cell, westCell }) => {
//     if (cell.borderTop) {
//       return SLOT_CONTENT_TYPES.border_top_left;
//     }
//     if (westCell && westCell.borderTop && !westCell.borderRight) {
//       return SLOT_CONTENT_TYPES.border_top_right;
//     }
//     if (cell.borderLeft) {
//       return SLOT_CONTENT_TYPES.border_left_half;
//     }
//     return SLOT_CONTENT_TYPES.blank;
//   },
// };
// const topRightSlot = {
//   type: "top_right",
//   adapt: ({ cell, eastCell }) => {
//     if (cell.borderTop) {
//       return SLOT_CONTENT_TYPES.border_top_right;
//     }
//     if (eastCell && eastCell.borderTop && !eastCell.borderLeft) {
//       return SLOT_CONTENT_TYPES.border_top_left;
//     }
//     if (cell.borderRight) {
//       return SLOT_CONTENT_TYPES.border_right_half;
//     }
//     return SLOT_CONTENT_TYPES.blank;
//   },
// };
// const bottomRightSlot = {
//   type: "bottom_right",
//   adapt: ({ cell, eastCell }) => {
//     if (cell.borderBottom) {
//       return SLOT_CONTENT_TYPES.border_bottom_right;
//     }
//     if (eastCell && eastCell.borderBottom && !eastCell.borderLeft) {
//       return SLOT_CONTENT_TYPES.border_bottom_left;
//     }
//     if (cell.borderRight) {
//       return SLOT_CONTENT_TYPES.border_right_half;
//     }
//     return SLOT_CONTENT_TYPES.blank;
//   },
// };
// const bottomLeftSlot = {
//   type: "bottom_left",
//   adapt: ({ cell, westCell }) => {
//     if (cell.borderBottom) {
//       return SLOT_CONTENT_TYPES.border_bottom_right;
//     }
//     if (westCell && westCell.borderBottom && !westCell.borderRight) {
//       return SLOT_CONTENT_TYPES.border_bottom_left;
//     }
//     if (cell.borderLeft) {
//       return SLOT_CONTENT_TYPES.border_left_half;
//     }
//     return SLOT_CONTENT_TYPES.blank;
//   },
// };

export const renderTable = (inputGrid, { ansi = true } = {}) => {
  const grid = [];

  const leftSlotColumnMap = new Map();
  const rightSlotColumnMap = new Map();
  const topSlotRowMap = new Map();
  const bottomSlotRowMap = new Map();
  const onBorderLeft = (x, y) => {
    const leftSlotArray = leftSlotColumnMap.get(x);
    if (!leftSlotArray) {
      const array = [];
      leftSlotColumnMap.set(x, array);
      array[y] = leftSlot;
    } else {
      leftSlotArray[x] = leftSlot;
    }
  };
  const onBorderRight = (x, y) => {
    const rightSlotArray = rightSlotColumnMap.get(x);
    if (!rightSlotArray) {
      const array = [];
      rightSlotColumnMap.set(x, array);
      array[y] = rightSlot;
    } else {
      rightSlotArray[x] = rightSlot;
    }
  };
  const onBorderTop = (x, y) => {
    const topSlotArray = topSlotRowMap.get(y);
    if (!topSlotArray) {
      const array = [];
      topSlotRowMap.set(y, array);
      array[x] = topSlot;
    } else {
      topSlotArray[x] = topSlot;
    }
  };
  const onBorderBottom = (x, y) => {
    const bottomSlotArray = bottomSlotRowMap.get(y);
    if (!bottomSlotArray) {
      const array = [];
      bottomSlotRowMap.set(y, array);
      array[x] = bottomSlot;
    } else {
      bottomSlotArray[x] = bottomSlot;
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
  // fill slot row and columns
  {
    for (const [, leftSlotColumn] of leftSlotColumnMap) {
      let y = 0;
      while (y < grid.length) {
        if (!leftSlotColumn[y]) {
          leftSlotColumn[y] = leftSlot;
        }
        y++;
      }
    }
    for (const [, rightSlotColumn] of rightSlotColumnMap) {
      let y = 0;
      while (y < grid.length) {
        if (!rightSlotColumn[y]) {
          rightSlotColumn[y] = rightSlot;
        }
        y++;
      }
    }
    for (const [, topSlotRow] of topSlotRowMap) {
      let x = 0;
      while (x < grid[0].length) {
        if (!topSlotRow[x]) {
          topSlotRow[x] = topSlot;
        }
        x++;
      }
    }
    for (const [, bottomSlotRow] of bottomSlotRowMap) {
      let x = 0;
      while (x < grid[0].length) {
        if (!bottomSlotRow[x]) {
          bottomSlotRow[x] = bottomSlot;
        }
        x++;
      }
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

  // transform border slots into what they should be (is it required at this stage I don't know)
  // (pour le moment on va ignorer les coins)
  {
    let y = 0;
    while (y < grid.length) {
      let x = 0;
      const row = grid[y];
      const topSlotRow = topSlotRowMap.get(y);
      const bottomSlotRow = bottomSlotRowMap.get(y);
      while (x < row.length) {
        const cell = row[x];
        const westCell = x === 0 ? null : row[x - 1];
        const eastCell = x === row.length - 1 ? null : row[x + 1];
        const northCell = y === 0 ? null : grid[y - 1][x];
        const southCell = y === grid.length - 1 ? null : grid[y + 1][x];

        const leftSlotColumn = leftSlotColumnMap.get(x);
        const rightSlotColumn = rightSlotColumnMap.get(x);
        if (leftSlotColumn) {
          const leftSlot = leftSlotColumn[y];
          if (leftSlot) {
            const leftSlotContent = leftSlot.adapt({
              cell,
              westCell,
              eastCell,
              northCell,
              southCell,
            });
            leftSlot.content = leftSlotContent;
          }
        }
        if (rightSlotColumn) {
          const rightSlot = rightSlotColumn[y];
          if (rightSlot) {
            const rightSlotContent = rightSlot.adapt({
              cell,
              westCell,
              eastCell,
              northCell,
              southCell,
            });
            rightSlot.content = rightSlotContent;
          }
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
        x++;
      }
      y++;
    }
  }

  // render table
  let log = "";
  {
    const renderRow = (cells, { rowHeight }) => {
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
          const leftSlotColumn = leftSlotColumnMap.get(x);
          if (leftSlotColumn) {
            leftSlotLineText = renderCell(leftSlotColumn[y], {
              columnWidth: 1,
              rowHeight,
              lineIndex,
            });
          }
          const rightSlotColumn = rightSlotColumnMap.get(x);
          if (rightSlotColumn) {
            rightSlotLineText = renderCell(rightSlotColumn[y], {
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
      top_slow_row: {
        const topSlotRow = topSlotRowMap.get(y);
        if (topSlotRow) {
          const topSlotRowText = renderRow(topSlotRow, {
            rowHeight: 1,
          });
          log += topSlotRowText;
        }
      }
      content_row: {
        const contentRowText = renderRow(row, {
          rowType: "content",
          rowHeight: rowHeightMap.get(y),
        });
        log += contentRowText;
      }
      bottom_slot_row: {
        const bottomSlotRow = bottomSlotRowMap.get(y);
        if (bottomSlotRow) {
          const bottomSlotRowText = renderRow(bottomSlotRow, {
            rowHeight: 1,
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
