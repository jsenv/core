// const someCellInColumn = (x, y, predicate) => {
//   let yNorth = y - 1;
//   while (yNorth >= 0) {
//     const cellAtNorth = grid[yNorth][x];
//     if (predicate(cellAtNorth)) {
//       return true;
//     }
//     yNorth--;
//   }
//   let ySouth = y + 1;
//   while (ySouth < grid.length) {
//     const cellAtSouth = grid[ySouth][x];
//     if (predicate(cellAtSouth)) {
//       return true;
//     }
//     ySouth++;
//   }

//   return false;
// };

// const getLeftCell = (cell) => {
//   const { x, y } = cell;
//   return x === 0 ? null : grid[y][x - 1];
// };
// const getRightCell = (cell) => {
//   const { x, y } = cell;
//   const cells = grid[y];
//   return cells[x + 1];
// };
// const getCellAbove = (cell) => {
//   const { x, y } = cell;
//   return y === 0 ? null : grid[y - 1][x];
// };
// const getCellBelow = (cell) => {
//   const { x, y } = cell;
//   const lineBelow = grid[y + 1];
//   return lineBelow ? lineBelow[x] : null;
// };

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
