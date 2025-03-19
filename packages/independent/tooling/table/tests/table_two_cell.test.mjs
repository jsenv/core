import { renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

const run = (lines, options) => {
  return renderTable(lines, options);
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  const scenarios = {
    right_and_left: [
      {
        borderRight: {},
      },
      {
        borderLeft: {},
      },
    ],
  };

  test(`0_two_cell_borders`, () => {
    const keys = Object.keys(scenarios);
    for (const scenario of keys) {
      const [firstCellProps, secondCellProps] = scenarios[scenario];
      const text = run(
        [
          [
            { value: "1", ...firstCellProps },
            { value: "2", ...secondCellProps },
          ],
        ],
        {
          ansi: false,
        },
      );
      console.log(`--- ${scenario} ---

${text}`);
    }
  });
});
