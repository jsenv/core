import stringWidth from "string-width";
import { ANSI } from "../ansi/ansi_node.js";
import { humanizeFileSize } from "../byte/byte.js";

export const renderTable = ({ head, body, foot }) => {
  const columnBiggestWidthArray = [];
  const createCell = (cellProps, { isHead, isFoot, x, y }) => {
    let {
      value,
      bold,
      format,
      unit = format === "percentage" ? "%" : undefined,
      unitColor,
      quoteAroundStrings = !format && !isHead && !isFoot,
      color,
    } = cellProps;

    let valueFormatted;
    if (typeof value === "string") {
      if (quoteAroundStrings) {
        valueFormatted = `"${value}"`;
        if (color === undefined) {
          color = ANSI.GREEN;
        }
      } else {
        valueFormatted = value;
      }
    } else if (typeof value === "number") {
      if (format === "size") {
        valueFormatted = humanizeFileSize(value);
      } else {
        valueFormatted = String(value);
        if (color === undefined) {
          color = ANSI.YELLOW;
        }
      }
    } else {
      valueFormatted = value;
    }

    if (bold) {
      valueFormatted = ANSI.color(valueFormatted, ANSI.BOLD);
    }
    if (color) {
      valueFormatted = ANSI.color(valueFormatted, color);
    }

    let width = stringWidth(valueFormatted);
    if (unit) {
      width += ` ${unit}`.length;
      if (unitColor) {
        unit = ANSI.color(unit, unitColor);
      }
      valueFormatted += ` ${unit}`;
    }

    const biggestWidth = columnBiggestWidthArray[x] || 0;
    if (width > biggestWidth) {
      columnBiggestWidthArray[x] = width;
    }

    return {
      valueRaw: value,
      x,
      y,
      value: valueFormatted,
      width,
      isHead,
      isFoot,
    };
  };

  const rows = [];
  if (head) {
    const headRow = {
      cells: [],
      borderTop: true,
      borderBottom: true,
    };
    thead: {
      let x = 0;
      for (const cellProps of head) {
        const headerCell = createCell(cellProps, {
          isHead: true,
          x,
          y: 0,
        });
        headRow.cells.push(headerCell);
        x++;
      }
    }
    rows.push(headRow);
  }
  tbody: {
    const bodyRows = [];
    let y = rows.length;
    for (const object of body) {
      const bodyRow = { cells: [] };
      let x = 0;
      for (const headCellProps of head) {
        const propName = headCellProps.value;
        const bodyCellProps = object[propName] || { value: undefined };
        const bodyCell = createCell(bodyCellProps, {
          x,
          y,
        });
        bodyRow.cells.push(bodyCell);
        x++;
      }
      y++;
      bodyRows.push(bodyRow);
    }
    rows.push(...bodyRows);
    rows[rows.length - 1].borderBottom = true;
  }
  if (foot) {
    const footRow = {
      cells: [],
      borderBottom: true,
    };
    let y = rows.length;
    let x = 0;
    for (const fooCellProps of foot) {
      const footCell = createCell(fooCellProps, {
        isFoot: true,
        x,
        y,
      });
      footRow.cells.push(footCell);
      x++;
    }
    rows.push(footRow);
  }

  const leftSpacing = 1;
  const rightSpacing = 1;

  let log = "";
  let y = 0;
  while (y < rows.length) {
    const row = rows[y];
    if (row.borderTop) {
      let topBorder = "";
      topBorder += "┌";
      let x = 0;
      while (x < columnBiggestWidthArray.length) {
        const columnWidth = columnBiggestWidthArray[x];
        topBorder += `${"─".repeat(columnWidth + leftSpacing + rightSpacing)}`;
        if (x < columnBiggestWidthArray.length - 1) {
          topBorder += "┬";
        }
        x++;
      }
      topBorder += "┐";
      log += topBorder;
      log += "\n";
    }
    const cells = row.cells;
    let line = "";
    let x = 0;
    while (x < cells.length) {
      const cell = cells[x];
      const biggestWidth = columnBiggestWidthArray[x];
      line += " ";
      line += cell.value; // if number use yellow, if string use green
      line += " ";
      line += " ".repeat(biggestWidth - cell.width);
      if (x === cells.length - 1) {
        break;
      }
      line += "│";
      x++;
    }
    log += "│";
    log += line;
    log += "│";
    log += "\n";

    if (row.borderBottom) {
      if (y === rows.length - 1) {
        // last line
        let bottomBorder = "";
        let x = 0;
        while (x < columnBiggestWidthArray.length) {
          const columnWidth = columnBiggestWidthArray[x];
          bottomBorder += `${"─".repeat(columnWidth + leftSpacing + rightSpacing)}`;
          if (x < columnBiggestWidthArray.length - 1) {
            bottomBorder += "┴";
          }
          x++;
        }
        log += "└";
        log += bottomBorder;
        log += "┘";
        log += "\n";
      } else {
        let middleBorder = "";
        {
          let x = 0;
          while (x < columnBiggestWidthArray.length) {
            const columnWidth = columnBiggestWidthArray[x];
            middleBorder += `${"─".repeat(columnWidth + leftSpacing + rightSpacing)}`;
            if (x < columnBiggestWidthArray.length - 1) {
              middleBorder += "┼";
            }
            x++;
          }
        }
        log += "├";
        log += middleBorder;
        log += "┤";
        log += "\n";
      }
    }
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
//       { value: "percentage", bold: true },
//     ],
//     body: [
//       {
//         name: { value: "dam" },
//         long_name: { value: 120 },
//         percentage: { value: "56.0" },
//       },
//       {
//         name: { value: "seb" },
//         long_name: { value: 10 },
//         percentage: { value: "56.0", format: "percentage" },
//       },
//     ],
//     foot: [
//       { value: "hey", bold: true },
//       { value: "hey", bold: true },
//       { value: "hey", bold: true },
//     ],
//   }),
// );
