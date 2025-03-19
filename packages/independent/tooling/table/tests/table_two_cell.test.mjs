import { renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

const run = (lines, options) => {
  return renderTable(lines, options);
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  const sameLineScenarios = {
    right_and_left: [
      {
        borderRight: {},
      },
      {
        borderLeft: {},
      },
    ],
  };
  test(`0_two_cell_same_line`, () => {
    const keys = Object.keys(sameLineScenarios);
    for (const scenario of keys) {
      const [firstCellProps, secondCellProps] = sameLineScenarios[scenario];
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

  const twoLineScenarios = {
    bottom_and_top: [
      {
        borderBottom: {},
      },
      {
        borderTop: {},
      },
    ],
  };
  test("1_two_cell_two_line", () => {
    const keys = Object.keys(twoLineScenarios);
    for (const scenario of keys) {
      const [firstCellProps, secondCellProps] = twoLineScenarios[scenario];
      const text = run(
        [
          [{ value: "1", ...firstCellProps }],
          [{ value: "2", ...secondCellProps }],
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
