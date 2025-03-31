import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = () => {
  const table = renderTable(
    [
      [
        {
          value: "cell",
          border: {},
        },
      ],
    ],
    {
      ansi: true,
      borderSpacing: 1,
    },
  );

  console.log(
    renderNamedSections({
      table,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));
});
