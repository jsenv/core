import { ANSI, humanizeFileSize } from "@jsenv/humanize";
import stringWidth from "string-width";

export const renderTable = (inputGrid, { ansi = true } = {}) => {
  const grid = [];
  // inject borders
  {
    const injectionSet = new Set();
    const injectBorderCell = (contentCell, where, borderCell) => {
      injectionSet.add({ contentCell, where, borderCell });
    };

    let y = 0;
    for (const inputLine of inputGrid) {
      let x = 0;
      const line = [];
      for (const inputCell of inputLine) {
        const { borderLeft, borderTop, borderRight, borderBottom, ...props } =
          inputCell;
        const contentCell = { type: "content", x, y, props };
        if (borderLeft) {
          const borderLeftCell = { type: "border_left", value: "|" };
          injectBorderCell(contentCell, "left", borderLeftCell);
        }
        if (borderRight) {
          const borderRightCell = { type: "border_right", value: "|" };
          injectBorderCell(contentCell, "right", borderRightCell);
        }
        if (borderTop) {
          const borderTopCell = { type: "border_top", value: "-" };
          injectBorderCell(contentCell, "top", borderTopCell);
        }
        if (borderBottom) {
          const borderBottomCell = { type: "border_bottom", value: "-" };
          injectBorderCell(contentCell, "bottom", borderBottomCell);
        }
        line[x] = contentCell;
        x++;
      }
      grid[y] = line;
      y++;
    }

    // Line injections
    const lineInjectionMap = new Map();
    // Organize column injections by line and then by column position
    const columnInjectionsByLine = new Map();

    for (const injection of injectionSet) {
      const { borderCell, contentCell, where } = injection;

      if (where === "top" || where === "bottom") {
        const line = contentCell.y;
        const injectedLineIndex = where === "top" ? line : line + 1;
        let lineInjection = lineInjectionMap.get(injectedLineIndex);
        if (!lineInjection) {
          lineInjection = [];
          lineInjectionMap.set(injectedLineIndex, lineInjection);
        }
        lineInjection[contentCell.x] = borderCell;
      } else {
        // Handle column injections
        const lineIndex = contentCell.y;
        const column = contentCell.x;
        const injectedColumnIndex = where === "left" ? column : column + 1;

        // Get or create line map
        if (!columnInjectionsByLine.has(lineIndex)) {
          columnInjectionsByLine.set(lineIndex, []);
        }

        // Add injection to the appropriate line with its column position
        columnInjectionsByLine.get(lineIndex).push({
          columnIndex: injectedColumnIndex,
          borderCell,
        });
      }
    }

    // Process column injections line by line
    for (const [lineIndex, injections] of columnInjectionsByLine.entries()) {
      const line = grid[lineIndex];

      // Sort injections by column index for this specific line
      // injections.sort((a, b) => a.columnIndex - b.columnIndex);

      // Apply injections with cumulative offset
      let offset = 0;
      for (const { columnIndex, borderCell } of injections) {
        const x = columnIndex + offset;
        if (
          borderCell.type === "border_left" &&
          x > 0 &&
          line[x - 1] &&
          line[x - 1].type === "border_right"
        ) {
          // collapse borders
          continue;
        }
        line.splice(columnIndex + offset, 0, borderCell);
        offset++;
      }
    }

    let injectedLineCount = 0;
    for (const [indexToInjectLine, cells] of lineInjectionMap) {
      const [firstCell] = cells;
      const actualIndex = indexToInjectLine + injectedLineCount;
      if (
        firstCell.type === "border_top" &&
        y > 0 &&
        grid[y - 1][0].type === "border_bottom"
      ) {
        // collapse borders
        continue;
      }
      grid.splice(actualIndex, 0, cells);
      injectedLineCount++;
    }
  }

  // replace grid content wih cell objects
  {
    const columnBiggestWidthArray = [];
    const lineBiggestHeightArray = [];
    const getColumnWidth = (cell) => {
      return columnBiggestWidthArray[cell.x];
    };
    const getLineHeight = (cell) => {
      return lineBiggestHeightArray[cell.y];
    };

    const createCell = (
      {
        type = "content",
        value,
        bold,
        format,
        unit = format === "percentage" ? "%" : undefined,
        unitColor,
        quoteAroundStrings = type === "content" ? !format : false,
        color = type === "content" ? undefined : null,
        leftSpacing = type === "content" ? 1 : 0,
        rightSpacing = type === "content" ? 1 : 0,
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
        type,
        x,
        y,
        value,
        text,
        xAlign,
        yAlign,
        width,
        height,
        render: () => {
          let output = "";
          output += text;
          const columnWidth = getColumnWidth(cell);
          const lineHeight = getLineHeight(cell);
          if (xAlign === "start") {
            output += " ".repeat(columnWidth - cell.width);
          }
          if (yAlign === "start") {
            output += "\n".repeat(lineHeight - cell.height);
          }
          return output;
        },
      };

      return cell;
    };

    let y = 0;
    for (const line of grid) {
      let x = 0;
      for (const data of line) {
        const cell = createCell(data.type === "content" ? data.props : data, {
          x,
          y,
        });
        line[x] = cell;
        x++;
      }
      y++;
    }
  }

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

  // const renderCellTopBorder = (cell) => {
  //   const { borderTop, borderLeft, borderRight } = cell;
  //   const cellLeft = getLeftCell(cell);
  //   const cellAbove = getCellAbove(cell);
  //   const cellRight = getRightCell(cell);
  //   const hasBorderOnTheLeft = cellLeft && cellLeft.borderRight;
  //   const hasBorderOnTheRight = cellRight && cellRight.borderLeft;
  //   const hasBorderAbove = cellAbove && cellAbove.borderBottom;
  //   if (hasBorderAbove) {
  //     // already handled by the border above
  //     return "";
  //   }

  //   let text = "";
  //   if (hasBorderOnTheLeft) {
  //   } else if (borderTop && borderLeft) {
  //     text += "┌";
  //   } else if (borderLeft) {
  //     text += " ";
  //   }
  //   const columnWidth = getCellWidth(cell) + leftSpacing + rightSpacing;
  //   if (borderTop) {
  //     text += "─".repeat(columnWidth);
  //   } else {
  //     text += " ".repeat(columnWidth);
  //   }
  //   if (hasBorderOnTheRight) {
  //     if (borderRight && borderTop) {
  //       if (cellRight.borderTop) {
  //         text += "┬";
  //       } else {
  //         text += "┐";
  //       }
  //     } else if (borderRight) {
  //       if (cellRight.borderLeft && cellRight.borderTop) {
  //         text += "┌";
  //       } else {
  //         text += " ";
  //       }
  //     } else {
  //       text += " ";
  //     }
  //   } else if (borderRight && borderTop) {
  //     text += "┐";
  //   } else if (borderRight) {
  //     text += " ";
  //   }

  //   return text;
  // };
  // const renderCellBottomBorder = (cell) => {
  //   const { borderBottom, borderLeft, borderRight } = cell;
  //   const cellLeft = getLeftCell(cell);

  //   const cellBelow = getCellBelow(cell);
  //   const cellRight = getRightCell(cell);
  //   const hasBorderOnTheLeft = cellLeft && cellLeft.borderRight;
  //   const hasBorderOnTheRight = cellRight && cellRight.borderLeft;
  //   const hasBorderBelow = cellBelow && cellBelow.borderTop;

  //   let text = "";
  //   if (hasBorderOnTheLeft) {
  //   } else if (hasBorderBelow) {
  //     if (cellBelow.borderLeft && cellBelow.borderTop) {
  //       text += borderLeft ? "├" : "┌";
  //     } else if (cellBelow.borderTop) {
  //       text += borderLeft ? "│" : "";
  //     } else {
  //       text += borderLeft ? "├" : "";
  //     }
  //   } else if (borderBottom && borderLeft) {
  //     text += "└";
  //   } else if (borderLeft) {
  //     text += " ";
  //   } else if (someCellAboveOrBelowHasLeftBorder(cell)) {
  //     text += " ";
  //   }
  //   const columnWidth = getCellWidth(cell) + leftSpacing + rightSpacing;
  //   if (borderBottom) {
  //     text += "─".repeat(columnWidth);
  //   } else {
  //     text += " ".repeat(columnWidth);
  //   }
  //   if (hasBorderOnTheRight) {
  //     if (cellBelow && cellBelow.borderRight) {
  //       text += borderRight ? "┼" : "";
  //     } else if (borderRight && borderBottom) {
  //       if (cellRight.borderBottom && cellRight.borderLeft) {
  //         text += "┴";
  //       } else {
  //         text += "┘";
  //       }
  //     } else if (borderBottom) {
  //       text += "─";
  //     } else if (borderRight) {
  //       if (cellRight.borderBottom && cellRight.borderLeft) {
  //         text += "└";
  //       } else {
  //         text += " ";
  //       }
  //     }
  //   } else if (borderBottom && borderRight) {
  //     if (cellBelow && cellBelow.borderRight) {
  //       text += "┤";
  //     } else {
  //       text += "┘";
  //     }
  //   } else if (borderRight) {
  //     text += " ";
  //   }

  //   return text;
  // };

  let log = "";
  {
    let y = 0;
    for (const line of grid) {
      let lineText = "";
      for (const cell of line) {
        lineText += cell.render();
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

console.log(
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
  ]),
);

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
