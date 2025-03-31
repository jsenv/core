/**
 *
 * then in an other file we'll try with thead + tfoot
 *
 */

import { renderNamedSections } from "@jsenv/humanize";
import { COLORS, renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = () => {
  const render = (grid, cellProps = {}) => {
    const gridWithProps = [];
    for (const row of grid) {
      const rowWithProps = [];
      for (const cell of row) {
        const cellWithProps = { ...cell, ...cellProps };
        rowWithProps.push(cellWithProps);
      }
      gridWithProps.push(rowWithProps);
    }
    return renderTable(gridWithProps, { ansi: true });
  };

  const grid = [
    [{ value: "Name" }, { value: "Price" }, { value: "Texture" }],
    [{ value: "dam" }, { value: 35 }, { value: "✅" }],
    [{ value: "flore" }, { value: 30 }, { value: "" }],
    [{ value: "Total" }, { value: 65 }, { value: "" }],
  ];

  const a = render(grid, {
    color: ({ y }) => {
      if (y === 0) {
        return COLORS.WHITE;
      }
      return COLORS.BLACK;
    },
    backgroundColor: ({ y }) => {
      if (y === 0) {
        return COLORS.RED;
      }
      return COLORS.WHITE;
    },
    border: { color: COLORS.GREY, spacing: 1 },
  });

  console.log(
    renderNamedSections({
      a,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));
});
