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
            if (rightTopCell && rightTopCell.type === "border") {
              aboveCell = createTopLeftBorderCell();
            } else {
              const previousCell = topCells[x - 1];
              if (previousCell && previousCell.type === "border") {
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
            if (nextCell && nextCell.type === "border") {
              belowCell = createBottomLeftBorderCell();
            } else {
              const previousCell = bottomCells[x - 1];
              if (previousCell && previousCell.type === "border") {
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
    const canCollapseTwoCells = (left, right) => {
      if (left.type === "blank" && right.type === "blank") {
        return true;
      }
      if (left.type === "blank" && right.type === "border") {
        return true;
      }
      if (left.type === "border" && right.type === "blank") {
        return true;
      }
      if (left.type === "border" && right.type === "border") {
        // (later we'll check that border share size, color and styles)
        return true;
      }
      return false;
    };

    let x = 2;
    const columnCount = grid[0].length;
    while (x < columnCount - 1) {
      let canCollapseColumn = false;
      let y = 0;
      while (y < grid.length) {
        const columnCell = grid[y][x];
        const eastColumnCell = grid[y][x + 1];
        if (canCollapseTwoCells(columnCell, eastColumnCell)) {
          canCollapseColumn = true;
        } else {
          break;
        }
        y++;
      }
      if (canCollapseColumn) {
        let y = 0;
        while (y < grid.length) {
          const leftCell = grid[y][x];
          const rightCell = grid[y][x + 1];
          if (leftCell.type === "blank") {
            // left cell becomes right cell
            grid[y][x] = rightCell;
            // right cell becomes blank (it's redundant)
            grid[y][x + 1] = blankCell;
          } else if (rightCell.type === "blank") {
          } else {
            // right cell becomes blank (it's redundant)
            grid[y][x + 1] = blankCell;
          }
          y++;
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

      const [width, height] = cell.getSize();
      if (width > biggestWidth) {
        columnBiggestWidthArray[x] = width;
      }
      if (height > biggestHeight) {
        lineBiggestHeightArray[y] = height;
      }
      const cellNode = {
        render: () => {
          const availableWidth = columnBiggestWidthArray[x];
          const availableHeight = lineBiggestHeightArray[y];
          const renderResult = cell.render({
            availableWidth,
            availableHeight,
          });
          let text = renderResult;
          const { xAlign } = cell;
          if (xAlign) {
            text = applyXAlign(text, xAlign, availableWidth, width);
          }
          const { yAlign } = text;
          if (yAlign) {
            text = applyYAlign(text, yAlign, availableHeight, height);
          }
          return text;
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

  let width = stringWidth(text);
  if (leftSpacing) {
    width += leftSpacing;
    text = ` `.repeat(leftSpacing) + text;
  }
  if (unit) {
    width += ` ${unit}`.length;
    if (ansi && unitColor) {
      unit = ANSI.color(unit, unitColor);
    }
    text += ` ${unit}`;
  }
  if (rightSpacing) {
    width += rightSpacing;
    text += ` `.repeat(rightSpacing);
  }
  let height = text.split("\n").length;
  if (topSpacing) {
    height += topSpacing;
    text = `\n`.repeat(topSpacing) + text;
  }
  if (bottomSpacing) {
    height += bottomSpacing;
    text += `\n`.repeat(bottomSpacing);
  }

  return {
    type: "content",
    value,
    xAlign,
    yAlign,
    getSize: () => {
      return [width, height];
    },
    render: () => {
      return text;
    },
  };
};
const applyXAlign = (text, xAlign, availableWidth, width) => {
  if (xAlign === "start") {
    return text + " ".repeat(availableWidth - width);
  }
  if (xAlign === "end") {
    return " ".repeat(availableWidth - width) + text;
  }
  return text;
};
const applyYAlign = (text, yAlign, availableHeight, height) => {
  if (yAlign === "start") {
    return text + "\n".repeat(availableHeight - height);
  }
  if (yAlign === "end") {
    return "\n".repeat(availableHeight - height) + text;
  }
  return text;
};

const BORDER_CHARS = {
  top: "─",
  left: "│",
  bottom: "─",
  right: "│",
  top_left: "┌",
  top_right: "┐",
  bottom_right: "┘",
  bottom_left: "└",
};
const createBorderCell = ({ position, char }) => {
  const size = [stringWidth(char), char.split("\n").length];

  return {
    type: "border",
    position,
    xAlign:
      position === "top_left" || position === "bottom_left"
        ? "start"
        : position === "top_right" || position === "bottom_right"
          ? "end"
          : undefined,
    yAlign:
      position === "top_left" || position === "top_right"
        ? "start"
        : position === "bottom_left" || position === "bottom_right"
          ? "end"
          : undefined,
    getSize: () => size,
    render: ({ availableWidth, availableHeight }) => {
      if (position === "left") {
        return char.repeat(availableWidth);
      }
      if (position === "right") {
        return char.repeat(availableWidth);
      }
      if (position === "top" || position === "bottom") {
        let text = "";
        let y = 0;
        while (true) {
          text += char.repeat(availableWidth);
          if (y === availableHeight - 1) {
            break;
          }
          text += "\n";
          y++;
        }
        return text;
      }
      return char;
    },
  };
};
const createBorderLeftCell = () => {
  return createBorderCell({
    position: "left",
    char: BORDER_CHARS.left,
  });
};
const createBorderTopCell = () => {
  return createBorderCell({
    position: "top",
    char: BORDER_CHARS.top,
  });
};
const createBorderBottomCell = () => {
  return createBorderCell({
    position: "bottom",
    char: BORDER_CHARS.bottom,
  });
};
const createBorderRightCell = () => {
  return createBorderCell({
    position: "right",
    char: BORDER_CHARS.right,
  });
};
const createTopLeftBorderCell = () => {
  return createBorderCell({
    position: "top_left",
    char: BORDER_CHARS.top_left,
  });
};
const createTopRightBorderCell = () => {
  return createBorderCell({
    position: "top_right",
    char: BORDER_CHARS.top_right,
  });
};
const createBottomRightBorderCell = () => {
  return createBorderCell({
    position: "bottom_right",
    char: BORDER_CHARS.bottom_right,
  });
};
const createBottomLeftBorderCell = () => {
  return createBorderCell({
    position: "bottom_left",
    char: BORDER_CHARS.bottom_left,
  });
};
const isBorderTopLeft = (cell) => cell.position === "top_left";
const isBorderTopRight = (cell) => cell.position === "top_right";
const isBorderLeft = (cell) => cell.position === "left";
const isBorderRight = (cell) => cell.position === "right";
// const isBorderTop = (cell) => cell.position === "top";
// const isBorderBottom = (cell) => cell.position === "bottom";
const isBorderBottomRight = (cell) => cell.position === "bottom_right";
const isBorderBottomLeft = (cell) => cell.position === "bottom_left";

// blank cells are fluid cells that will take whatever size they are requested to take
// they can seen as placeholders that are removed when a line or column is composed only by blank cells
// this is useful to enforce a given amount of line / columns that can be adjusted later if nothing use the reserved line/column
// (used to implement borders because any cell can suddenly enable a border meaning all previous cells must now have blank spaces
// where the border is)
const blankCell = {
  type: "blank",
  value: "",
  getSize: () => [0, 0],
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
