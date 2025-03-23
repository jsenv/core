/**
 *
 * https://www.w3schools.com/charsets/ref_utf_box.asp
 * https://github.com/Automattic/cli-table
 *
 * remaining:
 * border collapse on advanced scenario
 * border color conflicts
 * ability to control border chars
 * multiline (for later)
 */

import { ANSI, humanizeFileSize } from "@jsenv/humanize";
import stringWidth from "string-width";

export const renderTable = (inputGrid, { ansi = true } = {}) => {
  const grid = [];

  const borderTopRowMap = new Map();
  const borderBottomRowMap = new Map();
  const borderLeftColumnMap = new Map();
  const borderRightColumnMap = new Map();
  const onBorderTop = (borderTop, x, y) => {
    const borderTopCell = createBorderTop(borderTop);
    const borderTopArray = borderTopRowMap.get(y);
    if (!borderTopArray) {
      const array = [];
      borderTopRowMap.set(y, array);
      array[x] = borderTopCell;
    } else {
      borderTopArray[x] = borderTopCell;
    }
  };
  const onBorderBottom = (borderBottom, x, y) => {
    const borderBottomCell = createBorderBottom(borderBottom);
    const borderBottomArray = borderBottomRowMap.get(y);
    if (!borderBottomArray) {
      const array = [];
      borderBottomRowMap.set(y, array);
      array[x] = borderBottomCell;
    } else {
      borderBottomArray[x] = borderBottomCell;
    }
  };
  const onBorderLeft = (borderLeft, x, y) => {
    const borderLeftCell = createBorderLeft(borderLeft);
    const borderLeftArray = borderLeftColumnMap.get(x);
    if (!borderLeftArray) {
      const array = [];
      borderLeftColumnMap.set(x, array);
      array[y] = borderLeftCell;
    } else {
      borderLeftArray[x] = borderLeftCell;
    }
  };
  const onBorderRight = (borderRight, x, y) => {
    const borderRightCell = createBorderRight(borderRight);
    const borderRightArray = borderRightColumnMap.get(x);
    if (!borderRightArray) {
      const array = [];
      borderRightColumnMap.set(x, array);
      array[y] = borderRightCell;
    } else {
      borderRightArray[x] = borderRightCell;
    }
  };
  // detect borders
  {
    let y = 0;
    for (const inputRow of inputGrid) {
      let x = 0;
      const row = [];
      for (const inputCell of inputRow) {
        const {
          border,
          borderLeft = border,
          borderTop = border,
          borderRight = border,
          borderBottom = border,
          ...props
        } = inputCell;
        const contentCell = createContentCell(props, { ansi });
        row[x] = contentCell;
        if (borderLeft) {
          contentCell.borderLeft = borderLeft;
          onBorderLeft(borderLeft, x, y);
        }
        if (borderTop) {
          contentCell.borderTop = borderTop;
          onBorderTop(borderTop, x, y);
        }
        if (borderBottom) {
          contentCell.borderBottom = borderBottom;
          onBorderBottom(borderBottom, x, y);
        }
        if (borderRight) {
          contentCell.borderRight = borderRight;
          onBorderRight(borderRight, x, y);
        }
        x++;
      }
      grid[y] = row;
      y++;
    }
  }

  // fill border row and columns with blank cells
  {
    for (const [, borderLeftColumn] of borderLeftColumnMap) {
      let y = 0;
      while (y < grid.length) {
        const borderLeft = grid[y];
        if (!borderLeft) {
          borderLeftColumn[y] = blankCell;
        }
        y++;
      }
    }
    for (const [, borderRightColumn] of borderRightColumnMap) {
      let y = 0;
      while (y < grid.length) {
        const borderRight = grid[y];
        if (!borderRight) {
          borderRightColumn[y] = blankCell;
        }
        y++;
      }
    }
    for (const [, borderTopRow] of borderTopRowMap) {
      let x = 0;
      while (x < grid[0].length) {
        const borderTop = borderTopRow[x];
        if (!borderTop) {
          borderTopRow[x] = blankCell;
        }
        x++;
      }
    }
    for (const [, borderBottomRow] of borderBottomRowMap) {
      let x = 0;
      while (x < grid[0].length) {
        const borderBottom = borderBottomRow[x];
        if (!borderBottom) {
          borderBottomRow[x] = blankCell;
        }
        x++;
      }
    }
  }

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

  // measure column and row dimensions (biggest of all cells in the column/row)
  const columnWidthMap = new Map();
  const rowHeightMap = new Map();
  {
    const measureCell = (cell) => {
      const {
        rects,
        leftSpacing = 0,
        rightSpacing = 0,
        topSpacing = 0,
        bottomSpacing = 0,
      } = cell;
      let cellWidth = -1;
      for (const rect of rects) {
        let { width } = rect;
        if (width === "fill") {
          continue;
        }
        if (leftSpacing || rightSpacing) {
          width += leftSpacing + rightSpacing;
          rect.width = width;
          const { render } = rect;
          rect.render = (...args) => {
            const text = render(...args);
            return " ".repeat(leftSpacing) + text + " ".repeat(rightSpacing);
          };
        }
        if (width > cellWidth) {
          cellWidth = width;
        }
      }
      if (topSpacing) {
        let lineToInsertAbove = topSpacing;
        while (lineToInsertAbove--) {
          rects.unshift({
            width: "fill",
            render: ({ columnWidth }) => " ".repeat(columnWidth),
          });
        }
      }
      if (bottomSpacing) {
        let lineToInsertBelow = bottomSpacing;
        while (lineToInsertBelow--) {
          rects.push({
            width: "fill",
            render: ({ columnWidth }) => " ".repeat(columnWidth),
          });
        }
      }
      const cellHeight = rects.length;

      return [cellWidth, cellHeight];
    };

    let y = 0;
    for (const line of grid) {
      let x = 0;
      for (const cell of line) {
        const columnWidth = columnWidthMap.get(x) || -1;
        const rowHeight = rowHeightMap.get(y) || -1;
        const [cellWidth, cellHeight] = measureCell(cell);
        if (cellWidth > columnWidth) {
          columnWidthMap.set(x, cellWidth);
        }
        if (cellHeight > rowHeight) {
          rowHeightMap.set(y, cellHeight);
        }
        x++;
      }
      y++;
    }
  }

  const getWestCell = (cell, { x, y, rowType }) => {
    if (isContent(cell)) {
      const borderLeftColumn = borderLeftColumnMap.get(x);
      const borderLeftCell = borderLeftColumn ? borderLeftColumn[y] : null;
      if (borderLeftCell) {
        return borderLeftCell;
      }
      const westColumnBorderRightColumn = borderRightColumnMap.get(x - 1);
      if (westColumnBorderRightColumn) {
        return westColumnBorderRightColumn[y] || blankCell;
      }
      const westContentCell = x === 0 ? null : grid[y][x - 1];
      return westContentCell;
    }
    if (isBorderLeft(cell)) {
      if (rowType === "border_top") {
        const borderTopRow = borderTopRowMap.get(y);
        return borderTopRow[x - 1];
      }
      if (rowType === "border_bottom") {
        const borderBottomRow = borderBottomRowMap.get(y);
        const westBorderBottomCell = borderBottomRow[x - 1];
        return westBorderBottomCell || blankCell;
      }

      // west is left column border right or left column content
      const borderRightColumn = borderRightColumnMap.get(x - 1);
      if (borderRightColumn) {
        return borderRightColumn[y] || blankCell;
      }
      return grid[y][x - 1];
    }
    if (isBorderRight(cell)) {
      if (rowType === "border_top") {
        const borderTopRow = borderTopRowMap.get(y);
        return borderTopRow[x] || blankCell;
      }
      if (rowType === "border_bottom") {
        const borderBottomRow = borderBottomRowMap.get(y);
        return borderBottomRow[x] || blankCell;
      }
      return grid[y][x];
    }
    if (isBorderTop(cell)) {
      // west is border top of left column
      const borderTopRow = borderTopRowMap.get(y);
      return x === 0 ? null : borderTopRow[x - 1] || blankCell;
    }
    if (isBorderBottom(cell)) {
      // west is border bottom of left column
      const borderBottomRow = borderBottomRowMap.get(y);
      return x === 0 ? null : borderBottomRow[x - 1] || blankCell;
    }
    return null;
  };
  const getEastCell = (cell, { x, y, rowType }) => {
    if (isContent(cell)) {
      const borderRightColumn = borderRightColumnMap.get(x);
      const borderRightCell = borderRightColumn ? borderRightColumn[y] : null;
      if (borderRightCell) {
        return borderRightCell;
      }
      const eastColumnBorderLeftColumn = borderLeftColumnMap.get(x + 1);
      if (eastColumnBorderLeftColumn) {
        return eastColumnBorderLeftColumn[y] || blankCell;
      }
      const eastContentCell = grid[y][x + 1];
      return eastContentCell;
    }
    if (isBorderLeft(cell)) {
      if (rowType === "border_top") {
        const borderTopRow = borderTopRowMap.get(y);
        return borderTopRow[x];
      }
      if (rowType === "border_bottom") {
        const borderBottomRow = borderBottomRowMap.get(y);
        return borderBottomRow[x];
      }
      // east is content cell
      return grid[y][x];
    }
    if (isBorderRight(cell)) {
      if (rowType === "border_top") {
        const borderTopRow = borderTopRowMap.get(y);
        return borderTopRow[x + 1];
      }
      if (rowType === "border_bottom") {
        const borderBottomRow = borderBottomRowMap.get(y);
        return borderBottomRow[x + 1];
      }
      // east is border left of next column or next content cell
      const eastBorderLeftColumn = borderLeftColumnMap.get(x + 1);
      if (eastBorderLeftColumn) {
        return eastBorderLeftColumn[y] || blankCell;
      }
      return grid[y][x + 1];
    }
    if (isBorderTop(cell)) {
      // east is border top of next column
      const borderTopRow = borderTopRowMap.get(y);
      return x === grid[0].length - 1 ? null : borderTopRow[x + 1] || blankCell;
    }
    if (isBorderBottom(cell)) {
      const borderBottomRow = borderBottomRowMap.get(y);
      return x === grid[0].length - 1
        ? null
        : borderBottomRow[x + 1] || blankCell;
    }
    return null;
  };
  const getNorthCell = (cell, { x, y, rowType }) => {
    if (isContent(cell)) {
      const borderTopRow = borderTopRowMap.get(y);
      const borderTopCell = borderTopRow ? borderTopRow[y] : null;
      if (borderTopCell) {
        return borderTopCell;
      }
      const northRowBorderBottomRow = borderBottomRowMap.get(y - 1);
      if (northRowBorderBottomRow) {
        return northRowBorderBottomRow[x] || blankCell;
      }
      const northContentCell = y === 0 ? null : grid[y - 1][x];
      return northContentCell;
    }
    if (isBorderLeft(cell)) {
      if (rowType === "border_top") {
        const borderLeftColumn = borderLeftColumnMap.get(x);
        return y === 0 ? null : borderLeftColumn[y - 1];
      }
      if (rowType === "border_bottom") {
        const borderLeftColumn = borderLeftColumnMap.get(x);
        return borderLeftColumn[y - 1];
      }
      // north is border top of this cell
      const borderTopRow = borderTopRowMap.get(y);
      if (borderTopRow) {
        return borderTopRow[x] || blankCell;
      }
      const northBorderBottomRow = borderBottomRowMap.get(y - 1);
      if (northBorderBottomRow) {
        return northBorderBottomRow[x] || blankCell;
      }
      return y === 0 ? null : grid[y - 1][x];
    }
    if (isBorderRight(cell)) {
      // north is border top or bottom above or content above
      const borderTopRow = borderTopRowMap.get(y);
      if (borderTopRow) {
        return borderTopRow[x] || blankCell;
      }
      const northBorderBottomRow = borderBottomRowMap.get(y - 1);
      if (northBorderBottomRow) {
        return northBorderBottomRow[x] || blankCell;
      }
      return y === 0 ? null : grid[y - 1][x];
    }
    if (isBorderTop(cell)) {
      // north is border bottom or row above or content above
      const northRowBorderBottomRow = borderBottomRowMap.get(y - 1);
      if (northRowBorderBottomRow) {
        return northRowBorderBottomRow[x] || blankCell;
      }
      return y === 0 ? null : grid[y - 1][x];
    }
    if (isBorderBottom(cell)) {
      // north is content
      return grid[y][x];
    }
    return null;
  };
  const getSouthCell = (cell, { x, y, rowType }) => {
    if (isContent(cell)) {
      const borderBottomRow = borderBottomRowMap.get(y);
      const borderBottomCell = borderBottomRow ? borderBottomRow[y] : null;
      if (borderBottomCell) {
        return borderBottomCell;
      }
      const southBorderTopRow = borderTopRowMap.get(y + 1);
      if (southBorderTopRow) {
        return southBorderTopRow[x] || blankCell;
      }
      const southContentCell = y === grid.length - 1 ? null : grid[y + 1][x];
      return southContentCell;
    }
    if (isBorderLeft(cell)) {
      if (rowType === "border_top") {
        const borderLeftColumn = borderLeftColumnMap.get(x);
        return borderLeftColumn[y + 1];
      }
      if (rowType === "border_bottom") {
        const nextRowBorderTopRow = borderTopRowMap.get(y + 1);
        if (nextRowBorderTopRow) {
          return nextRowBorderTopRow[x] || blankCell;
        }
        const borderLeftColumn = borderLeftColumnMap.get(x);
        return borderLeftColumn[y + 1];
      }
      // south is border bottom or top below or content below
      const borderBottomRow = borderBottomRowMap.get(y);
      if (borderBottomRow) {
        return borderBottomRow[x] || blankCell;
      }
      const southBorderTopRow = borderTopRowMap.get(y + 1);
      if (southBorderTopRow) {
        return southBorderTopRow[x] || blankCell;
      }
      return y === grid.length - 1 ? null : grid[y + 1][x];
    }
    if (isBorderRight(cell)) {
      // south is border bottom or top below or content below
      const borderBottomRow = borderBottomRowMap.get(y);
      if (borderBottomRow) {
        return borderBottomRow[x] || blankCell;
      }
      const southBorderTopRow = borderTopRowMap.get(y + 1);
      if (southBorderTopRow) {
        return southBorderTopRow[x] || blankCell;
      }
      return y === grid.length - 1 ? null : grid[y + 1][x];
    }
    if (isBorderTop(cell)) {
      // south is content
      return grid[y][x];
    }
    if (isBorderBottom(cell)) {
      // south is border top of next row or next content
      const southRowBorderTopRow = borderTopRowMap.get(y + 1);
      if (southRowBorderTopRow) {
        return southRowBorderTopRow[x] || blankCell;
      }
      return y === grid.length - 1 ? null : grid[y + 1][x];
    }
    return null;
  };

  const getContentCells = ({ x, y }) => {
    const cell = grid[y][x];
    const west = x === 0 ? null : grid[y][x - 1];
    const east = x === grid[0].length - 1 ? null : grid[y][x + 1];
    const north = y === 0 ? null : grid[y - 1][x];
    const south = y === grid.length - 1 ? null : grid[y + 1][x];
    return { cell, west, east, north, south };
  };

  // render table
  let log = "";
  {
    const renderRow = (cells, { rowType, rowHeight }) => {
      let rowText = "";
      let lastLineIndex = rowHeight;
      let lineIndex = 0;
      while (lineIndex !== lastLineIndex) {
        let x = 0;
        let lineText = "";
        for (const cell of cells) {
          const westCell = getWestCell(cell, { x, y, rowType });
          const eastCell = getEastCell(cell, { x, y, rowType });
          const northCell = getNorthCell(cell, { x, y, rowType });
          const southCell = getSouthCell(cell, { x, y, rowType });
          const cellLineText = renderCell(cell, {
            columnWidth: columnWidthMap.get(x),
            rowHeight,
            lineIndex,
            contentCells: getContentCells({ x, y }),
            westCell,
            eastCell,
            northCell,
            southCell,
          });
          let borderLeftLineText;
          let borderRightLineText;
          const borderLeftColumn = borderLeftColumnMap.get(x);
          if (borderLeftColumn) {
            const borderLeftCell = borderLeftColumn[y];
            if (borderLeftCell) {
              const westCell = getWestCell(borderLeftCell, { x, y, rowType });
              const eastCell = getEastCell(borderLeftCell, { x, y, rowType });
              const northCell = getNorthCell(borderLeftCell, { x, y, rowType });
              const southCell = getSouthCell(borderLeftCell, { x, y, rowType });
              borderLeftLineText = renderCell(borderLeftCell, {
                isTopLeftCorner: rowType === "border_top",
                isBottomLeftCorner: rowType === "border_bottom",
                columnWidth: 1,
                rowHeight,
                lineIndex,
                contentCells: getContentCells({ x, y }),
                westCell,
                eastCell,
                northCell,
                southCell,
              });
            }
          }
          const borderRightColumn = borderRightColumnMap.get(x);
          if (borderRightColumn) {
            const borderRightCell = borderRightColumn[y];
            if (borderRightCell) {
              const westCell = getWestCell(borderRightCell, { x, y, rowType });
              const eastCell = getEastCell(borderRightCell, { x, y, rowType });
              const northCell = getNorthCell(borderRightCell, {
                x,
                y,
                rowType,
              });
              const southCell = getSouthCell(borderRightCell, {
                x,
                y,
                rowType,
              });
              borderRightLineText = renderCell(borderRightCell, {
                isTopRightCorner: rowType === "border_top",
                isBottomRightCorner: rowType === "border_bottom",
                columnWidth: 1,
                rowHeight,
                lineIndex,
                contentCells: getContentCells({ x, y }),
                westCell,
                eastCell,
                northCell,
                southCell,
              });
            }
          }
          if (borderLeftLineText && borderRightLineText) {
            lineText += borderLeftLineText + cellLineText + borderRightLineText;
          } else if (borderLeftLineText) {
            lineText += borderLeftLineText + cellLineText;
          } else if (borderRightLineText) {
            lineText += cellLineText + borderRightLineText;
          } else {
            lineText += cellLineText;
          }
          x++;
        }
        rowText += lineText;
        lineIndex++;
        rowText += "\n";
      }
      return rowText;
    };
    const renderCell = (
      cell,
      { columnWidth, rowHeight, lineIndex, ...rest },
    ) => {
      let { xAlign, xAlignChar = " ", yAlign, yAlignChar = " ", rects } = cell;
      const cellHeight = rects.length;

      let rect;
      if (yAlign === "start") {
        if (lineIndex < cellHeight) {
          rect = rects[lineIndex];
        }
      } else if (yAlign === "center") {
        const topSpacing = Math.floor((rowHeight - cellHeight) / 2);
        // const bottomSpacing = rowHeight - cellHeight - topSpacing;
        const lineStartIndex = topSpacing;
        const lineEndIndex = topSpacing + cellHeight;
        if (lineIndex > lineStartIndex && lineIndex < lineEndIndex) {
          rect = rects[lineIndex];
        }
      } else {
        const lineStartIndex = rowHeight - cellHeight;
        if (lineIndex >= lineStartIndex) {
          rect = rects[lineIndex];
        }
      }

      if (rect) {
        const { width, render } = rect;
        let rectText = render({
          columnWidth,
          ...rest,
          updateOptions: (options) => {
            if (options.xAlign) {
              xAlign = options.xAlign;
            }
            if (options.xAlignChar) {
              xAlignChar = options.xAlignChar;
            }
            if (options.yAlign) {
              yAlign = options.yAlign;
            }
            if (options.yAlignChar) {
              yAlignChar = options.yAlignChar;
            }
          },
        });
        if (width === "fill") {
          return rectText;
        }
        return applyXAlign(rectText, {
          width,
          desiredWidth: columnWidth,
          align: xAlign,
          alignChar: xAlignChar,
        });
      }
      return applyXAlign(yAlignChar, {
        width: 1,
        desiredWidth: columnWidth,
        align: xAlign,
        alignChar: " ",
      });
    };

    let y = 0;
    for (const row of grid) {
      // let isLastRow = y === grid.length - 1;
      border_top_row: {
        const borderTopRow = borderTopRowMap.get(y);
        if (borderTopRow) {
          const borderTopRowText = renderRow(borderTopRow, {
            rowType: "border_top",
            rowHeight: 1,
          });
          log += borderTopRowText;
        }
      }
      content_row: {
        const contentRowText = renderRow(row, {
          rowType: "content",
          rowHeight: rowHeightMap.get(y),
        });
        log += contentRowText;
      }
      border_bottom_row: {
        const borderBottomRow = borderBottomRowMap.get(y);
        if (borderBottomRow) {
          const borderBottomRowText = renderRow(borderBottomRow, {
            rowType: "border_bottom",
            rowHeight: 1,
          });
          log += borderBottomRowText;
        }
      }
      y++;
    }
  }
  return log;
};

