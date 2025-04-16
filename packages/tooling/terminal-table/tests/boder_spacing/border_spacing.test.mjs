import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = () => {
  const render = (grid) => renderTable(grid, { ansi: true, borderSpacing: 1 });

  const single_cell = render([
    [
      // prettier-force-multiline
      { value: "cell", border: {} },
    ],
  ]);

  const two_cells = render([
    [
      { value: "cell_a", border: {} },
      { value: "cell_b", border: {} },
    ],
  ]);

  const four_cells = render([
    [
      { value: "top_left", border: {} },
      { value: "top_right", border: {} },
    ],
    [
      { value: "bottom_right", border: {} },
      { value: "bottom_left", border: {} },
    ],
  ]);

  console.log(
    renderNamedSections({
      single_cell,
      two_cells,
      four_cells,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));
});
