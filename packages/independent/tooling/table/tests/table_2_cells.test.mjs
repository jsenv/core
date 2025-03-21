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
    top_right_and_bottom_left: [
      {
        borderTop: {},
        borderRight: {},
      },
      {
        borderBottom: {},
        borderLeft: {},
      },
    ],
    bottom_right_and_top_left: [
      {
        borderBottom: {},
        borderRight: {},
      },
      {
        borderTop: {},
        borderLeft: {},
      },
    ],
    bottom_left_and_top_right: [
      {
        borderBottom: {},
        borderLeft: {},
      },
      {
        borderTop: {},
        borderRight: {},
      },
    ],
    all_around: [
      {
        borderTop: {},
        borderLeft: {},
        borderRight: {},
        borderBottom: {},
      },
      {
        borderTop: {},
        borderLeft: {},
        borderRight: {},
        borderBottom: {},
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

${text}
`);
    }
  });

  const twoLineScenarios = {
    // bottom_and_top: [
    //   {
    //     borderBottom: {},
    //   },
    //   {
    //     borderTop: {},
    //   },
    // ],
    // bottom_left_and_top_left: [
    //   {
    //     borderBottom: {},
    //     borderLeft: {},
    //   },
    //   {
    //     borderTop: {},
    //     borderLeft: {},
    //   },
    // ],
    // bottom_right_and_top_right: [
    //   {
    //     borderBottom: {},
    //     borderRight: {},
    //   },
    //   {
    //     borderTop: {},
    //     borderRight: {},
    //   },
    // ],
    // top_left_and_bottom_right: [
    //   {
    //     borderTop: {},
    //     borderLeft: {},
    //   },
    //   {
    //     borderBottom: {},
    //     borderRight: {},
    //   },
    // ],
    bottom_right_and_top_left: [
      {
        borderBottom: {},
        borderRight: {},
      },
      {
        borderTop: {},
        borderLeft: {},
      },
    ],
    // all_around: [
    //   {
    //     borderTop: {},
    //     borderLeft: {},
    //     borderRight: {},
    //     borderBottom: {},
    //   },
    //   {
    //     borderTop: {},
    //     borderLeft: {},
    //     borderRight: {},
    //     borderBottom: {},
    //   },
    // ],
  };
  test.ONLY("1_two_cell_two_line", () => {
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

${text}
`);
    }
  });
});