const applyXAlign = (text, { width, desiredWidth, align, alignChar }) => {
  const missingWidth = desiredWidth - width;
  if (missingWidth < 0) {
    // never supposed to happen because the width of a column
    // is the biggest width of all cells in this column
    return text;
  }
  if (missingWidth === 0) {
    return text;
  }
  // if (align === "fill") {
  //   let textRepeated = "";
  //   let widthFilled = 0;
  //   while (true) {
  //     textRepeated += text;
  //     widthFilled += width;
  //     if (widthFilled >= desiredWidth) {
  //       break;
  //     }
  //   }
  //   return textRepeated;
  // }
  if (align === "start") {
    return text + alignChar.repeat(missingWidth);
  }
  if (align === "center") {
    const leftSpacing = Math.floor(missingWidth / 2);
    const rightSpacing = missingWidth - leftSpacing;

    return (
      alignChar.repeat(leftSpacing) + text + alignChar.repeat(rightSpacing)
    );
  }
  // "end"
  return alignChar.repeat(missingWidth) + text;
};

const createContentCell = (
  {
    value,
    quoteAroundStrings,
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
  },
  { ansi },
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
    text = String(value);
  }

  if (ansi && bold) {
    text = ANSI.color(text, ANSI.BOLD);
  }
  if (ansi && color) {
    text = ANSI.color(text, color);
  }

  const lines = text.split("\n");

  let lineIndex = 0;
  const rects = [];
  for (const line of lines) {
    const isLastLine = lineIndex === lines.length - 1;
    let lineWidth = stringWidth(line);
    let lineText = line;
    if (isLastLine && unit) {
      lineWidth += ` ${unit}`.length;
      if (ansi && unitColor) {
        unit = ANSI.color(unit, unitColor);
      }
      lineText += ` ${unit}`;
    }
    rects.push({
      width: lineWidth,
      render: () => lineText,
    });
    lineIndex++;
  }

  return {
    type: "content",
    value,
    xAlign,
    yAlign,
    leftSpacing,
    rightSpacing,
    topSpacing,
    bottomSpacing,
    rects,
  };
};

