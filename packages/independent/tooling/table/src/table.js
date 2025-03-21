/**
 * TODO:
 * - Plein de cas de tests
 * - Le border collapse
 * - Les jointures spéciale pour les bordures qui jointent des cellules adjacentes
 *
 * https://github.com/Automattic/cli-table
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
        const { borderLeft, borderTop, borderRight, borderBottom, ...props } =
          inputCell;

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
        const lineAbove = [];
        let x = 0;
        while (x < line.length) {
          const topCell = topCells[x];
          let aboveCell;
          if (topCell) {
            aboveCell = topCell;
          } else {
            const rightTopCell = topCells[x + 1];
            if (rightTopCell && isBorderTop(rightTopCell)) {
              aboveCell = createTopLeftBorderCell();
            } else {
              const previousCell = topCells[x - 1];
              if (previousCell && isBorderTop(previousCell)) {
                aboveCell = createTopRightBorderCell();
              } else {
                aboveCell = blankCell;
              }
            }
          }
          lineAbove[x] = aboveCell;
          x++;
        }
        grid[y] = lineAbove;
        y++;
      }

      grid[y] = line;
      y++;

      {
        const lineBelow = [];
        let x = 0;
        while (x < line.length) {
          const bottomCell = bottomCells[x];
          let belowCell;
          if (bottomCell) {
            belowCell = bottomCell;
          } else {
            const nextCell = bottomCells[x + 1];
            if (nextCell && isBorderBottom(nextCell)) {
              belowCell = createBottomLeftBorderCell();
            } else {
              const previousCell = bottomCells[x - 1];
              if (previousCell && isBorderBottom(previousCell)) {
                belowCell = createBottomRightBorderCell();
              } else {
                belowCell = blankCell;
              }
            }
          }
          lineBelow[x] = belowCell;
          x++;
        }
        grid[y] = lineBelow;
        y++;
      }
    }
  }

  // transform connecting borders into blank cells when they are not needed
  {
    const columnContainingLeftBorderSet = new Set();
    const columnContainingRightBorderSet = new Set();
    const columnsContainsLeftBorder = (x) =>
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
        if (columnsContainsLeftBorder(x)) {
          const southCell = grid[y + 1][x];
          if (isBorderLeft(southCell)) {
            return cell;
          }
          return createBorderTopCell();
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
        return blankCell;
      }
      if (isBorderBottomLeft(cell)) {
        if (columnsContainsLeftBorder(x)) {
          const northCell = grid[y - 1][x];
          if (isBorderLeft(northCell)) {
            return cell;
          }
          return createBorderBottomCell();
        }
        return blankCell;
      }
      return cell;
    });
  }

  // collapse horizontal borders
  {
    // if every right border can collapse with the left border next to it
    // then we collapse all right borders of the column
    const getHowToCollapseAdjacentCells = (leftCell, rightCell) => {
      if (leftCell.type === "blank") {
        return [
          // left cell becomes right cell
          rightCell,
          // right cell becomes blank (it's redundant)
          blankCell,
        ];
      }
      if (rightCell.type === "blank") {
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
    const collapseInfoSet = new Set();
    while (x < columnCount - 1) {
      let canCollapseColumn;
      let y = 0;
      while (y < grid.length) {
        const columnCell = grid[y][x];
        const eastColumnCell = grid[y][x + 1];
        const howToCollapseCells = getHowToCollapseAdjacentCells(
          columnCell,
          eastColumnCell,
        );
        if (!howToCollapseCells) {
          canCollapseColumn = false;
          break;
        }
        collapseInfoSet.add({ x, y, howToCollapseCells });
        y++;
      }
      if (canCollapseColumn !== false) {
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

  // remove lines that are only blank cells (no visible borders)
  {
    let y = 0;
    while (y < grid.length) {
      const line = grid[y];
      let lineContainsNonBlankCell = false;
      for (const cell of line) {
        if (cell.type === "blank") {
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
        if (columnCell.type === "blank") {
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

  // replace grid content wih cell objects
  {
    const columnBiggestWidthArray = [];
    const lineBiggestHeightArray = [];
    const createCellNode = (cell, { x, y }) => {
      const biggestWidth = columnBiggestWidthArray[x] || 0;
      const biggestHeight = lineBiggestHeightArray[y] || 0;

      const { rects } = cell;
      for (const rect of rects) {
        const { width, height } = rect;
        if (width !== "100%" && width > biggestWidth) {
          columnBiggestWidthArray[x] = width;
        }
        if (height !== "100%" && height > biggestHeight) {
          lineBiggestHeightArray[y] = height;
        }
      }
      const cellNode = {
        render: () => {
          const availableWidth = columnBiggestWidthArray[x];
          const availableHeight = lineBiggestHeightArray[y];

          let cellText = "";
          const { xAlign, xAlignChar = " ", yAlign, yAlignChar = "" } = cell;
          let cellHeight = 0;
          for (const rect of rects) {
            const { width, height, render } = rect;
            const rectText = render({
              availableWidth,
              availableHeight,
            });

            let textAlignedX;
            if (width === "100%") {
              textAlignedX = rectText;
            } else if (xAlign === "start") {
              textAlignedX =
                rectText + xAlignChar.repeat(availableWidth - width);
            } else if (xAlign === "end") {
              textAlignedX =
                xAlignChar.repeat(availableWidth - width) + rectText;
            } else if (xAlign === "center") {
              const leftSpacing = Math.floor((availableWidth - width) / 2);
              const rightSpacing = availableWidth - width - leftSpacing;
              textAlignedX =
                xAlignChar.repeat(leftSpacing) +
                rectText +
                xAlignChar.repeat(rightSpacing);
            } else {
              textAlignedX = rectText;
            }
            cellText += textAlignedX;
            if (height === "100%") {
              cellHeight = "100%";
            } else {
              cellHeight += height;
            }
          }

          // now do the y align
          let textAlignedY;
          {
            const fillCharWithNewLine = `${yAlignChar}\n`;
            if (cellHeight === "100%") {
              textAlignedY = cellText;
            } else if (yAlign === "start") {
              textAlignedY =
                cellText +
                fillCharWithNewLine.repeat(availableHeight - cellHeight);
            } else if (yAlign === "end") {
              textAlignedY =
                fillCharWithNewLine.repeat(availableHeight - cellHeight) +
                cellText;
            } else if (yAlign === "center") {
              const topSpacing = Math.floor((availableHeight - cellHeight) / 2);
              const bottomSpacing = availableHeight - cellHeight - topSpacing;
              textAlignedY =
                fillCharWithNewLine.repeat(topSpacing) +
                cellText +
                fillCharWithNewLine.repeat(bottomSpacing);
            } else {
              textAlignedY = cellText;
            }
            cellText = textAlignedY;
          }

          return cellText;
        },
      };
      return cellNode;
    };

    let y = 0;
    for (const line of grid) {
      let x = 0;
      for (const cell of line) {
        const cellNode = createCellNode(cell, { x, y });
        line[x] = cellNode;
        x++;
      }
      y++;
    }
  }

  let log = "";
  {
    let y = 0;
    for (const line of grid) {
      let lineText = "";
      for (const cellNode of line) {
        lineText += cellNode.render();
      }
      log += lineText;
      if (y === grid.length - 1) {
        break;
      }
      log += "\n";
      y++;
    }
  }
  return log;
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
  let largestLineWidth = 0;

  let lineIndex = 0;
  const rects = [];
  for (const line of lines) {
    const isLastLine = lineIndex === lines.length - 1;
    let lineWidth = stringWidth(line);
    let lineText = line;

    if (leftSpacing) {
      lineWidth += leftSpacing;
      lineText = ` `.repeat(leftSpacing) + lineText;
    }
    if (isLastLine && unit) {
      lineWidth += ` ${unit}`.length;
      if (ansi && unitColor) {
        unit = ANSI.color(unit, unitColor);
      }
      lineText += ` ${unit}`;
    }
    if (rightSpacing) {
      lineWidth += rightSpacing;
      lineText += ` `.repeat(rightSpacing);
    }
    if (lineWidth > largestLineWidth) {
      largestLineWidth = lineWidth;
    }
    if (!isLastLine) {
      lineText += "\n";
    }
    rects.push({
      width: lineWidth,
      height: 1,
      render: () => lineText,
    });
    lineIndex++;
  }

  {
    let textVerticallySpaced = text;
    if (topSpacing) {
      let lineInsertedAbove = 0;
      while (lineInsertedAbove < topSpacing) {
        textVerticallySpaced = `\n${textVerticallySpaced}`;
        lineInsertedAbove++;
        rects.unshift({ width: 0, height: 1, text: "\n" });
      }
    }
    if (bottomSpacing) {
      let lineInsertedBelow = 0;
      while (lineInsertedBelow < bottomSpacing) {
        textVerticallySpaced += `\n${bottomSpacing}`;
        lineInsertedBelow++;
        rects.push({ width: 0, height: 1, text: "\n" });
      }
    }
  }

  return {
    type: "content",
    value,
    xAlign,
    yAlign,
    rects,
  };
};

const BORDER_PROPS = {
  top: {
    position: "top",
    xAlign: undefined, // not needed: fills the whole width
    yAlign: "end",
    rects: [
      {
        width: "100%",
        height: 1,
        render: ({ availableWidth }) => fillHorizontally("─", availableWidth),
      },
    ],
  },
  bottom: {
    position: "bottom",
    xAlign: undefined, // not needed: fills the whole width
    yAlign: "start",
    rects: [
      {
        width: "100%",
        height: 1,
        render: ({ availableWidth }) => fillHorizontally("─", availableWidth),
      },
    ],
  },
  left: {
    position: "left",
    xAlign: "end",
    yAlign: undefined, // not needed: fills the whole height
    rects: [
      {
        width: 1,
        height: "100%",
        render: ({ availableHeight }) => fillVertically("│", availableHeight),
      },
    ],
  },
  right: {
    position: "right",
    xAlign: "start",
    yAlign: undefined, // not needed: fills the whole height
    rects: [
      {
        width: 1,
        height: "100%",
        render: ({ availableHeight }) => fillVertically("│", availableHeight),
      },
    ],
  },
  // corners
  top_left: {
    position: "top_left",
    xAlign: "end",
    yAlign: "end",
    rects: [
      {
        width: 1,
        height: 1,
        render: () => "┌",
      },
    ],
  },
  top_right: {
    position: "top_right",
    xAlign: "start",
    yAlign: "end",
    rects: [
      {
        width: 1,
        height: 1,
        render: () => "┐",
      },
    ],
  },
  bottom_right: {
    position: "bottom_right",
    xAlign: "start",
    yAlign: "start",
    rects: [
      {
        width: 1,
        height: 1,
        render: () => "┘",
      },
    ],
  },
  bottom_left: {
    position: "bottom_left",
    xAlign: "end",
    yAlign: "start",
    rects: [
      {
        width: 1,
        height: 1,
        render: () => "└",
      },
    ],
  },
  // junctions
  top_mid: {
    position: "top_mid",
    xAlign: "center",
    xAlignChar: "─",
    yAlign: "end",
    rects: [
      {
        width: 1,
        height: 1,
        render: () => "┬",
      },
    ],
  },
  bottom_mid: {
    position: "bottom_mid",
    xAlign: "center",
    xAlignChar: "─",
    yAlign: "start",
    rects: [
      {
        width: 1,
        height: 1,
        render: () => "┴",
      },
    ],
  },
  right_mid: {
    position: "right_mid",
    xAlign: "start",
    yAlign: "center",
    yAlignChar: "│",
    rects: [
      {
        width: 1,
        height: 1,
        render: () => "┤",
      },
    ],
  },
  left_mid: {
    position: "left_mid",
    xAlign: "end",
    yAlign: "center",
    yAlignChar: "│",
    rects: [
      {
        width: 1,
        height: 1,
        render: () => "├",
      },
    ],
  },
  mid: {
    position: "mid",
    xAlign: "center",
    xAlignChar: "─",
    yAlign: "center",
    yAlignChar: "│",
    rects: [
      {
        width: 1,
        height: 1,
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
// const createRightMidBorderCell = (options) =>
//   createBorderCell("right_mid", options);
// const createLeftMidBorderCell = (options) =>
//   createBorderCell("left_mid", options);
// const createMidBorderCell = (options) => createBorderCell("mid", options);

const fillHorizontally = (string, columnCount, stringWidth = 1) => {
  let text = "";
  let xFilled = 0;
  while (true) {
    text += string;
    xFilled += stringWidth;
    if (xFilled >= columnCount) {
      break;
    }
  }
  return text;
};
const fillVertically = (string, lineCount, stringHeight = 1) => {
  let text = "";
  let yFilled = 0;
  while (true) {
    text += string;
    yFilled += stringHeight;
    if (yFilled >= lineCount) {
      break;
    }
    text += "\n";
  }
  return text;
};

const isBorderTopLeft = (cell) => cell.position === "top_left";
const isBorderTopRight = (cell) => cell.position === "top_right";
const isBorderLeft = (cell) => cell.position === "left";
const isBorderRight = (cell) => cell.position === "right";
const isBorderTop = (cell) => cell.position === "top";
const isBorderBottom = (cell) => cell.position === "bottom";
const isBorderBottomRight = (cell) => cell.position === "bottom_right";
const isBorderBottomLeft = (cell) => cell.position === "bottom_left";

// blank cells are fluid cells that will take whatever size they are requested to take
// they can seen as placeholders that are removed when a line or column is composed only by blank cells
// this is useful to enforce a given amount of line / columns that can be adjusted later if nothing use the reserved line/column
// (used to implement borders because any cell can suddenly enable a border meaning all previous cells must now have blank spaces
// where the border is)
const blankCell = {
  type: "blank",
  rects: [
    {
      width: "100%",
      height: "100%",
      render: ({ availableWidth, availableHeight }) => {
        let text = "";
        let y = 0;
        while (true) {
          text += " ".repeat(availableWidth);
          if (y === availableHeight - 1) {
            break;
          }
          text += "\n";
          y++;
        }
        return text;
      },
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
