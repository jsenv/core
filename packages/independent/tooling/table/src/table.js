/**
 * TODO:
 * - Les border doivent s'étendre pour prendre la place disponible dans la cellule
 * - Les borders doivent utilisé des forme spécial a leur extrémité
 */

import { ANSI, humanizeFileSize } from "@jsenv/humanize";
import stringWidth from "string-width";

export const renderTable = (inputGrid, { ansi = true } = {}) => {
  const grid = [];

  const blankCell = {
    type: "blank",
    value: "",
  };

  // inject borders
  {
    const createBorderLeftCell = () => {
      return {
        type: "border",
        position: "left",
        value: "|",
      };
    };
    const createBorderTopCell = () => {
      return {
        type: "border",
        position: "top",
        value: "-",
      };
    };
    const createBorderBottomCell = () => {
      return {
        type: "border",
        position: "bottom",
        value: "-",
      };
    };
    const createBorderRightCell = () => {
      return {
        type: "border",
        position: "right",
        value: "-",
      };
    };

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
        const contentCell = { type: "content", ...props };
        line[x] = contentCell;
        x++;

        const rightCell = borderRight
          ? createBorderRightCell(borderRight)
          : blankCell;
        line[x] = rightCell;
        x++;
      }

      const lineAbove = [];
      {
        let x = 0;
        while (x < line.length) {
          const topCell = topCells[x];
          let aboveCell;
          if (topCell) {
            aboveCell = topCell;
          } else {
            aboveCell = blankCell;
          }
          lineAbove[x] = aboveCell;
          x++;
        }
      }
      grid[y] = lineAbove;
      y++;

      grid[y] = line;
      y++;

      const lineBelow = [];
      {
        let x = 0;
        while (x < line.length) {
          const bottomCell = bottomCells[x];
          let belowCell;
          if (bottomCell) {
            belowCell = bottomCell;
          } else {
            belowCell = blankCell;
          }
          lineBelow[x] = belowCell;
          x++;
        }
      }
      grid[y] = lineBelow;
      y++;
    }
  }

  // remove lines that have no visible borders
  // lines mixing visible and disabled borders will be rendered and disabled border will be rendered using blank chars
  {
    let y = 0;
    while (y < grid.length) {
      const line = grid[y];
      const [firstCell] = line;
      if (firstCell.type === "content") {
        y++;
        continue;
      }
      let hasVisibleBorder = false;
      for (const cell of line) {
        if (cell.color === ANSI.RED) {
          continue;
        }
        hasVisibleBorder = true;
        break;
      }
      if (hasVisibleBorder) {
        y++;
        continue;
      }
      grid.splice(y, 1);
    }
  }
  // remove columns that have no visible borders
  {
    let x = 0;
    const firstLine = grid[0];
    while (x < firstLine.length) {
      const cell = firstLine[0];
      if (cell.type === "content") {
        x++;
        continue;
      }
      let hasVisibleBorder = false;
      let y = 0;
      while (y < grid.length) {
        const cellBelow = grid[y][x];
        if (cellBelow.color === ANSI.RED) {
          y++;
          continue;
        }
        hasVisibleBorder = true;
        break;
      }
      if (hasVisibleBorder) {
        x++;
        continue;
      }
      // get rid of this cell on every line (remove the full column)
      y = 0;
      while (y < grid.length) {
        const line = grid[y];
        line.splice(x, 0);
        y++;
      }
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
        const cell = createCell(data, { x, y });
        line[x] = cell;
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
        // borderRight: {},
        borderBottom: {},
      },
      {
        value: "1:3",
        borderTop: {},
        // borderLeft: {},
        borderRight: {},
        borderBottom: {},
      },
    ],
    // [
    //   {
    //     value: "2:1",
    //     borderTop: {},
    //     borderLeft: {},
    //     borderRight: {},
    //     borderBottom: {},
    //   },
    //   {
    //     value: "2:2",
    //     borderTop: {},
    //     borderLeft: {},
    //     borderRight: {},
    //     borderBottom: {},
    //   },
    //   {
    //     value: "2:3",
    //     borderTop: {},
    //     borderLeft: {},
    //     borderRight: {},
    //     borderBottom: {},
    //   },
    // ],
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