const BORDER_PROPS = {
  top: {
    position: "top",
    yAlign: "end",
    rects: [
      { width: "fill", render: ({ columnWidth }) => "─".repeat(columnWidth) },
    ],
  },
  bottom: {
    position: "bottom",
    yAlign: "start",
    rects: [
      { width: "fill", render: ({ columnWidth }) => "─".repeat(columnWidth) },
    ],
  },
  left: {
    position: "left",
    xAlign: "end",
    yAlignChar: "|",
    rects: [
      {
        width: 1,
        render: ({
          isTopLeftCorner,
          isBottomLeftCorner,
          contentCells,
          updateOptions,
        }) => {
          const { cell, west } = contentCells;
          if (isTopLeftCorner) {
            if (cell.borderTop) {
              updateOptions(BORDER_JUNCTION_OPTIONS.top_left);
              return "┌";
            }
            if (west && west.borderTop && !west.borderRight) {
              updateOptions(BORDER_JUNCTION_OPTIONS.top_right);
              return "┐";
            }
            updateOptions(BORDER_JUNCTION_OPTIONS.left_top_half);
            return "╷";
          }
          if (isBottomLeftCorner) {
            if (cell.borderBottom) {
              updateOptions(BORDER_JUNCTION_OPTIONS.bottom_left);
              return "└";
            }
            updateOptions(BORDER_JUNCTION_OPTIONS.left_bottom_half);
            return "╵";
          }
          return "│";
        },
      },
    ],
  },
  right: {
    position: "right",
    xAlign: "start",
    yAlignChar: "|",
    rects: [
      {
        width: 1,
        render: ({
          isTopRightCorner,
          isBottomRightCorner,
          contentCells,
          updateOptions,
        }) => {
          const { cell, east } = contentCells;
          if (isTopRightCorner) {
            if (cell.borderTop) {
              updateOptions(BORDER_JUNCTION_OPTIONS.top_right);
              return "┐";
            }
            if (east && east.borderTop && !east.borderLeft) {
              updateOptions(BORDER_JUNCTION_OPTIONS.top_left);
              return "┌";
            }
            updateOptions(BORDER_JUNCTION_OPTIONS.right_top_half);
            return "╷";
          }
          if (isBottomRightCorner) {
            if (cell.borderBottom) {
              updateOptions(BORDER_JUNCTION_OPTIONS.bottom_right);
              return "┘";
            }
            if (east && east.borderBottom && !east.borderLeft) {
              updateOptions(BORDER_JUNCTION_OPTIONS.bottom_left);
              return "└";
            }
            updateOptions(BORDER_JUNCTION_OPTIONS.right_bottom_half);
            return "╵";
          }
          return "│";
        },
      },
    ],
  },
};

