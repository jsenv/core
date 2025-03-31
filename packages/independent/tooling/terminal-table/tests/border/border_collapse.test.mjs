/** encore du boulot sur border collapse
 *
 */

import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = ({ borderCollapse }) => {
  const render = (grid) => renderTable(grid, { borderCollapse });

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

  console.log(
    renderNamedSections({
      top_left_empty,
      top_right_empty,
      bottom_right_empty,
      bottom_left_empty,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_without_collapse`, () =>
    run({
      borderCollapse: false,
    }));

  test.ONLY(`1_with_collapse`, () =>
    run({
      borderCollapse: true,
    }),
  );
});
