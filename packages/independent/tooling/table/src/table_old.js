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

// // remove lines that are only blank cells (no visible borders)
// {
//   let y = 0;
//   while (y < grid.length) {
//     const line = grid[y];
//     let lineContainsNonBlankCell = false;
//     for (const cell of line) {
//       if (isBlankCell(cell)) {
//         continue;
//       }
//       lineContainsNonBlankCell = true;
//       break;
//     }
//     if (lineContainsNonBlankCell) {
//       y++;
//       continue;
//     }
//     grid.splice(y, 1);
//   }
// }
// // remove columns that are only blank cells (no visible borders)
// {
//   let x = 0;
//   let columnCount = grid[0].length;
//   while (x < columnCount) {
//     let columnContainsNonBlankCell = false;
//     let y = 0;
//     while (y < grid.length) {
//       const columnCell = grid[y][x];
//       if (isBlankCell(columnCell)) {
//         y++;
//         continue;
//       }
//       columnContainsNonBlankCell = true;
//       break;
//     }
//     if (columnContainsNonBlankCell) {
//       x++;
//       continue;
//     }
//     // get rid of this cell on every line (remove the full column)
//     y = 0;
//     while (y < grid.length) {
//       const line = grid[y];
//       line.splice(x, 1);
//       columnCount--;
//       y++;
//     }
//   }
// }

// const getWestCell = (cell, { x, y, rowType }) => {
//     if (isContent(cell)) {
//       const borderLeftColumn = borderLeftColumnMap.get(x);
//       const borderLeftCell = borderLeftColumn ? borderLeftColumn[y] : null;
//       if (borderLeftCell) {
//         return borderLeftCell;
//       }
//       const westColumnBorderRightColumn = borderRightColumnMap.get(x - 1);
//       if (westColumnBorderRightColumn) {
//         return westColumnBorderRightColumn[y] || blankCell;
//       }
//       const westContentCell = x === 0 ? null : grid[y][x - 1];
//       return westContentCell;
//     }
//     if (isBorderLeft(cell)) {
//       if (rowType === "border_top") {
//         const borderTopRow = borderTopRowMap.get(y);
//         return borderTopRow[x - 1];
//       }
//       if (rowType === "border_bottom") {
//         const borderBottomRow = borderBottomRowMap.get(y);
//         const westBorderBottomCell = borderBottomRow[x - 1];
//         return westBorderBottomCell || blankCell;
//       }

