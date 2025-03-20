/**
 * TODO:
 * - Les border doivent s'étendre pour prendre la place disponible dans la cellule
 * - Les borders doivent utilisé des forme spécial a leur extrémité
 */

import { ANSI, humanizeFileSize } from "@jsenv/humanize";
import stringWidth from "string-width";

export const renderTable = (inputGrid, { ansi = true } = {}) => {
  const grid = [];
  // inject borders
  {
    const blankCell = {
      type: "content",
      props: {
        value: ANSI.effect(" ", ANSI.underline),
        quoteAroundStrings: false,
      },
    };

    let y = 0;

    // const yWithSomeBorderTopSet = new Set();
    // const yWithSomeBottomSet = new Set();
    const xWithSomeBorderLeftSet = new Set();
    const xWithSomeBorderRightSet = new Set();

    for (const inputLine of inputGrid) {
      let x = 0;
      const line = [];
      const borderTopCells = [];
      const borderBottomCells = [];
      for (const inputCell of inputLine) {
        const { borderLeft, borderTop, borderRight, borderBottom, ...props } =
          inputCell;

        if (borderLeft) {
          const borderLeftCell = {
            type: "border",
            position: "left",
            value: "|",
          };
          line[x] = borderLeftCell;
          xWithSomeBorderLeftSet.add(x);
          x++;
        } else if (xWithSomeBorderLeftSet.has(x)) {
          line[x] = blankCell;
          x++;
        }

        if (borderTop) {
          const borderTopCell = { type: "border", position: "top", value: "-" };
          borderTopCells[x] = borderTopCell;
        }
        if (borderBottom) {
          const borderBottomCell = {
            type: "border",
            position: "bottom",
            value: "-",
          };
          borderBottomCells[x] = borderBottomCell;
        }
        const contentCell = { type: "content", x, y, props };
        line[x] = contentCell;
        x++;

        if (borderRight) {
          const borderRightCell = {
            type: "border",
            position: "right",
            value: "|",
          };
          line[x] = borderRightCell;
          xWithSomeBorderRightSet.add(x);
          x++;
        } else if (xWithSomeBorderRightSet.has(x)) {
          line[x] = blankCell;
          x++;
        }
      }

      if (borderTopCells.length > 0) {
        const topCells = [];
        {
          let x = 0;
          while (x < line.length) {
            const borderTopCell = borderTopCells[x];
            let topCell;
            if (borderTopCell) {
              topCell = borderTopCell;
            } else if (borderTopCells[x + 1]) {
              topCell = {
                type: "border",
                position: "top_left",
                value: "+",
              };
            } else {
              topCell = {
                type: "border",
                position: "top_right",
                value: "+",
              };
            }
            topCells[x] = topCell;
            x++;
          }
        }
        grid[y] = topCells;
        y++;
      }
      grid[y] = line;
      y++;
      if (borderBottomCells.length > 0) {
        const bottomCells = [];
        {
          let x = 0;
          while (x < line.length) {
            const borderBottomCell = borderBottomCells[x];
            let bottomCell;
            if (borderBottomCell) {
              bottomCell = borderBottomCell;
            } else if (borderBottomCells[x + 1]) {
              bottomCell = {
                type: "border",
                position: "bottom_left",
                value: "+",
              };
            } else {
              bottomCell = {
                type: "border",
                position: "bottom_right",
                value: "+",
              };
            }
            bottomCells[x] = bottomCell;
            x++;
          }
        }
        grid[y] = bottomCells;
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
      // {
      //   value: "1:2",
      //   borderTop: {},
      //   borderLeft: {},
      //   borderRight: {},
      //   borderBottom: {},
      // },
      // {
      //   value: "1:3",
      //   borderTop: {},
      //   // borderLeft: {},
      //   borderRight: {},
      //   borderBottom: {},
      // },
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
