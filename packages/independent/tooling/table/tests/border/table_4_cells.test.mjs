import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

const run = ({ borderCollapse }) => {
  const render = (grid) => renderTable(grid, { borderCollapse });

  const none = render([
    [
      { value: "a", border: null },
      { value: "b", border: null },
    ],
    [
      { value: "c", border: null },
      { value: "d", border: null },
    ],
  ]);
  const around_strange = render([
    [
      { value: "a", border: {} },
      { value: "b", border: {}, borderLeft: null },
    ],
    [
      { value: "c", border: {}, borderTop: null },
      { value: "d", border: {}, borderLeft: null },
    ],
  ]);
  const around_strange_2 = render([
    [
      { value: "a", border: {} },
      { value: "b", border: {}, borderLeft: null },
    ],
    [
      { value: "c", border: {}, borderRight: null },
      { value: "d", border: {}, borderTop: null },
    ],
  ]);
  const around_strange_3 = render([
    [
      { value: "a", border: {} },
      { value: "b", border: {}, borderBottom: null, borderLeft: null },
    ],
    [
      { value: "c", border: {}, borderTop: null },
      { value: "d", border: {}, borderLeft: null },
    ],
  ]);
  const strange_2 = render([
    [
      { value: "a", border: {}, borderRight: {} },
      { value: "b", border: {}, borderLeft: null },
    ],
    [
      { value: "c", border: {}, borderRight: null, borderTop: null },
      { value: "d", border: {}, borderLeft: {}, borderTop: null },
    ],
  ]);
  const left_column_full_right_column_split = render([
    [
      { value: "a", border: {}, borderBottom: null, borderRight: null },
      { value: "b", border: {}, borderBottom: null },
    ],
    [
      { value: "c", border: {}, borderTop: null, borderRight: null },
      { value: "d", border: {} },
    ],
  ]);
  const left_column_split_right_column_full = render([
    [
      { value: "a", border: {}, borderRight: null },
      { value: "b", border: {}, borderBottom: null },
    ],
    [
      { value: "c", border: {}, borderRight: null, borderTop: null },
      { value: "d", border: {}, borderTop: null },
    ],
  ]);
  const first_row_full_second_row_split = render([
    [
      { value: "a", border: {}, borderRight: null },
      { value: "b", border: {}, borderLeft: null },
    ],
    [
      { value: "c", border: {}, borderRight: null, borderTop: null },
      { value: "d", border: {}, borderLeft: {}, borderTop: null },
    ],
  ]);
  const first_row_split_second_row_full = render([
    [
      { value: "a", border: {}, borderRight: {} },
      { value: "b", border: {}, borderLeft: null },
    ],
    [
      { value: "c", border: {}, borderRight: null, borderTop: null },
      { value: "d", border: {}, borderLeft: null, borderTop: null },
    ],
  ]);
  const first_row_right_second_row_left = render([
    [
      { value: "a", borderRight: {} },
      { value: "b", borderRight: {} },
    ],
    [
      { value: "c", borderLeft: {} },
      { value: "d", borderLeft: {} },
    ],
  ]);
  const first_column_top_second_column_bottom = render([
    [
      { value: "a", borderTop: {} },
      { value: "b", borderBottom: {} },
    ],
    [
      { value: "c", borderTop: {} },
      { value: "d", borderBottom: {} },
    ],
  ]);
  const four_way_junction_bottom_right = render([
    [
      { value: "a", border: {} },
      { value: "b", border: {}, borderLeft: null },
    ],
    [
      { value: "c", border: {}, borderTop: null },
      { value: "d", border: {}, borderTop: null, borderLeft: null },
    ],
  ]);
  const four_way_junction_bottom_left = render([
    [
      { value: "a", border: {}, borderRight: null },
      { value: "b", border: {} },
    ],
    [
      { value: "c", border: {}, borderTop: null, borderRight: null },
      { value: "d", border: {}, borderTop: null },
    ],
  ]);
  const four_way_junction_top_left = render([
    [
      { value: "a", border: {}, borderBottom: null, borderRight: null },
      { value: "b", border: {}, borderBottom: null },
    ],
    [
      { value: "c", border: {}, borderRight: null },
      { value: "d", border: {} },
    ],
  ]);
  const four_way_junction_top_right = render([
    [
      { value: "a", border: {}, borderBottom: null },
      { value: "b", border: {}, borderBottom: null, borderLeft: null },
    ],
    [
      { value: "c", border: {} },
      { value: "d", border: {}, borderLeft: null },
    ],
  ]);
  const all = render([
    [
      { value: "a", border: {} },
      { value: "b", border: {} },
    ],
    [
      { value: "c", border: {} },
      { value: "d", border: {} },
    ],
  ]);

  console.log(
    renderNamedSections({
      none,
      around_strange,
      around_strange_2,
      around_strange_3,
      strange_2,
      left_column_full_right_column_split,
      left_column_split_right_column_full,
      first_row_full_second_row_split,
      first_row_split_second_row_full,
      first_row_right_second_row_left,
      first_column_top_second_column_bottom,
      four_way_junction_bottom_right,
      four_way_junction_bottom_left,
      four_way_junction_top_left,
      four_way_junction_top_right,
      all,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));

  test(`1_border_collapse`, () => run({ borderCollapse: true }));
});
