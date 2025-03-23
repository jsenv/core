// // collapse left and right borders
// {
//   // if every right border can collapse with the left border next to it
//   // then we collapse all right borders of the column
//   const getHowToCollapseAdjacentCells = (leftCell, rightCell) => {
//     if (isBlankCell(leftCell)) {
//       return [
//         // left cell becomes right cell
//         rightCell,
//         // right cell becomes blank (it's redundant)
//         blankCell,
//       ];
//     }
//     if (isBlankCell(rightCell)) {
//       // keep as it is
//       return [leftCell, rightCell];
//     }
//     if (isBorderTopRight(leftCell) && isBorderTopLeft(rightCell)) {
//       return [
//         createTopMidBorderCell({ color: leftCell.color }),
//         blankCell, // merged into the left cell
//       ];
//     }
//     if (isBorderBottomRight(leftCell) && isBorderBottomLeft(rightCell)) {
//       return [
//         createBottomMidBorderCell({ color: leftCell.color }),
//         blankCell, // merged into the left cell
//       ];
//     }
//     if (isBorderRight(leftCell) && isBorderLeft(rightCell)) {
//       return [
//         leftCell,
//         blankCell, // merged into the left cell
//       ];
//     }

//     return null;
//   };

//   let x = 2;
//   const columnCount = grid[0].length;
//   while (x < columnCount - 1) {
//     let hasConlict;
//     let y = 0;
//     const collapseInfoSet = new Set();
//     while (y < grid.length) {
//       const columnCell = grid[y][x];
//       const eastColumnCell = grid[y][x + 1];
//       const howToCollapseCells = getHowToCollapseAdjacentCells(
//         columnCell,
//         eastColumnCell,
//         x,
//         y,
//       );
//       if (!howToCollapseCells) {
//         hasConlict = true;
//         break;
//       }
//       collapseInfoSet.add({ x, y, howToCollapseCells });
//       y++;
//     }
//     if (!hasConlict) {
//       for (const collapseInfo of collapseInfoSet) {
//         const { x, y, howToCollapseCells } = collapseInfo;
//         const collapsedCells = Array.isArray(howToCollapseCells)
//           ? howToCollapseCells
//           : howToCollapseCells();
//         const [leftCollapsed, rightCollapsed] = collapsedCells;
//         grid[y][x] = leftCollapsed;
//         grid[y][x + 1] = rightCollapsed;
//       }
//     }
//     x += 3;
//   }
// }
// // collapse top and bottom borders
// {
//   const getHowToCollapseAdjacentCells = (cell, cellBelow, x, y) => {
//     if (
//       isBorderBottom(cell) &&
//       x % 3 === 0 && // there is a bottom left every 3 column
//       y <= grid.length - 2 &&
//       isBlankCell(grid[y + 1][x]) &&
//       isBorderLeft(grid[y + 2][x]) // south south cell is a border left
//     ) {
//       return [createTopLeftBorderCell(), cellBelow];
//     }
//     if (
//       isBorderTop(cellBelow) &&
//       x % 3 === 0 &&
//       y > 1 &&
//       isBorderLeft(grid[y - 1][x]) // north cell is a border left
//     ) {
//       return [createBottomLeftBorderCell(), cell];
//     }
//     if (isBlankCell(cell)) {
//       return [
//         cellBelow, // cell becomes cell below
//         blankCell, // cell below becomes blank
//       ];
//     }
//     if (isBlankCell(cellBelow)) {
//       return [
//         // keep both as is
//         cell,
//         cellBelow,
//       ];
//     }
//     if (isBorderTopRight(cell) && isBorderTopLeft(cellBelow)) {
//       return [
//         createTopMidBorderCell({ color: cell.color }),
//         blankCell, // merged into the top cell
//       ];
//     }
//     if (isBorderBottomRight(cell) && isBorderBottomLeft(cellBelow)) {
//       return [
//         createBottomMidBorderCell({ color: cell.color }),
//         blankCell, // merged into the cell
//       ];
//     }
//     if (isBorderBottomLeft(cell) && isBorderTopLeft(cellBelow)) {
//       return [
//         createLeftMidBorderCell({ color: cell.color }),
//         blankCell, // merged into the cell
//       ];
//     }
//     if (isBorderBottomRight(cell) && isBorderTopRight(cellBelow)) {
//       return [
//         createRightMidBorderCell({ color: cell.color }),
//         blankCell, // merged into the cell
//       ];
//     }
//     if (isBorderBottomRight(cell) && isBorderTop(cellBelow)) {
//       return [
//         cell,
//         blankCell, // merged into the cell
//       ];
//     }
//     if (isBorderBottom(cell) && isBorderTopLeft(cellBelow)) {
//       return [
//         cellBelow,
//         blankCell, // merged into the top cell
//       ];
//     }
//     if (isBorderBottom(cell) && isBorderTop(cellBelow)) {
//       return [
//         cell,
//         blankCell, // merged into the top cell
//       ];
//     }
//     return null;
//   };

//   let y = 2;
//   const lineCount = grid.length;
//   while (y < lineCount - 1) {
//     let hasConflict;
//     let x = 0;
//     const line = grid[y];
//     const lineBelow = grid[y + 1];
//     const collapseInfoSet = new Set();
//     while (x < line.length) {
//       const cell = line[x];
//       const cellBelow = lineBelow[x];
//       const howToCollapseCells = getHowToCollapseAdjacentCells(
//         cell,
//         cellBelow,
//         x,
//         y,
//       );
//       if (!howToCollapseCells) {
//         hasConflict = true;
//         break;
//       }
//       collapseInfoSet.add({ x, y, howToCollapseCells });
//       x++;
//     }
//     if (!hasConflict) {
//       for (const collapseInfo of collapseInfoSet) {
//         const { x, y, howToCollapseCells } = collapseInfo;
//         const collapsedCells = Array.isArray(howToCollapseCells)
//           ? howToCollapseCells
//           : howToCollapseCells();
//         const [cellCollapsed, cellBelowCollapsed] = collapsedCells;
//         grid[y][x] = cellCollapsed;
//         grid[y + 1][x] = cellBelowCollapsed;
//       }
//     }
//     y += 3;
//   }
// }