//       // west is left column border right or left column content
//       const borderRightColumn = borderRightColumnMap.get(x - 1);
//       if (borderRightColumn) {
//         return borderRightColumn[y] || blankCell;
//       }
//       return grid[y][x - 1];
//     }
//     if (isBorderRight(cell)) {
//       if (rowType === "border_top") {
//         const borderTopRow = borderTopRowMap.get(y);
//         return borderTopRow[x] || blankCell;
//       }
//       if (rowType === "border_bottom") {
//         const borderBottomRow = borderBottomRowMap.get(y);
//         return borderBottomRow[x] || blankCell;
//       }
//       return grid[y][x];
//     }
//     if (isBorderTop(cell)) {
//       // west is border top of left column
//       const borderTopRow = borderTopRowMap.get(y);
//       return x === 0 ? null : borderTopRow[x - 1] || blankCell;
//     }
//     if (isBorderBottom(cell)) {
//       // west is border bottom of left column
//       const borderBottomRow = borderBottomRowMap.get(y);
//       return x === 0 ? null : borderBottomRow[x - 1] || blankCell;
//     }
//     return null;
//   };
//   const getEastCell = (cell, { x, y, rowType }) => {
//     if (isContent(cell)) {
//       const borderRightColumn = borderRightColumnMap.get(x);
//       const borderRightCell = borderRightColumn ? borderRightColumn[y] : null;
//       if (borderRightCell) {
//         return borderRightCell;
//       }
//       const eastColumnBorderLeftColumn = borderLeftColumnMap.get(x + 1);
//       if (eastColumnBorderLeftColumn) {
//         return eastColumnBorderLeftColumn[y] || blankCell;
//       }
//       const eastContentCell = grid[y][x + 1];
//       return eastContentCell;
//     }
//     if (isBorderLeft(cell)) {
//       if (rowType === "border_top") {
//         const borderTopRow = borderTopRowMap.get(y);
//         return borderTopRow[x];
//       }
//       if (rowType === "border_bottom") {
//         const borderBottomRow = borderBottomRowMap.get(y);
//         return borderBottomRow[x];
//       }
//       // east is content cell
//       return grid[y][x];
//     }
//     if (isBorderRight(cell)) {
//       if (rowType === "border_top") {
//         const borderTopRow = borderTopRowMap.get(y);
//         return borderTopRow[x + 1];
//       }
//       if (rowType === "border_bottom") {
//         const borderBottomRow = borderBottomRowMap.get(y);
//         return borderBottomRow[x + 1];
//       }
//       // east is border left of next column or next content cell
//       const eastBorderLeftColumn = borderLeftColumnMap.get(x + 1);
//       if (eastBorderLeftColumn) {
//         return eastBorderLeftColumn[y] || blankCell;
//       }
//       return grid[y][x + 1];
//     }
//     if (isBorderTop(cell)) {
//       // east is border top of next column
//       const borderTopRow = borderTopRowMap.get(y);
//       return x === grid[0].length - 1 ? null : borderTopRow[x + 1] || blankCell;
//     }
//     if (isBorderBottom(cell)) {
//       const borderBottomRow = borderBottomRowMap.get(y);
//       return x === grid[0].length - 1
//         ? null
//         : borderBottomRow[x + 1] || blankCell;
//     }
//     return null;
//   };
//   const getNorthCell = (cell, { x, y, rowType }) => {
//     if (isContent(cell)) {
//       const borderTopRow = borderTopRowMap.get(y);
//       const borderTopCell = borderTopRow ? borderTopRow[y] : null;
//       if (borderTopCell) {
//         return borderTopCell;
//       }
//       const northRowBorderBottomRow = borderBottomRowMap.get(y - 1);
//       if (northRowBorderBottomRow) {
//         return northRowBorderBottomRow[x] || blankCell;
//       }
//       const northContentCell = y === 0 ? null : grid[y - 1][x];
//       return northContentCell;
//     }
//     if (isBorderLeft(cell)) {
//       if (rowType === "border_top") {
//         const borderLeftColumn = borderLeftColumnMap.get(x);
//         return y === 0 ? null : borderLeftColumn[y - 1];
//       }
//       if (rowType === "border_bottom") {
//         const borderLeftColumn = borderLeftColumnMap.get(x);
//         return borderLeftColumn[y - 1];
//       }
//       // north is border top of this cell
//       const borderTopRow = borderTopRowMap.get(y);
//       if (borderTopRow) {
//         return borderTopRow[x] || blankCell;
//       }
//       const northBorderBottomRow = borderBottomRowMap.get(y - 1);
//       if (northBorderBottomRow) {
//         return northBorderBottomRow[x] || blankCell;
//       }
//       return y === 0 ? null : grid[y - 1][x];
//     }
//     if (isBorderRight(cell)) {
//       // north is border top or bottom above or content above
//       const borderTopRow = borderTopRowMap.get(y);
//       if (borderTopRow) {
//         return borderTopRow[x] || blankCell;
//       }
//       const northBorderBottomRow = borderBottomRowMap.get(y - 1);
//       if (northBorderBottomRow) {
//         return northBorderBottomRow[x] || blankCell;
//       }
//       return y === 0 ? null : grid[y - 1][x];
//     }
//     if (isBorderTop(cell)) {
//       // north is border bottom or row above or content above
//       const northRowBorderBottomRow = borderBottomRowMap.get(y - 1);
//       if (northRowBorderBottomRow) {
//         return northRowBorderBottomRow[x] || blankCell;
//       }
//       return y === 0 ? null : grid[y - 1][x];
//     }
//     if (isBorderBottom(cell)) {
//       // north is content
//       return grid[y][x];
//     }
//     return null;
//   };
//   const getSouthCell = (cell, { x, y, rowType }) => {
//     if (isContent(cell)) {
//       const borderBottomRow = borderBottomRowMap.get(y);
//       const borderBottomCell = borderBottomRow ? borderBottomRow[y] : null;
//       if (borderBottomCell) {
//         return borderBottomCell;
//       }
//       const southBorderTopRow = borderTopRowMap.get(y + 1);
//       if (southBorderTopRow) {
//         return southBorderTopRow[x] || blankCell;
//       }
//       const southContentCell = y === grid.length - 1 ? null : grid[y + 1][x];
//       return southContentCell;
//     }
//     if (isBorderLeft(cell)) {
//       if (rowType === "border_top") {
//         const borderLeftColumn = borderLeftColumnMap.get(x);
//         return borderLeftColumn[y + 1];
//       }
//       if (rowType === "border_bottom") {
//         const nextRowBorderTopRow = borderTopRowMap.get(y + 1);
//         if (nextRowBorderTopRow) {
//           return nextRowBorderTopRow[x] || blankCell;
//         }
//         const borderLeftColumn = borderLeftColumnMap.get(x);
//         return borderLeftColumn[y + 1];
//       }
//       // south is border bottom or top below or content below
//       const borderBottomRow = borderBottomRowMap.get(y);
//       if (borderBottomRow) {
//         return borderBottomRow[x] || blankCell;
//       }
//       const southBorderTopRow = borderTopRowMap.get(y + 1);
//       if (southBorderTopRow) {
//         return southBorderTopRow[x] || blankCell;
//       }
//       return y === grid.length - 1 ? null : grid[y + 1][x];
//     }
//     if (isBorderRight(cell)) {
//       // south is border bottom or top below or content below
//       const borderBottomRow = borderBottomRowMap.get(y);
//       if (borderBottomRow) {
//         return borderBottomRow[x] || blankCell;
//       }
//       const southBorderTopRow = borderTopRowMap.get(y + 1);
//       if (southBorderTopRow) {
//         return southBorderTopRow[x] || blankCell;
//       }
//       return y === grid.length - 1 ? null : grid[y + 1][x];
//     }
//     if (isBorderTop(cell)) {
//       // south is content
//       return grid[y][x];
//     }
//     if (isBorderBottom(cell)) {
//       // south is border top of next row or next content
//       const southRowBorderTopRow = borderTopRowMap.get(y + 1);
//       if (southRowBorderTopRow) {
//         return southRowBorderTopRow[x] || blankCell;
//       }
//       return y === grid.length - 1 ? null : grid[y + 1][x];
//     }
//     return null;
//   };
