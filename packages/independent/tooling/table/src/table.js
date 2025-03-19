import { ANSI, humanizeFileSize } from "@jsenv/humanize";
import stringWidth from "string-width";

export const renderTable = (inputGrid, { ansi = true } = {}) => {
  const columnBiggestWidthArray = [];
  const lineBiggestHeightArray = [];
  const createCell = (
    {
      value,
      bold,
      format,
      unit = format === "percentage" ? "%" : undefined,
      unitColor,
      quoteAroundStrings = !format,
      color = format ? null : undefined,
      borderLeft,
      borderTop,
      borderRight,
      borderBottom,
      leftSpacing = 1,
      rightSpacing = 1,
      topSpacing = 0,
      bottomSpacing = 0,
      xAlign = "start", // "start", "center", "end"
      yAlign = "start", // "start", "center", "end"
    },
    { x, y },
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

    const biggestWidth = columnBiggestWidthArray[x] || 0;
    if (width > biggestWidth) {
      columnBiggestWidthArray[x] = width;
    }
    const biggestHeight = lineBiggestHeightArray[y] || 0;
    if (height > biggestHeight) {
      lineBiggestHeightArray[y] = height;
    }

    const cell = {
      isFirst: x === 0,
      isLast: false,
      x,
      y,
      value,
      text,
      xAlign,
      yAlign,
      width,
      height,
      borderLeft,
      borderTop,
      borderRight,
      borderBottom,
    };
    return cell;
  };

  // const grid = [];
  // {
  //   let y = 0;
  //   for (const inputLine of inputGrid) {
  //     const line = [];
  //     let lastCell;
  //     let x = 0;
  //     for (const inputCell of inputLine) {
  //       const cell = { inputCell };
  //       lastCell = cell;
  //       line[x] = cell;
  //       x++;
  //     }
  //     if (lastCell) {
  //       lastCell.isLast = true;
  //     }
  //     grid[y] = line;
  //     y++;
  //   }
  // }
  const getLeftCell = (cell) => {
    const { x, y } = cell;
    return x === 0 ? null : grid[y][x - 1];
  };
  const getRightCell = (cell) => {
    const { x, y } = cell;
    const cells = grid[y];
    return cells[x + 1];
  };
  const getCellAbove = (cell) => {
    const { x, y } = cell;
    return y === 0 ? null : grid[y - 1][x];
  };
  const getCellBelow = (cell) => {
    const { x, y } = cell;
    const lineBelow = grid[y + 1];
    return lineBelow ? lineBelow[x] : null;
  };

  const grid = [];
  // inject top and bottom lines
  {
    const injectionSet = new Set();
    const injectCell = (cellToInject, cell, where) => {
      injectionSet.add({ cellToInject, cell, where });
    };

    let y = 0;
    for (const inputLine of inputGrid) {
      let x = 0;
      const line = [];
      for (const inputCell of inputLine) {
        const { borderLeft, borderTop, borderRight, borderBottom, ...props } =
          inputCell;
        const cell = { x, y, props };
        if (borderLeft) {
          const borderLeftCell = { type: "border_left", value: "|" };
          injectCell(borderLeftCell, cell, "left");
        }
        if (borderRight) {
          const borderRightCell = { type: "border_right", value: "|" };
          injectCell(borderRightCell, cell, "right");
        }
        if (borderTop) {
          const borderTopCell = { value: "border top" };
          injectCell(borderTopCell, cell, "top");
        }
        if (borderBottom) {
          const borderBottomCell = { value: "border bottom" };
          injectCell(borderBottomCell, cell, "bottom");
        }
        line[x] = cell;
        x++;
      }
      grid[y] = line;
      y++;
    }

    // Line injections (for completeness, though not modified in this example)
    const lineInjectionMap = new Map();

    // Organize column injections by line and then by column position
    const columnInjectionsByLine = new Map();

    for (const injection of injectionSet) {
      const { cellToInject, cell, where } = injection;

      if (where === "top" || where === "bottom") {
        const line = cell.y;
        const injectedLineIndex = where === "top" ? line - 1 : line + 1;
        let lineInjection = lineInjectionMap.get(injectedLineIndex);
        if (!lineInjection) {
          lineInjection = [];
          lineInjectionMap.set(injectedLineIndex, lineInjection);
        }
        lineInjection[cell.x] = cellToInject;
      } else {
        // Handle column injections
        const lineIndex = cell.y;
        const column = cell.x;
        const injectedColumnIndex = where === "left" ? column : column + 1;

        // Get or create line map
        if (!columnInjectionsByLine.has(lineIndex)) {
          columnInjectionsByLine.set(lineIndex, []);
        }

        // Add injection to the appropriate line with its column position
        columnInjectionsByLine.get(lineIndex).push({
          columnIndex: injectedColumnIndex,
          cellToInject,
        });
      }
    }

    // Process column injections line by line
    for (const [lineIndex, injections] of columnInjectionsByLine.entries()) {
      const line = grid[lineIndex];

      // Sort injections by column index for this specific line
      injections.sort((a, b) => a.columnIndex - b.columnIndex);

      // Apply injections with cumulative offset
      let offset = 0;
      for (const { columnIndex, cellToInject } of injections) {
        const x = columnIndex + offset;
        if (
          cellToInject.type === "border_left" &&
          x > 0 &&
          line[x - 1].type === "border_right"
        ) {
          // collapse borders
          continue;
        }
        line.splice(columnIndex + offset, 0, cellToInject);
        offset++;
      }
    }

    let injectedLineCount = 0;
    for (const [indexToInjectLine, cells] of lineInjectionMap) {
      const [firstCell] = cells;
      if (
        firstCell.type === "border_top" &&
        y > 0 &&
        grid[y - 1][0].type === "border_bottom"
      ) {
        // collapse borders
        // continue;
      }
      grid.splice(indexToInjectLine + injectedLineCount, 0, cells);
      injectedLineCount++;
    }
  }

  grid;
  debugger;
  const getCellWidth = (cell) => {
    return columnBiggestWidthArray[cell.x];
  };
  const getCellHeight = (cell) => {
    return lineBiggestHeightArray[cell.y];
  };

  const renderCellTopBorder = (cell) => {
    const { borderTop, borderLeft, borderRight } = cell;
    const cellLeft = getLeftCell(cell);
    const cellAbove = getCellAbove(cell);
    const cellRight = getRightCell(cell);
    const hasBorderOnTheLeft = cellLeft && cellLeft.borderRight;
    const hasBorderOnTheRight = cellRight && cellRight.borderLeft;
    const hasBorderAbove = cellAbove && cellAbove.borderBottom;
    if (hasBorderAbove) {
      // already handled by the border above
      return "";
    }

    let text = "";
    if (hasBorderOnTheLeft) {
    } else if (borderTop && borderLeft) {
      text += "┌";
    } else if (borderLeft) {
      text += " ";
    }
    const columnWidth = getCellWidth(cell) + leftSpacing + rightSpacing;
    if (borderTop) {
      text += "─".repeat(columnWidth);
    } else {
      text += " ".repeat(columnWidth);
    }
    if (hasBorderOnTheRight) {
      if (borderRight && borderTop) {
        if (cellRight.borderTop) {
          text += "┬";
        } else {
          text += "┐";
        }
      } else if (borderRight) {
        if (cellRight.borderLeft && cellRight.borderTop) {
          text += "┌";
        } else {
          text += " ";
        }
      } else {
        text += " ";
      }
    } else if (borderRight && borderTop) {
      text += "┐";
    } else if (borderRight) {
      text += " ";
    }

    return text;
  };
  const renderCellBottomBorder = (cell) => {
    const { borderBottom, borderLeft, borderRight } = cell;
    const cellLeft = getLeftCell(cell);

    const cellBelow = getCellBelow(cell);
    const cellRight = getRightCell(cell);
    const hasBorderOnTheLeft = cellLeft && cellLeft.borderRight;
    const hasBorderOnTheRight = cellRight && cellRight.borderLeft;
    const hasBorderBelow = cellBelow && cellBelow.borderTop;

    let text = "";
    if (hasBorderOnTheLeft) {
    } else if (hasBorderBelow) {
      if (cellBelow.borderLeft && cellBelow.borderTop) {
        text += borderLeft ? "├" : "┌";
      } else if (cellBelow.borderTop) {
        text += borderLeft ? "│" : "";
      } else {
        text += borderLeft ? "├" : "";
      }
    } else if (borderBottom && borderLeft) {
      text += "└";
    } else if (borderLeft) {
      text += " ";
    } else if (someCellAboveOrBelowHasLeftBorder(cell)) {
      text += " ";
    }
    const columnWidth = getCellWidth(cell) + leftSpacing + rightSpacing;
    if (borderBottom) {
      text += "─".repeat(columnWidth);
    } else {
      text += " ".repeat(columnWidth);
    }
    if (hasBorderOnTheRight) {
      if (cellBelow && cellBelow.borderRight) {
        text += borderRight ? "┼" : "";
      } else if (borderRight && borderBottom) {
        if (cellRight.borderBottom && cellRight.borderLeft) {
          text += "┴";
        } else {
          text += "┘";
        }
      } else if (borderBottom) {
        text += "─";
      } else if (borderRight) {
        if (cellRight.borderBottom && cellRight.borderLeft) {
          text += "└";
        } else {
          text += " ";
        }
      }
    } else if (borderBottom && borderRight) {
      if (cellBelow && cellBelow.borderRight) {
        text += "┤";
      } else {
        text += "┘";
      }
    } else if (borderRight) {
      text += " ";
    }

    return text;
  };

  {
    let log = "";
    let y = 0;
    for (const row of rows) {
      let lineAbove = "";
      let lineBelow = "";
      let line = "";
      for (const cell of row) {
        const biggestWidth = columnBiggestWidthArray[cell.x];
        const leftCell = getLeftCell(cell);
        const hasBorderOnTheLeft = leftCell && leftCell.borderRight;
        if (cell.borderLeft && !hasBorderOnTheLeft) {
          line += "│";
        } else if (someCellAboveOrBelowHasLeftBorder(cell)) {
          line += " ";
        }
        lineAbove += renderCellTopBorder(cell);
        lineBelow += renderCellBottomBorder(cell);
        line += " ".repeat(leftSpacing);
        line += cell.text;
        line += " ".repeat(rightSpacing);
        line += " ".repeat(biggestWidth - cell.width);
        // const rightCell = getRightCell(cell);
        // const hasBorderOnTheRight = rightCell && rightCell.borderLeft;
        if (cell.borderRight) {
          line += "│";
        } else if (someCellAboveOrBelowHasRightBorder(cell)) {
          line += " ";
        }
      }
      if (lineAbove.trim()) {
        log += lineAbove;
        log += "\n";
      }
      log += line;
      if (lineBelow.trim()) {
        log += "\n";
        log += lineBelow;
      }
      if (y === rows.length - 1) {
        break;
      }
      log += "\n";
      y++;
    }
  }

  return log;
};

