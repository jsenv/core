import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = () => {
  const three_row_max_2 = renderTable(
    [
      [{ value: "a", border: {} }],
      [{ value: "b", border: {} }],
      [{ value: "c", border: {} }],
    ],
    { borderCollapse: true, maxRows: 2, ansi: true },
  );

  const three_row_max_3 = renderTable(
    [
      [{ value: "a", border: {} }],
      [{ value: "b", border: {} }],
      [{ value: "c", border: {} }],
    ],
    { borderCollapse: true, maxRows: 3, ansi: true },
  );

  const five_row_max_5_last_row_fixed = renderTable(
    [
      [{ value: "a", border: {} }],
      [{ value: "b", border: {} }],
      [{ value: "c", border: {} }],
      [{ value: "d", border: {} }],
      [{ value: "Total", border: {} }],
    ],
    { borderCollapse: true, maxRows: 3, fixLastRow: true, ansi: true },
  );

  console.log(
    renderNamedSections({
      three_row_max_2,
      three_row_max_3,
      five_row_max_5_last_row_fixed,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));
});
