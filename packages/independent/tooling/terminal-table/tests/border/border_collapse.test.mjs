/** encore du boulot sur border collapse
 *
 */

import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = () => {
  const top_left_empty = renderTable(
    [
      [
        { value: "", border: null },
        { value: "free", border: {} },
      ],
      [
        { value: "feature a", border: {} },
        { value: "✔", border: {} },
      ],
    ],
    { borderCollapse: true },
  );
  const top_right_empty = renderTable(
    [
      [
        { value: "free", border: {} },
        { value: "", border: null },
      ],
      [
        { value: "feature a", border: {} },
        { value: "✔", border: {} },
      ],
    ],
    { borderCollapse: true },
  );

  console.log(
    renderNamedSections({
      top_left_empty,
      top_right_empty,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));
});
