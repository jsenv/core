// 3 cells on same line
// 3 cells on same column
// then we'll be ready to move to 4 cells (split in 2 lines/2columns)
// and finish with 9 cells (split in 3 lines/3columns)

import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_three_cell_same_line`, () => {
    const none = renderTable([
      [
        { value: "a", border: null },
        { value: "b", border: null },
        { value: "c", border: null },
      ],
    ]);
    const left = renderTable([
      [
        { value: "a", borderLeft: {} },
        { value: "b", borderLeft: {} },
        { value: "c", borderLeft: {} },
      ],
    ]);
    const left_and_right = renderTable([
      [
        { value: "a", borderLeft: {}, borderRight: {} },
        { value: "b", borderLeft: {}, borderRight: {} },
        { value: "c", borderLeft: {}, borderRight: {} },
      ],
    ]);
    const top_and_bottom = renderTable([
      [
        { value: "a", borderTop: {}, borderBottom: {} },
        { value: "b", borderTop: {}, borderBottom: {} },
        { value: "c", borderTop: {}, borderBottom: {} },
      ],
    ]);
    const first_only = renderTable([
      [
        { value: "a", border: {} },
        { value: "b", border: null },
        { value: "c", border: null },
      ],
    ]);
    const middle_none = renderTable([
      [
        { value: "a", border: {} },
        { value: "b", border: null },
        { value: "c", border: {} },
      ],
    ]);
    const last_only = renderTable([
      [
        { value: "a", border: null },
        { value: "b", border: null },
        { value: "c", border: {} },
      ],
    ]);
    const castle = renderTable([
      [
        { value: "a", borderTop: {}, borderRight: {} },
        { value: "b", borderBottom: {} },
        { value: "c", borderLeft: {}, borderTop: {} },
      ],
    ]);
    const castle_inverted = renderTable([
      [
        { value: "a", borderBottom: {}, borderRight: {} },
        { value: "b", borderTop: {}, borderRight: {} },
        { value: "c", borderBottom: {} },
      ],
    ]);
    const around = renderTable([
      [
        { value: "a", borderTop: {}, borderBottom: {}, borderLeft: {} },
        { value: "b", border: {} },
        { value: "c", borderTop: {}, borderBottom: {}, borderRight: {} },
      ],
    ]);
    const all = renderTable([
      [
        { value: "a", border: {} },
        { value: "b", border: {} },
        { value: "c", border: {} },
      ],
    ]);

    const results = {
      none,
      left,
      left_and_right,
      top_and_bottom,
      first_only,
      middle_none,
      last_only,
      castle,
      castle_inverted,
      around,
      all,
    };
    console.log(renderNamedSections(results));
  });

  test("1_three_cell_same_column", () => {
    const none = renderTable([
      [{ value: "a", border: null }],
      [{ value: "b", border: null }],
      [{ value: "c", border: null }],
    ]);
    const left_and_right = renderTable([
      [{ value: "a", borderLeft: {}, borderRight: {} }],
      [{ value: "b", borderLeft: {}, borderRight: {} }],
      [{ value: "c", borderLeft: {}, borderRight: {} }],
    ]);
    const top_and_bottom = renderTable([
      [{ value: "a", borderTop: {}, borderBottom: {} }],
      [{ value: "b", borderTop: {}, borderBottom: {} }],
      [{ value: "c", borderTop: {}, borderBottom: {} }],
    ]);
    const castle = renderTable([
      [{ value: "a", border: {}, borderLeft: null }],
      [{ value: "b", borderLeft: {} }],
      [{ value: "c", border: {}, borderLeft: null }],
    ]);
    const castle_inverted = renderTable([
      [{ value: "a", border: {}, borderRight: null }],
      [{ value: "b", borderRight: {} }],
      [{ value: "c", border: {}, borderRight: null }],
    ]);
    const around = renderTable([
      [{ value: "a", border: {}, borderBottom: null }],
      [{ value: "b", border: {} }],
      [{ value: "c", border: {}, borderTop: null }],
    ]);
    const all = renderTable([
      [{ value: "a", border: {} }],
      [{ value: "b", border: {} }],
      [{ value: "c", border: {} }],
    ]);
    const results = {
      none,
      left_and_right,
      top_and_bottom,
      castle,
      castle_inverted,
      around,
      all,
    };
    console.log(renderNamedSections(results));
  });
});