const BORDER_JUNCTION_OPTIONS = {
  // 1 border junction with blank
  left_top_half: {
    position: "left_top_half",
    xAlign: "end",
    char: "╷",
  },
  left_bottom_half: {
    position: "left_bottom_half",
    xAlign: "end",
    char: "╵",
  },
  right_top_half: {
    position: "right_top_half",
    xAlign: "end",
    char: "╷",
  },
  right_bottom_half: {
    position: "right_bottom_half",
    xAlign: "end",
    char: "╵",
  },
  // 2 borders junctions (corners)
  top_left: {
    position: "top_left",
    xAlign: "start",
    yAlign: "start",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "┌",
  },
  top_right: {
    position: "top_right",
    xAlign: "end",
    yAlign: "start",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "┐",
  },
  bottom_right: {
    position: "bottom_right",
    xAlign: "end",
    yAlign: "end",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "┘",
  },
  bottom_left: {
    position: "bottom_left",
    xAlign: "start",
    yAlign: "end",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "└",
  },
  // 3 borders junctions
  top_mid: {
    position: "top_mid",
    xAlign: "center",
    yAlign: "start",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "┬",
  },
  bottom_mid: {
    position: "bottom_mid",
    xAlign: "center",
    yAlign: "end",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "┴",
  },
  right_mid: {
    position: "right_mid",
    xAlign: "end",
    yAlign: "center",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "┤",
  },
  left_mid: {
    position: "left_mid",
    xAlign: "start",
    yAlign: "center",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "├",
  },
  // 4 border junctions
  mid: {
    position: "mid",
    xAlign: "center",
    yAlign: "center",
    xAlignChar: "─",
    yAlignChar: "│",
    char: "┼",
  },
};

