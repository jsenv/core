import { ANSI, humanizeFileSize } from "@jsenv/humanize";
import stringWidth from "string-width";

export const renderTable = ({ head, body, foot }) => {
  const columnBiggestWidthArray = [];
  const rows = [];
  const appendRow = (rowProps) => {
    const cells = [];
    const y = rows.length;
    const appendCell = (cellProps) => {
      const props = {
        ...rowProps,
        ...cellProps,
      };
      let {
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
      } = props;

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

      if (bold) {
        text = ANSI.color(text, ANSI.BOLD);
      }
      if (color) {
        text = ANSI.color(text, color);
      }

      let width = stringWidth(text);
      if (unit) {
        width += ` ${unit}`.length;
        if (unitColor) {
          unit = ANSI.color(unit, unitColor);
        }
        text += ` ${unit}`;
      }

      const x = cells.length;
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
      cells.push(cell);
      return cell;
    };

    const close = () => {
      cells[cells.length - 1].isLast = true;
    };

    const row = {
      y,
      cells,
      appendCell,
      close,
    };
    rows.push(row);
    return row;
  };

  if (head) {
    const headRow = appendRow({
      quoteAroundStrings: false,
      borderTop: { color: null },
      borderBottom: { color: null },
      borderLeft: { color: null },
      borderRight: { color: null },
    });
    thead: {
      for (const cellProps of head) {
        headRow.appendCell(cellProps);
      }
      headRow.close();
    }
  }
  tbody: {
    let bodyLastRow;
    for (const object of body) {
      const bodyRow = appendRow({
        borderLeft: { color: null },
        borderRight: { color: null },
      });
      bodyLastRow = bodyRow;
      for (const headCellProps of head) {
        const propName = headCellProps.value;
        const bodyCellProps = object[propName] || { value: undefined };
        bodyRow.appendCell(bodyCellProps);
      }
      bodyRow.close();
    }
    if (bodyLastRow) {
      for (const bodyLastRowCell of bodyLastRow.cells) {
        if (bodyLastRowCell.borderBottom === undefined) {
          bodyLastRowCell.borderBottom = { color: null };
        }
      }
    }
  }
  if (foot) {
    const footRow = appendRow({
      quoteAroundStrings: false,
      borderBottom: { color: null },
      borderLeft: { color: null },
      borderRight: { color: null },
    });
    for (const fooCellProps of foot) {
      footRow.appendCell(fooCellProps);
    }
    footRow.close();
  }

  const leftSpacing = 1;
  const rightSpacing = 1;

  const getLeftCell = (cell) => {
    const { x, y } = cell;
    return x === 0 ? null : rows[y].cells[x - 1];
  };
  const getRightCell = (cell) => {
    const { x, y } = cell;
    const cells = rows[y].cells;
    return cells[x + 1];
  };
  const getCellAbove = (cell) => {
    const { x, y } = cell;
    return y === 0 ? null : rows[y - 1].cells[x];
  };
  const getCellBelow = (cell) => {
    const { x, y } = cell;
    const rowBelow = rows[y + 1];
    return rowBelow ? rowBelow.cells[x] : null;
  };
  const getCellWidth = (cell) => {
    return columnBiggestWidthArray[cell.x];
  };

  const renderCellTopBorder = (cell) => {
    const { borderTop, borderLeft, borderRight } = cell;
    if (!borderTop) {
      return " ".repeat(getCellWidth(cell) + leftSpacing + rightSpacing + 2);
    }
    let text = "";

    const cellLeft = getLeftCell(cell);
    const cellAbove = getCellAbove(cell);
    const cellBelow = getCellBelow(cell);
    const cellRight = getRightCell(cell);

    const hasBorderOnTheLeft = cellLeft && cellLeft.borderRight;
    const hasBorderOnTheRight = cellRight && cellRight.borderLeft;
    const hasBorderAbove = cellAbove && cellAbove.borderBottom;
    const hasBorderBelow = cellBelow && cellBelow.borderTop;

    if (hasBorderOnTheLeft) {
    } else if (hasBorderAbove) {
    } else {
      text += borderLeft ? "┌" : "─";
    }
    text += "─".repeat(getCellWidth(cell) + leftSpacing + rightSpacing);
    if (hasBorderOnTheRight) {
      text +=
        borderRight && borderTop
          ? "┬"
          : borderTop
            ? "─"
            : borderRight
              ? "│"
              : " ";
    } else if (hasBorderBelow) {
    } else {
      text += borderRight ? "┐" : "─";
    }

    return text;
  };

  const renderCellBottomBorder = (cell) => {
    const { borderBottom, borderLeft, borderRight } = cell;
    if (!borderBottom) {
      return " ".repeat(getCellWidth(cell) + leftSpacing + rightSpacing + 2);
    }
    let text = "";

    const cellLeft = getLeftCell(cell);
    const cellAbove = getCellAbove(cell);
    const cellBelow = getCellBelow(cell);
    const cellRight = getRightCell(cell);

    const hasBorderOnTheLeft = cellLeft && cellLeft.borderRight;
    const hasBorderOnTheRight = cellRight && cellRight.borderLeft;
    const hasBorderAbove = cellAbove && cellAbove.borderBottom;
    const hasBorderBelow = cellBelow && cellBelow.borderTop;

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
    }
    text += "─".repeat(getCellWidth(cell) + leftSpacing + rightSpacing);
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
    } else if (hasBorderBelow) {
    } else {
      text += borderRight ? "┘" : "─";
    }

    return text;
  };

  let log = "";
  for (const row of rows) {
    const { cells } = row;
    let lineAbove = "";
    let lineBelow = "";
    let line = "";
    for (const cell of cells) {
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
    log += "\n";
    if (lineBelow.trim()) {
      log += lineBelow;
      log += "\n";
    }
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
