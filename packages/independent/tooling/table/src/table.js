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
            text += char;
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
    return createBorderCell({ position: "left", char: "│" });
  };
  const createBorderTopCell = () => {
    return createBorderCell({ position: "top", char: "─" });
  };
  const createBorderBottomCell = () => {
    return createBorderCell({ position: "bottom", char: "─" });
  };
  const createBorderRightCell = () => {
    return createBorderCell({ position: "right", char: "│" });
  };
  const createTopLeftBorderCell = () => {
    return createBorderCell({ position: "top_left", char: "┌" });
  };
  const createTopRightBorderCell = () => {
    return createBorderCell({ position: "top_right", char: "┐" });
  };
  const createBottomRightBorderCell = () => {
    return createBorderCell({ position: "bottom_right", char: "┘" });
  };
  const createBottomLeftBorderCell = () => {
    return createBorderCell({ position: "bottom_left", char: "└" });
  };

  const createContentCell = ({
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
  }) => {
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
        const contentCell = createContentCell(props);
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
            const nextCell = topCells[x + 1];
            if (nextCell && nextCell.type === "border") {
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
      //   // borderRight: {},
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