const createBorder = (position, options) => {
  const borderProps = BORDER_PROPS[position];
  if (options) {
    return {
      ...borderProps,
      ...options,
    };
  }
  return borderProps;
};
const createBorderLeft = (options) => createBorder("left", options);
const createBorderRight = (options) => createBorder("right", options);
const createBorderTop = (options) => createBorder("top", options);
const createBorderBottom = (options) => createBorder("bottom", options);
// const createTopMidBorderCell = (options) =>
//   createBorderCell("top_mid", options);
// const createBottomMidBorderCell = (options) =>
//   createBorderCell("bottom_mid", options);
// const createRightMidBorderCell = (options) =>
//   createBorderCell("right_mid", options);
// const createLeftMidBorderCell = (options) =>
//   createBorderCell("left_mid", options);
// const createMidBorderCell = (options) => createBorderCell("mid", options);

// const isBorderTopLeft = (cell) => cell.position === "top_left";
// const isBorderTopRight = (cell) => cell.position === "top_right";
const isBorderLeft = (cell) => cell.position === "left";
const isBorderRight = (cell) => cell.position === "right";
const isBorderTop = (cell) => cell.position === "top";
const isBorderBottom = (cell) => cell.position === "bottom";
// const isBorderBottomRight = (cell) => cell.position === "bottom_right";
// const isBorderBottomLeft = (cell) => cell.position === "bottom_left";
const isContent = (cell) => cell.type === "content";

