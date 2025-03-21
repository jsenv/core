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
    const all = renderTable([
      [
        { value: "a", border: {} },
        { value: "b", border: {} },
        { value: "c", border: {} },
      ],
    ]);

    const results = { none, left, all };
    console.log(renderNamedSections(results));
  });

  test("1_three_cell_same_column", () => {});
});
