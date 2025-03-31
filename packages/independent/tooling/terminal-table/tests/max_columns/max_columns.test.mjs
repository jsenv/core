import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = () => {
  const three_column_max_2 = renderTable(
    [
      [
        { value: "a", border: {} },
        { value: "b", border: {} },
        { value: "c", border: {} },
      ],
    ],
    { borderCollapse: true, maxColumns: 2, ansi: true },
  );

  console.log(
    renderNamedSections({
      three_column_max_2,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));
});
