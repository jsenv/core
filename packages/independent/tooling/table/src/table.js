/**
 *
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

export const renderTable = (inputGrid, { ansi = true } = {}) => {
  const grid = [];

  // inject borders
  {
    let y = 0;
    for (const inputLine of inputGrid) {
      let x = 0;
      const topCells = [];
      const line = [];
      const bottomCells = [];
      for (const inputCell of inputLine) {
        const {
          border,
          borderLeft = border,
          borderTop = border,
          borderRight = border,
          borderBottom = border,
          ...props
        } = inputCell;

        const leftCell = borderLeft
          ? createBorderLeftCell(borderLeft)
          : blankCell;
        line[x] = leftCell;
        x++;

        const topCell = borderTop ? createBorderTopCell(borderTop) : blankCell;
        topCells[x] = topCell;
        const bottomCell = borderBottom
          ? createBorderBottomCell(borderBottom)
          : blankCell;
        bottomCells[x] = bottomCell;
        const contentCell = createContentCell(props, { ansi });
        line[x] = contentCell;
        x++;

        const rightCell = borderRight
          ? createBorderRightCell(borderRight)
          : blankCell;
        line[x] = rightCell;
        x++;
      }

      {
        const rowAbove = [];
        let x = 0;
        while (x < line.length) {
          const topCell = topCells[x];
          let aboveCell;
          if (topCell) {
            aboveCell = topCell;
          } else {
            const cellEast = topCells[x + 1];
            if (cellEast && isBorderTop(cellEast)) {
              aboveCell = createTopLeftBorderCell();
            } else {
              const cellWest = topCells[x - 1];
              if (cellWest && isBorderTop(cellWest)) {
                aboveCell = createTopRightBorderCell();
              } else {
                aboveCell = blankCell;
              }
            }
          }
          rowAbove[x] = aboveCell;
          x++;
        }
        grid[y] = rowAbove;
        y++;
      }

      grid[y] = line;
      y++;

      {
        const rowBelow = [];
        let x = 0;
        while (x < line.length) {
          const bottomCell = bottomCells[x];
          let belowCell;
          if (bottomCell) {
            belowCell = bottomCell;
          } else {
            const cellEast = bottomCells[x + 1];
            if (cellEast && isBorderBottom(cellEast)) {
              belowCell = createBottomLeftBorderCell();
            } else {
              const cellWest = bottomCells[x - 1];
              if (cellWest && isBorderBottom(cellWest)) {
                belowCell = createBottomRightBorderCell();
              } else {
                belowCell = blankCell;
              }
            }
          }
          rowBelow[x] = belowCell;
          x++;
        }
        grid[y] = rowBelow;
        y++;
      }
    }
  }

  // transform connecting borders into blank cells when they are not needed
  // and eventually transform blank cells back into connecting borders
  {
    const columnContainingLeftBorderSet = new Set();
    const columnContainingRightBorderSet = new Set();
    const columnContainsLeftBorder = (x) =>
      columnContainingLeftBorderSet.has(x);
    const columnContainsRightBorder = (x) =>
      columnContainingRightBorderSet.has(x);

    {
      let y = 0;
      while (y < grid.length) {
        const line = grid[y];
        let x = 0;
        for (const cell of line) {
          if (isBorderLeft(cell)) {
            columnContainingLeftBorderSet.add(x);
          } else if (isBorderRight(cell)) {
            columnContainingRightBorderSet.add(x);
          }
          x++;
        }
        y++;
      }
    }

    mutateGrid(grid, (cell, { x, y }) => {
      if (isBorderTopLeft(cell)) {
        if (columnContainsLeftBorder(x)) {
          const southCell = grid[y + 1][x];
          if (isBorderLeft(southCell)) {
            return cell;
          }
          if (y > 2) {
            // in theory we can do this only if the border are compatible and about to be collapsed
            // so maybe this logic belongs to the collapse border part
            const northNorthCell = grid[y - 2][x];
            if (northNorthCell && isBorderLeft(northNorthCell)) {
              return createBottomLeftBorderCell();
            }
          }
          return createBorderTopCell();
        }
        if (columnContainsRightBorder(x - 1)) {
          return cell;
        }
        return blankCell;
      }
      if (isBorderTopRight(cell)) {
        if (columnContainsRightBorder(x)) {
          const southCell = grid[y + 1][x];
          if (isBorderRight(southCell)) {
            return cell;
          }
          return createBorderTopCell();
        }
        return blankCell;
      }
      if (isBorderBottomRight(cell)) {
        if (columnContainsRightBorder(x)) {
          const northCell = grid[y - 1][x];
          if (isBorderRight(northCell)) {
            return cell;
          }
          return createBorderBottomCell();
        }
        if (columnContainsLeftBorder(x + 1)) {
          return cell;
        }
        return blankCell;
      }
      if (isBorderBottomLeft(cell)) {
        if (columnContainsLeftBorder(x)) {
          const northCell = grid[y - 1][x];
          if (isBorderLeft(northCell)) {
            return cell;
          }
          if (y < grid.length - 2) {
            // in theory we can do this only if the border are compatible and about to be collapsed
            // so maybe this logic belongs to the collapse border part
            const southSouthCell = grid[y + 2][x];
            if (isBorderLeft(southSouthCell)) {
              return createTopLeftBorderCell();
            }
          }
          return createBorderBottomCell();
        }
        if (columnContainsRightBorder(x - 1)) {
          return cell;
        }
        return blankCell;
      }
      return cell;
    });
  }

  // collapse left and right borders
  {
    // if every right border can collapse with the left border next to it
    // then we collapse all right borders of the column
    const getHowToCollapseAdjacentCells = (leftCell, rightCell) => {
      if (isBlankCell(leftCell)) {
        return [
          // left cell becomes right cell
          rightCell,
          // right cell becomes blank (it's redundant)
          blankCell,
        ];
      }
      if (isBlankCell(rightCell)) {
        // keep as it is
        return [leftCell, rightCell];
      }
      if (isBorderTopRight(leftCell) && isBorderTopLeft(rightCell)) {
        return [
          createTopMidBorderCell({ color: leftCell.color }),
          blankCell, // merged into the left cell
        ];
      }
      if (isBorderBottomRight(leftCell) && isBorderBottomLeft(rightCell)) {
        return [
          createBottomMidBorderCell({ color: leftCell.color }),
          blankCell, // merged into the left cell
        ];
      }
      if (isBorderRight(leftCell) && isBorderLeft(rightCell)) {
        return [
          leftCell,
          blankCell, // merged into the left cell
        ];
      }
      return null;
    };

    let x = 2;
    const columnCount = grid[0].length;
    while (x < columnCount - 1) {
      let hasConlict;
      let y = 0;
      const collapseInfoSet = new Set();
      while (y < grid.length) {
        const columnCell = grid[y][x];
        const eastColumnCell = grid[y][x + 1];
        const howToCollapseCells = getHowToCollapseAdjacentCells(
          columnCell,
          eastColumnCell,
        );
        if (!howToCollapseCells) {
          hasConlict = true;
          break;
        }
        collapseInfoSet.add({ x, y, howToCollapseCells });
        y++;
      }
      if (!hasConlict) {
        for (const collapseInfo of collapseInfoSet) {
          const { x, y, howToCollapseCells } = collapseInfo;
          const collapsedCells = Array.isArray(howToCollapseCells)
            ? howToCollapseCells
            : howToCollapseCells();
          const [leftCollapsed, rightCollapsed] = collapsedCells;
          grid[y][x] = leftCollapsed;
          grid[y][x + 1] = rightCollapsed;
        }
      }
      x += 3;
    }
  }

  // collapse top and bottom borders
  {
    const getHowToCollapseAdjacentCells = (cell, cellBelow) => {
      if (isBlankCell(cell)) {
        return [
          cellBelow, // cell becomes cell below
          blankCell, // cell below becomes blank
        ];
      }
      if (isBlankCell(cellBelow)) {
        return [
          // keep both as is
          cell,
          cellBelow,
        ];
      }
      if (isBorderTopRight(cell) && isBorderTopLeft(cellBelow)) {
        return [
          createTopMidBorderCell({ color: cell.color }),
          blankCell, // merged into the top cell
        ];
      }
      if (isBorderBottomRight(cell) && isBorderBottomLeft(cellBelow)) {
        return [
          createBottomMidBorderCell({ color: cell.color }),
          blankCell, // merged into the cell
        ];
      }
      if (isBorderBottomLeft(cell) && isBorderTopLeft(cellBelow)) {
        return [
          createLeftMidBorderCell({ color: cell.color }),
          blankCell, // merged into the cell
        ];
      }
      if (isBorderBottomRight(cell) && isBorderTopRight(cellBelow)) {
        return [
          createRightMidBorderCell({ color: cell.color }),
          blankCell, // merged into the cell
        ];
      }
      if (isBorderBottomRight(cell) && isBorderTop(cellBelow)) {
        return [
          cell,
          blankCell, // merged into the cell
        ];
      }
      if (isBorderBottom(cell) && isBorderTopLeft(cellBelow)) {
        return [
          cellBelow,
          blankCell, // merged into the top cell
        ];
      }
      if (isBorderBottom(cell) && isBorderTop(cellBelow)) {
        return [
          cell,
          blankCell, // merged into the top cell
        ];
      }
      return null;
    };

    let y = 2;
    const lineCount = grid.length;
    while (y < lineCount - 1) {
      let hasConflict;
      let x = 0;
      const line = grid[y];
      const lineBelow = grid[y + 1];
      const collapseInfoSet = new Set();
      while (x < line.length) {
        const cell = line[x];
        const cellBelow = lineBelow[x];
        const howToCollapseCells = getHowToCollapseAdjacentCells(
          cell,
          cellBelow,
        );
        if (!howToCollapseCells) {
          hasConflict = true;
          break;
        }
        collapseInfoSet.add({ x, y, howToCollapseCells });
        x++;
      }
      if (!hasConflict) {
        for (const collapseInfo of collapseInfoSet) {
          const { x, y, howToCollapseCells } = collapseInfo;
          const collapsedCells = Array.isArray(howToCollapseCells)
            ? howToCollapseCells
            : howToCollapseCells();
          const [cellCollapsed, cellBelowCollapsed] = collapsedCells;
          grid[y][x] = cellCollapsed;
          grid[y + 1][x] = cellBelowCollapsed;
        }
      }
      y += 3;
    }
  }

  // remove lines that are only blank cells (no visible borders)
  {
    let y = 0;
    while (y < grid.length) {
      const line = grid[y];
      let lineContainsNonBlankCell = false;
      for (const cell of line) {
        if (isBlankCell(cell)) {
          continue;
        }
        lineContainsNonBlankCell = true;
        break;
      }
      if (lineContainsNonBlankCell) {
        y++;
        continue;
      }
      grid.splice(y, 1);
    }
  }
  // remove columns that are only blank cells (no visible borders)
  {
    let x = 0;
    let columnCount = grid[0].length;
    while (x < columnCount) {
      let columnContainsNonBlankCell = false;
      let y = 0;
      while (y < grid.length) {
        const columnCell = grid[y][x];
        if (isBlankCell(columnCell)) {
          y++;
          continue;
        }
        columnContainsNonBlankCell = true;
        break;
      }
      if (columnContainsNonBlankCell) {
        x++;
        continue;
      }
      // get rid of this cell on every line (remove the full column)
      y = 0;
      while (y < grid.length) {
        const line = grid[y];
        line.splice(x, 1);
        columnCount--;
        y++;
      }
    }
  }

  // measure column and row dimensions (biggest of all cells in the column/row)
  const columnWidthMap = new Map();
  const rowHeightMap = new Map();
  {
    let y = 0;
    for (const line of grid) {
      let x = 0;
      for (const cell of line) {
        const columnWidth = columnWidthMap.get(x) || -1;
        const rowHeight = rowHeightMap.get(y) || -1;
        const {
          rects,
          leftSpacing = 0,
          rightSpacing = 0,
          topSpacing = 0,
          bottomSpacing = 0,
        } = cell;
        let cellBiggestWidth = -1;
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
          if (width > cellBiggestWidth) {
            cellBiggestWidth = width;
          }
        }
        if (cellBiggestWidth > columnWidth) {
          columnWidthMap.set(x, cellBiggestWidth);
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
        if (cellHeight > rowHeight) {
          rowHeightMap.set(y, cellHeight);
        }
        x++;
      }
      y++;
    }
  }

  let log = "";
  {
    let y = 0;
    for (const row of grid) {
      let rowText = "";
      let isLastRow = y === grid.length - 1;
      const rowHeight = rowHeightMap.get(y);
      let lastLineIndex = rowHeight;
      let lineIndex = 0;
      while (lineIndex !== lastLineIndex) {
        let x = 0;
        let lineText = "";
        for (const cell of row) {
          const columnWidth = columnWidthMap.get(x);
          const {
            xAlign,
            xAlignChar = " ",
            yAlign,
            yAlignChar = " ",
            rects,
          } = cell;
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

          let cellLineText;
          if (rect) {
            const { width, render } = rect;
            let rectText = render({ columnWidth });
            if (width === "fill") {
              cellLineText = rectText;
            } else {
              cellLineText = applyXAlign(rectText, {
                width,
                desiredWidth: columnWidth,
                align: xAlign,
                alignChar: xAlignChar,
              });
            }
          } else {
            cellLineText = applyXAlign(yAlignChar, {
              width: 1,
              desiredWidth: columnWidth,
              align: xAlign,
              alignChar: " ",
            });
          }
          lineText += cellLineText;
          x++;
        }
        rowText += lineText;
        lineIndex++;
        if (isLastRow && lineIndex === lastLineIndex) {
          break;
        }
        rowText += "\n";
      }
      log += rowText;
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
    quoteAroundStrings = true,
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
    text = value;
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
      {
        width: "fill",
        render: ({ columnWidth }) => "─".repeat(columnWidth),
      },
    ],
  },
  bottom: {
    position: "bottom",
    yAlign: "start",
    rects: [
      {
        width: "fill",
        render: ({ columnWidth }) => "─".repeat(columnWidth),
      },
    ],
  },
  left: {
    position: "left",
    xAlign: "end",
    yAlignChar: "|",
    rects: [
      {
        width: 1,
        render: () => "│",
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
        render: () => "│",
      },
    ],
  },
  // corners
  top_left: {
    position: "top_left",
    xAlign: "start",
    yAlign: "start",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [
      {
        width: 1,
        render: () => "┌",
      },
    ],
  },
  top_right: {
    position: "top_right",
    xAlign: "end",
    yAlign: "start",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [
      {
        width: 1,
        render: () => "┐",
      },
    ],
  },
  bottom_right: {
    position: "bottom_right",
    xAlign: "end",
    yAlign: "end",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [
      {
        width: 1,
        render: () => "┘",
      },
    ],
  },
  bottom_left: {
    position: "bottom_left",
    xAlign: "start",
    yAlign: "end",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [
      {
        width: 1,
        render: () => "└",
      },
    ],
  },
  // junctions
  top_mid: {
    position: "top_mid",
    xAlign: "center",
    yAlign: "start",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [
      {
        width: 1,
        render: () => "┬",
      },
    ],
  },
  bottom_mid: {
    position: "bottom_mid",
    xAlign: "center",
    yAlign: "end",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [
      {
        width: 1,
        render: () => "┴",
      },
    ],
  },
  right_mid: {
    position: "right_mid",
    xAlign: "end",
    yAlign: "center",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [
      {
        width: 1,
        render: () => "┤",
      },
    ],
  },
  left_mid: {
    position: "left_mid",
    xAlign: "start",
    yAlign: "center",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [
      {
        width: 1,
        render: () => "├",
      },
    ],
  },
  mid: {
    position: "mid",
    xAlign: "center",
    yAlign: "center",
    xAlignChar: "─",
    yAlignChar: "│",
    rects: [
      {
        width: 1,
        render: () => "┼",
      },
    ],
  },
};

const createBorderCell = (position, options) => {
  const borderProps = BORDER_PROPS[position];
  if (options) {
    return {
      ...borderProps,
      ...options,
    };
  }
  return borderProps;
};
const createBorderLeftCell = (options) => createBorderCell("left", options);
const createBorderRightCell = (options) => createBorderCell("right", options);
const createBorderTopCell = (options) => createBorderCell("top", options);
const createBorderBottomCell = (options) => createBorderCell("bottom", options);
const createTopLeftBorderCell = (options) =>
  createBorderCell("top_left", options);
const createTopRightBorderCell = (options) =>
  createBorderCell("top_right", options);
const createBottomRightBorderCell = (options) =>
  createBorderCell("bottom_right", options);
const createBottomLeftBorderCell = (options) =>
  createBorderCell("bottom_left", options);
const createTopMidBorderCell = (options) =>
  createBorderCell("top_mid", options);
const createBottomMidBorderCell = (options) =>
  createBorderCell("bottom_mid", options);
const createRightMidBorderCell = (options) =>
  createBorderCell("right_mid", options);
const createLeftMidBorderCell = (options) =>
  createBorderCell("left_mid", options);
// const createMidBorderCell = (options) => createBorderCell("mid", options);

const isBorderTopLeft = (cell) => cell.position === "top_left";
const isBorderTopRight = (cell) => cell.position === "top_right";
const isBorderLeft = (cell) => cell.position === "left";
const isBorderRight = (cell) => cell.position === "right";
const isBorderTop = (cell) => cell.position === "top";
const isBorderBottom = (cell) => cell.position === "bottom";
const isBorderBottomRight = (cell) => cell.position === "bottom_right";
const isBorderBottomLeft = (cell) => cell.position === "bottom_left";

const isBlankCell = (cell) => cell.type === "blank";
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

const mutateGrid = (grid, callback) => {
  let y = 0;
  for (const line of grid) {
    let x = 0;
    for (const cell of line) {
      line[x] = callback(cell, { x, y });
      x++;
    }
    y++;
  }
};

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
