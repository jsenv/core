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

const SLOT_CONTENT_TYPES = {
  blank: "blank",
  border_left: "border_left",
  border_top_right: "border_top_right",
  border_top_left: "border_top_left",
  border_left_half: "border_left_half",
  border_right_half: "border_right_half",
};

const leftSlot = {
  type: "left",
  adapt: () => {
    return SLOT_CONTENT_TYPES.left;
  },
};
const rightSlot = {};
const topSlot = {};
const bottomSlot = {};
const topLeftSlot = {
  type: "top_left",
  adapt: ({ cell, westCell }) => {
    if (cell.borderTop) {
      return SLOT_CONTENT_TYPES.top_left;
    }
    if (westCell && westCell.borderTop && !westCell.borderRight) {
      return SLOT_CONTENT_TYPES.top_right;
    }
    return SLOT_CONTENT_TYPES.left_half;
  },
};
const topRightSlot = {};
const bottomRightSlot = {};
const bottomLeftSlot = {
  adapt: ({ cell, westCell }) => {
    if (cell.borderBottom) {
      return SLOT_CONTENT_TYPES.bottom_right;
    }
    if (westCell && westCell.borderBottom && !westCell.borderRight) {
      return SLOT_CONTENT_TYPES.bottom_left;
    }
    return SLOT_CONTENT_TYPES.right_half;
  },
};

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
          onBorderLeft(borderLeft, x, y);
        }
        if (borderRight) {
          contentCell.borderRight = borderRight;
          onBorderRight(borderRight, x, y);
        }
        if (borderTop) {
          contentCell.borderTop = borderTop;
          onBorderTop(borderTop, x, y);
        }
        if (borderBottom) {
          contentCell.borderBottom = borderBottom;
          onBorderBottom(borderBottom, x, y);
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
  {
    const getSlotContent = (slotContent) => {
      if (slotContent === SLOT_CONTENT_TYPES.blank) {
        return blankCell;
      }
      return null;
    };

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
            const leftSlotContentType = leftSlot.adapt({
              cell,
              westCell,
              eastCell,
              northCell,
              southCell,
            });
            leftSlot.content = getSlotContent(leftSlotContentType);
          }
        }
        if (rightSlotColumn) {
          const rightSlot = rightSlotColumn[y];
          if (rightSlot) {
            const rightSlotContentType = rightSlot.adapt({
              cell,
              westCell,
              eastCell,
              northCell,
              southCell,
            });
            rightSlot.content = getSlotContent(rightSlotContentType);
          }
        }

        if (topSlotRow) {
          const topSlot = topSlotRow[x];
          const topSlotContentType = topSlot.adapt({
            cell,
            westCell,
            eastCell,
            northCell,
            southCell,
          });
          topSlot.content = getSlotContent(topSlotContentType);
        }
        if (bottomSlotRow) {
          const bottomSlot = bottomSlotRow[x];
          const bottomSlotContentType = bottomSlot.adapt({
            cell,
            westCell,
            eastCell,
            northCell,
            southCell,
          });
          bottomSlot.content = getSlotContent(bottomSlotContentType);
        }
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

const BORDER_PROPS = {
  top: {
    position: "top",
    yAlign: "end",
    rects: [
      { width: "fill", render: ({ columnWidth }) => "─".repeat(columnWidth) },
    ],
  },
  bottom: {
    position: "bottom",
    yAlign: "start",
    rects: [
      { width: "fill", render: ({ columnWidth }) => "─".repeat(columnWidth) },
    ],
  },
  left: {
    position: "left",
    xAlign: "end",
    yAlignChar: "|",
    rects: [
      {
        width: 1,
        render: () => {},
      },
    ],
  },
  right: {
    position: "right",
    xAlign: "start",
    yAlignChar: "|",
    rects: [
      {
        width: 1,
        render: ({
          isTopRightCorner,
          isBottomRightCorner,
          contentCells,
          updateOptions,
        }) => {
          const { cell, east } = contentCells;
          if (isTopRightCorner) {
            if (cell.borderTop) {
              updateOptions(BORDER_JUNCTION_OPTIONS.top_right);
              return "┐";
            }
            if (east && east.borderTop && !east.borderLeft) {
              updateOptions(BORDER_JUNCTION_OPTIONS.top_left);
              return "┌";
            }
            updateOptions(BORDER_JUNCTION_OPTIONS.right_top_half);
            return "╷";
          }
          if (isBottomRightCorner) {
            if (cell.borderBottom) {
              updateOptions(BORDER_JUNCTION_OPTIONS.bottom_right);
              return "┘";
            }
            if (east && east.borderBottom && !east.borderLeft) {
              updateOptions(BORDER_JUNCTION_OPTIONS.bottom_left);
              return "└";
            }
            updateOptions(BORDER_JUNCTION_OPTIONS.right_bottom_half);
            return "╵";
          }
          return "│";
        },
      },
    ],
  },
};