// const isBlank = (cell) => cell.type === "blank";
// blank cells are fluid cells that will take whatever size they are requested to take
// they can seen as placeholders that are removed when a line or column is composed only by blank cells
// this is useful to enforce a given amount of line / columns that can be adjusted later if nothing use the reserved line/column
// (used to implement borders because any cell can suddenly enable a border meaning all previous cells must now have blank spaces
// where the border is)
const blankCell = {
  type: "blank",
  rects: [
    {
      width: "fill",
      render: ({ columnWidth }) => " ".repeat(columnWidth),
    },
  ],
};

// const mutateGrid = (grid, callback) => {
//   let y = 0;
//   for (const line of grid) {
//     let x = 0;
//     for (const cell of line) {
//       line[x] = callback(cell, { x, y });
//       x++;
//     }
//     y++;
//   }
// };

// console.log(
//   renderTable([
//     [
//       {
//         value: "1:1",
//         borderTop: {},
//         borderLeft: {},
//         borderRight: {},
//         borderBottom: {},
//       },
//       {
//         value: "1:2",
//         borderTop: {},
//         borderLeft: {},
//         // borderRight: {},
//         borderBottom: {},
//       },
//       {
//         value: "1:3",
//         borderTop: {},
//         // borderLeft: {},
//         borderRight: {},
//         borderBottom: {},
//       },
//     ],
//     [
//       {
//         value: "2:1",
//         borderTop: {},
//         borderLeft: {},
//         borderRight: {},
//         borderBottom: {},
//       },
//       {
//         value: "2:2",
//         borderTop: {},
//         borderLeft: {},
//         borderRight: {},
//         borderBottom: {},
//       },
//       {
//         value: "2:3",
//         borderTop: {},
//         borderLeft: {},
//         borderRight: {},
//         borderBottom: {},
//       },
//     ],
//   ]),
// );
