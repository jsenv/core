import { ANSI, humanizeFileSize } from "@jsenv/humanize";
import stringWidth from "string-width";

export const renderTable = (
  lines,
  { ansi = true, leftSpacing = 1, rightSpacing = 1 } = {},
) => {
  const columnBiggestWidthArray = [];
  const createCell = (
    {
      value,
      bold,
      format,
      unit = format === "percentage" ? "%" : undefined,
      unitColor,
      quoteAroundStrings = !format,
      color,
      borderLeft,
      borderTop,
      borderRight,
      borderBottom,
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
    if (unit) {
      width += ` ${unit}`.length;
      if (ansi && unitColor) {
        unit = ANSI.color(unit, unitColor);
      }
      text += ` ${unit}`;
    }

    const biggestWidth = columnBiggestWidthArray[x] || 0;
    if (width > biggestWidth) {
      columnBiggestWidthArray[x] = width;
    }

    const cell = {
      isFirst: x === 0,
      isLast: false,
      x,
      y,
      value,
      text,
      width,
      borderLeft,
      borderTop,
      borderRight,
      borderBottom,
    };
    return cell;
  };

  const rows = [];
  {
    let y = 0;
    for (const line of lines) {
      const row = [];
      let lastCell;
      let x = 0;
      for (const cellProps of line) {
        const cell = createCell(cellProps, { x, y });
        lastCell = cell;
        row.push(cell);
        x++;
      }
      if (lastCell) {
        lastCell.isLast = true;
      }
      rows.push(row);
      y++;
    }
  }

  const getLeftCell = (cell) => {
    const { x, y } = cell;
    return x === 0 ? null : rows[y][x - 1];
  };
  const getRightCell = (cell) => {
    const { x, y } = cell;
    const cells = rows[y];
    return cells[x + 1];
  };
  const getCellAbove = (cell) => {
    const { x, y } = cell;
    return y === 0 ? null : rows[y - 1][x];
  };
  const getCellBelow = (cell) => {
    const { x, y } = cell;
    const rowBelow = rows[y + 1];
    return rowBelow ? rowBelow[x] : null;
  };
  const getCellWidth = (cell) => {
    return columnBiggestWidthArray[cell.x];
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
      text +=
        borderRight && borderTop
          ? "┬"
          : borderTop
            ? "─"
            : borderRight
              ? "│"
              : " ";
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
      text += borderBottom ? "├" : "─";
    } else if (cellBelow) {
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
      } else {
        text +=
          borderRight && borderBottom
            ? "┴"
            : borderBottom
              ? "─"
              : borderRight
                ? "│"
                : " ";
      }
    } else if (cellBelow) {
      if (cellBelow.borderRight && cellBelow.borderTop) {
        text += borderRight ? "┤" : "┐";
      } else if (cellBelow.borderTop) {
        text += borderRight ? "│" : "";
      } else {
        text += borderRight ? "┤" : "";
      }
    } else if (borderBottom && borderRight) {
      text += "┘";
    } else if (borderRight) {
      text += " ";
    }

    return text;
  };

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

  return log;
};

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
