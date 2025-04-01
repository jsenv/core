import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/terminal-table";
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
    return renderTable(gridWithProps, { ansi: true, borderCollapse: true });
  };

  const grid = [
    [
      { value: "Name", border: {}, borderBottom: { style: "double" } },
      { value: "Price", border: {}, borderBottom: { style: "double" } },
      { value: "Texture", border: {}, borderBottom: { style: "double" } },
    ],
    [
      { value: "dam", border: {} },
      { value: 35, border: {} },
      { value: "✅", border: {} },
    ],
    [
      { value: "flore", border: {} },
      { value: 30, border: {} },
      { value: "", border: {} },
    ],
    [
      { value: "Total", border: {}, borderTop: { style: "double" } },
      { value: 65, border: {}, borderTop: { style: "double" } },
      { value: "", border: {}, borderTop: { style: "double" } },
    ],
  ];

  const a = render(grid);

  console.log(
    renderNamedSections({
      a,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));
});
