/**
 *
 * then in an other file we'll try with thead + tfoot
 *
 */

import { renderNamedSections } from "@jsenv/humanize";
import { COLORS, renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = ({
  headCellBorderBold = false,
  headCellTextBold = false,
  cellBorderLeftStyle,
  cellBorderRightStyle,
  cellColor,
  cellBackgroundColor,
}) => {
  const renderTableWithHead = (grid, { cellProps }) => {
    const gridWithProps = [];

    let y = 0;
    for (const row of grid) {
      const rowWithProps = [];
      let x = 0;
      for (const cell of row) {
        const cellWithProps = { ...cell };
        const westCell = x === 0 ? null : row[x - 1];
        const eastCell = row[x + 1];
        const northCell = y === 0 ? null : grid[y - 1][x];
        const southCell = y === grid.length - 1 ? null : grid[y + 1][x];
        cellWithProps.color = cellColor;
        cellWithProps.backgroundColor = cellBackgroundColor;
        Object.assign(
          cellWithProps,
          cellProps({ northCell, southCell, westCell, eastCell, x, y }),
        );
        rowWithProps.push(cellWithProps);
        x++;
      }
      gridWithProps.push(rowWithProps);
      y++;
    }
    return renderTable(gridWithProps, { ansi: true, borderCollapse: true });
  };

  const grid = [
    [{ value: "name" }, { value: "age" }, { value: "status" }],
    [{ value: "dam" }, { value: 35 }, { value: "✅" }],
    [{ value: "flore" }, { value: 30 }, { value: "🚀" }],
  ];

  const a = renderTableWithHead(grid, {
    cellProps: ({ y }) => {
      return {
        bold: headCellTextBold && y === 0,
        borderLeft: {
          bold: headCellBorderBold && y === 0,
          style: cellBorderLeftStyle,
        },
        borderRight: {
          bold: headCellBorderBold && y === 0,
          style: cellBorderRightStyle,
        },
        borderTop: y === 0 ? { bold: headCellBorderBold && y === 0 } : null,
        borderBottom:
          y === 0 || y === grid.length - 1
            ? { bold: headCellBorderBold && y === 0 }
            : null,
      };
    },
  });
  const a_rounded = renderTableWithHead(grid, {
    cellProps: ({ y }) => {
      return {
        bold: headCellTextBold && y === 0,
        borderLeft: {
          bold: headCellBorderBold && y === 0,
          rounded: true,
          style: cellBorderLeftStyle,
        },
        borderRight: {
          bold: headCellBorderBold && y === 0,
          rounded: true,
          style: cellBorderRightStyle,
        },
        borderTop:
          y === 0
            ? { bold: headCellBorderBold && y === 0, rounded: true }
            : null,
        borderBottom:
          y === 0 || y === grid.length - 1
            ? { bold: headCellBorderBold && y === 0, rounded: true }
            : null,
      };
    },
  });
  const a_double = renderTableWithHead(grid, {
    cellProps: ({ y }) => {
      return {
        bold: headCellTextBold && y === 0,
        borderLeft: {
          bold: headCellBorderBold && y === 0,
          style: cellBorderLeftStyle,
        },
        borderRight: {
          bold: headCellBorderBold && y === 0,
          style: cellBorderRightStyle,
        },
        borderTop: y === 0 ? { bold: headCellBorderBold && y === 0 } : null,
        borderBottom:
          y === 0 || y === grid.length - 1
            ? {
                style: y === 0 ? "double" : "solid",
                bold: headCellBorderBold && y === 0,
              }
            : null,
      };
    },
  });
  const a_double_rounded = renderTableWithHead(grid, {
    cellProps: ({ y }) => {
      return {
        bold: headCellTextBold && y === 0,
        borderLeft: {
          bold: headCellBorderBold && y === 0,
          rounded: true,
          style: cellBorderLeftStyle,
        },
        borderRight: {
          bold: headCellBorderBold && y === 0,
          rounded: true,
          style: cellBorderRightStyle,
        },
        borderTop:
          y === 0
            ? { bold: headCellBorderBold && y === 0, rounded: true }
            : null,
        borderBottom:
          y === 0 || y === grid.length - 1
            ? {
                bold: headCellBorderBold && y === 0,
                style: y === 0 ? "double" : "solid",
                rounded: true,
              }
            : null,
      };
    },
  });

  const b = renderTableWithHead(grid, {
    cellProps: ({ westCell, eastCell, y }) => {
      return {
        bold: headCellTextBold && y === 0,
        borderLeft: westCell
          ? { bold: headCellBorderBold && y === 0, style: cellBorderLeftStyle }
          : null,
        borderRight: eastCell
          ? { bold: headCellBorderBold && y === 0, style: cellBorderRightStyle }
          : null,
        borderTop: y === 1 ? { bold: headCellBorderBold && y === 0 } : null,
        borderBottom: null,
      };
    },
  });

  const b_double = renderTableWithHead(grid, {
    cellProps: ({ westCell, eastCell, y }) => {
      return {
        bold: headCellTextBold && y === 0,
        borderLeft: westCell
          ? { bold: headCellBorderBold && y === 0, style: cellBorderLeftStyle }
          : null,
        borderRight: eastCell
          ? { bold: headCellBorderBold && y === 0, style: cellBorderRightStyle }
          : null,
        borderTop:
          y === 1
            ? { bold: headCellBorderBold && y === 0, style: "double" }
            : null,
        borderBottom: null,
        double: true,
      };
    },
  });

  console.log(
    renderNamedSections({
      a,
      a_rounded,
      a_double,
      a_double_rounded,
      b,
      b_double,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));

  test(`1_head_border_bold`, () =>
    run({
      headCellBorderBold: true,
    }));

  test(`2_head_border_bold_and_text_bold`, () =>
    run({
      headCellBorderBold: true,
      headCellTextBold: true,
    }));

  test(`3_border_x_dashed`, () =>
    run({
      cellBorderLeftStyle: "dash",
      cellBorderRightStyle: "dash",
    }));

  test(`4_head_cell_background_cyan`, () =>
    run({
      cellBackgroundColor: ({ y }) => {
        return y === 0 ? COLORS.CYAN : null;
      },
    }));

  test(`5_row_alternate_bg_colors`, () =>
    run({
      cellColor: () => COLORS.BLACK,
      cellBackgroundColor: ({ y }) => {
        if (y === 0) {
          return COLORS.MAGENTA;
        }
        if (y % 2 === 0) {
          return COLORS.GREY;
        }
        return COLORS.GREEN;
      },
    }));
});
