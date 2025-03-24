import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_four_cells`, () => {
    const none = renderTable([
      [
        { value: "a", border: null },
        { value: "b", border: null },
      ],
      [
        { value: "c", border: null },
        { value: "d", border: null },
      ],
    ]);
    const around_strange = renderTable([
      [
        { value: "a", border: {} },
        { value: "b", border: {}, borderLeft: null },
      ],
      [
        { value: "c", border: {}, borderTop: null },
        { value: "d", border: {}, borderLeft: null },
      ],
    ]);
    const left_column_full_right_column_split = renderTable([
      [
        { value: "a", border: {}, borderBottom: null, borderRight: null },
        { value: "b", border: {}, borderBottom: null },
      ],
      [
        { value: "c", border: {}, borderTop: null, borderRight: null },
        { value: "d", border: {} },
      ],
    ]);
    const left_column_split_right_column_full = renderTable([
      [
        { value: "a", border: {}, borderRight: null },
        { value: "b", border: {}, borderBottom: null },
      ],
      [
        { value: "c", border: {}, borderRight: null, borderTop: null },
        { value: "d", border: {}, borderTop: null },
      ],
    ]);
    const first_row_full_second_row_split = renderTable([
      [
        { value: "a", border: {}, borderRight: null },
        { value: "b", border: {}, borderLeft: null },
      ],
      [
        { value: "c", border: {}, borderRight: null, borderTop: null },
        { value: "d", border: {}, borderLeft: {}, borderTop: null },
      ],
    ]);
    const first_row_right_second_row_left = renderTable([
      [
        { value: "a", borderRight: {} },
        { value: "b", borderRight: {} },
      ],
      [
        { value: "c", borderLeft: {} },
        { value: "d", borderLeft: {} },
      ],
    ]);
    const first_column_top_second_column_bottom = renderTable([
      [
        { value: "a", borderTop: {} },
        { value: "b", borderBottom: {} },
      ],
      [
        { value: "c", borderTop: {} },
        { value: "d", borderBottom: {} },
      ],
    ]);
    const four_way_junction_bottom_right = renderTable([
      [
        { value: "a", border: {} },
        { value: "b", border: {}, borderLeft: null },
      ],
      [
        { value: "c", border: {}, borderTop: null },
        { value: "d", border: {}, borderTop: null, borderLeft: null },
      ],
    ]);
    const four_way_junction_bottom_left = renderTable([
      [
        { value: "a", border: {}, borderRight: null },
        { value: "b", border: {} },
      ],
      [
        { value: "c", border: {}, borderTop: null, borderRight: null },
        { value: "d", border: {}, borderTop: null },
      ],
    ]);
    const four_way_junction_top_left = renderTable([
      [
        { value: "a", border: {}, borderBottom: null, borderRight: null },
        { value: "b", border: {}, borderBottom: null },
      ],
      [
        { value: "c", border: {}, borderRight: null },
        { value: "d", border: {} },
      ],
    ]);
    const four_way_junction_top_right = renderTable([
      [
        { value: "a", border: {}, borderBottom: null },
        { value: "b", border: {}, borderBottom: null, borderLeft: null },
      ],
      [
        { value: "c", border: {} },
        { value: "d", border: {}, borderLeft: null },
      ],
    ]);
    const all = renderTable([
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
        left_column_full_right_column_split,
        left_column_split_right_column_full,
        first_row_full_second_row_split,
        first_row_right_second_row_left,
        first_column_top_second_column_bottom,
        four_way_junction_bottom_right,
        four_way_junction_bottom_left,
        four_way_junction_top_left,
        four_way_junction_top_right,
        all,
      }),
    );
  });
});