renderTable([
  [
    {
      value: "1:1",
      borderTop: {},
      borderLeft: {},
      borderRight: {},
      borderBottom: {},
    },
    {
      value: "1:2",
      borderTop: {},
      borderLeft: {},
      borderRight: {},
      borderBottom: {},
    },
    {
      value: "1:3",
      borderTop: {},
      borderLeft: {},
      borderRight: {},
      borderBottom: {},
    },
  ],
  [
    {
      value: "2:1",
      borderTop: {},
      borderLeft: {},
      borderRight: {},
      borderBottom: {},
    },
    {
      value: "2:2",
      borderTop: {},
      borderLeft: {},
      borderRight: {},
      borderBottom: {},
    },
    {
      value: "2:3",
      borderTop: {},
      borderLeft: {},
      borderRight: {},
      borderBottom: {},
    },
  ],
]);

// console.log(
//   renderTable({
//     head: ["name", "long_name", "percentage"],
//     body: [
//       { name: "dam", long_name: 120, percentage: "56.0" },
//       { name: "seb", long_name: 10, percentage: "56.0" },
//     ],
//     // foot: [],
//   }),
// );

// console.log(
//   renderTable({
//     head: [
//       { value: "name", bold: true },
//       { value: "long_name", bold: true },
//       //  { value: "percentage", bold: true },
//     ],
//     body: [
//       {
//         name: { value: "dam" },
//         long_name: { value: 120 },
//         percentage: { value: "56.0" },
//       },
//       // {
//       //   name: { value: "seb" },
//       //   long_name: { value: 10 },
//       //   percentage: { value: "56.0", format: "percentage" },
//       // },
//     ],
//     // foot: [
//     //   { value: "hey", bold: true },
//     //   { value: "hey", bold: true },
//     //   // { value: "hey", bold: true },
//     // ],
//   }),
// );