const BORDER_JUNCTION_OPTIONS = {
  // 1 border junction with blank
  left_top_half: {
    position: "left_top_half",
    xAlign: "end",
    char: "╷",
  },
  left_bottom_half: {
    position: "left_bottom_half",
    xAlign: "end",
    char: "╵",
  },
  right_top_half: {
    position: "right_top_half",
    xAlign: "end",
    char: "╷",
  },
  right_bottom_half: {
    position: "right_bottom_half",
    xAlign: "end",
    char: "╵",
  },
  // 2 borders junctions (corners)
  top_left: {
    position: "top_left",
    xAlign: "start",
    yAlign: "start",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "┌",
  },
  top_right: {
    position: "top_right",
    xAlign: "end",
    yAlign: "start",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "┐",
  },
  bottom_right: {
    position: "bottom_right",
    xAlign: "end",
    yAlign: "end",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "┘",
  },
  bottom_left: {
    position: "bottom_left",
    xAlign: "start",
    yAlign: "end",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "└",
  },
  // 3 borders junctions
  top_mid: {
    position: "top_mid",
    xAlign: "center",
    yAlign: "start",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "┬",
  },
  bottom_mid: {
    position: "bottom_mid",
    xAlign: "center",
    yAlign: "end",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "┴",
  },
  right_mid: {
    position: "right_mid",
    xAlign: "end",
    yAlign: "center",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "┤",
  },
  left_mid: {
    position: "left_mid",
    xAlign: "start",
    yAlign: "center",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "├",
  },
  // 4 border junctions
  mid: {
    position: "mid",
    xAlign: "center",
    yAlign: "center",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "┼",
  },
};

const getBorderJunction = (border, { cell, west }) => {
  if (border.type === "top_left") {
    if (cell.borderTop) {
      return "top_left";
    }
    if (west && west.borderTop && !west.borderRight) {
      return "top_right";
    }
    return "top_left_half";
  }
};

const createBorder = (position) => {
  const borderProps = BORDER_PROPS[position];

  const rectsCopy = borderProps.rects.map((rect) => ({ ...rect }));
  rectsCopy.render = () => {
    borderProps.rects[0].render();
  };

  return {
    ...borderProps,
  };
};
// const createBorderLeft = () => createBorder("left");
// const createBorderRight = () => createBorder("right");
// const createBorderTop = () => createBorder("top");
// const createBorderBottom = () => createBorder("bottom");
// const createTopMidBorderCell = (options) =>
//   createBorderCell("top_mid", options);
// const createBottomMidBorderCell = (options) =>
//   createBorderCell("bottom_mid", options);
// const createRightMidBorderCell = (options) =>
//   createBorderCell("right_mid", options);
// const createLeftMidBorderCell = (options) =>
//   createBorderCell("left_mid", options);
// const createMidBorderCell = (options) => createBorderCell("mid", options);

// const isBorderTopLeft = (cell) => cell.position === "top_left";
// const isBorderTopRight = (cell) => cell.position === "top_right";
// const isBorderLeft = (cell) => cell.position === "left";
// const isBorderRight = (cell) => cell.position === "right";
// const isBorderTop = (cell) => cell.position === "top";
// const isBorderBottom = (cell) => cell.position === "bottom";
// // const isBorderBottomRight = (cell) => cell.position === "bottom_right";
// // const isBorderBottomLeft = (cell) => cell.position === "bottom_left";
// const isContent = (cell) => cell.type === "content";

// const isBlank = (cell) => cell.type === "blank";
// blank cells are fluid cells that will take whatever size they are requested to take
// they can seen as placeholders that are removed when a line or column is composed only by blank cells
// this is useful to enforce a given amount of line / columns that can be adjusted later if nothing use the reserved line/column
// (used to implement borders because any cell can suddenly enable a border meaning all previous cells must now have blank spaces
// where the border is)
const blankCell = {
  type: "blank",
  rects: [
    {
      width: "fill",
      render: ({ columnWidth }) => " ".repeat(columnWidth),
    },
  ],
};

// const mutateGrid = (grid, callback) => {
//   let y = 0;
//   for (const line of grid) {
//     let x = 0;
//     for (const cell of line) {
//       line[x] = callback(cell, { x, y });
//       x++;
//     }
//     y++;
//   }
// };

// console.log(
//   renderTable([
//     [
//       {
//         value: "1:1",
//         borderTop: {},
//         borderLeft: {},
//         borderRight: {},
//         borderBottom: {},
//       },
//       {
//         value: "1:2",
//         borderTop: {},
//         borderLeft: {},
//         // borderRight: {},
//         borderBottom: {},
//       },
//       {
//         value: "1:3",
//         borderTop: {},
//         // borderLeft: {},
//         borderRight: {},
//         borderBottom: {},
//       },
//     ],
//     [
//       {
//         value: "2:1",
//         borderTop: {},
//         borderLeft: {},
//         borderRight: {},
//         borderBottom: {},
//       },
//       {
//         value: "2:2",
//         borderTop: {},
//         borderLeft: {},
//         borderRight: {},
//         borderBottom: {},
//       },
//       {
//         value: "2:3",
//         borderTop: {},
//         borderLeft: {},
//         borderRight: {},
//         borderBottom: {},
//       },
//     ],
//   ]),
// );
