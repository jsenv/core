import { renderNamedSections } from "@jsenv/humanize";
import { COLORS, renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = ({ borderCollapse }) => {
  const render = (grid) => renderTable(grid, { borderCollapse, ansi: true });

  const top_left_empty = render([
    [
      { value: "top_left", border: null },
      { value: "top_right", border: {} },
    ],
    [
      { value: "bottom_left", border: {} },
      { value: "bottom_right", border: {} },
    ],
  ]);
  const top_right_empty = render([
    [
      { value: "top_left", border: {} },
      { value: "top_right", border: null },
    ],
    [
      { value: "bottom_left", border: {} },
      { value: "bottom_right", border: {} },
    ],
  ]);
  const bottom_right_empty = render([
    [
      { value: "top_left", border: {} },
      { value: "top_right", border: {} },
    ],
    [
      { value: "bottom_left", border: {} },
      { value: "bottom_right", border: null },
    ],
  ]);
  const bottom_left_empty = render([
    [
      { value: "top_left", border: {} },
      { value: "top_right", border: {} },
    ],
    [
      { value: "bottom_left", border: null },
      { value: "bottom_right", border: {} },
    ],
  ]);

  const all = render([
    [
      { value: "top_left", border: {} },
      { value: "top_right", border: {} },
    ],
    [
      { value: "bottom_left", border: {} },
      { value: "bottom_right", border: {} },
    ],
  ]);

  const all_3_row = render([
    [
      { value: "column_a", border: {} },
      { value: "column_b", border: {} },
      { value: "column_c", border: {} },
    ],
  ]);

  const all_3_column = render([
    [{ value: "row_a", border: {} }],
    [{ value: "row_b", border: {} }],
    [{ value: "row_c", border: {} }],
  ]);

  const nine_cells_middle_use_yellow_borders = render([
    [
      { value: "top_left", border: {} },
      { value: "top", border: {} },
      { value: "top_right", border: {} },
    ],
    [
      { value: "left", border: {} },
      { value: "center", border: { color: COLORS.YELLOW } },
      { value: "right", border: {} },
    ],
    [
      { value: "bottom_left", border: {} },
      { value: "bottom", border: {} },
      { value: "bottom_right", border: {} },
    ],
  ]);

  console.log(
    renderNamedSections({
      top_left_empty,
      top_right_empty,
      bottom_right_empty,
      bottom_left_empty,
      all,
      all_3_row,
      all_3_column,
      nine_cells_middle_use_yellow_borders,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_without_collapse`, () =>
    run({
      borderCollapse: false,
    }));

  test(`1_with_collapse`, () =>
    run({
      borderCollapse: true,
    }));
});
