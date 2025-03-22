// way more "castle" tests where the border are not collapsed from the same cell

import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

const run = (lines, options) => {
  return renderTable(lines, options);
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_two_cell_same_line`, () => {
    const right_and_left = renderTable([
      [
        { value: "a", borderRight: {} },
        { value: "b", borderLeft: {} },
      ],
    ]);
    const top_right_and_bottom_left = renderTable([
      [
        { value: "a", borderTop: {}, borderRight: {} },
        { value: "b", borderBottom: {}, borderLeft: {} },
      ],
    ]);
    const bottom_right_and_top_left = renderTable([
      [
        {
          value: "a",
          borderBottom: {},
          borderRight: {},
        },
        {
          value: "b",
          borderTop: {},
          borderLeft: {},
        },
      ],
    ]);
    const bottom_left_and_top_right = renderTable([
      [
        {
          value: "a",
          borderBottom: {},
          borderLeft: {},
        },
        {
          value: "b",
          borderTop: {},
          borderRight: {},
        },
      ],
    ]);
    const all = renderTable([
      [
        { value: "a", border: {} },
        { value: "b", border: {} },
      ],
    ]);

    const results = {
      right_and_left,
      top_right_and_bottom_left,
      bottom_right_and_top_left,
      bottom_left_and_top_right,
      all,
    };
    console.log(renderNamedSections(results));
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
    bottom_left_and_top_left: [
      {
        borderBottom: {},
        borderLeft: {},
      },
      {
        borderTop: {},
        borderLeft: {},
      },
    ],
    bottom_right_and_top_right: [
      {
        borderBottom: {},
        borderRight: {},
      },
      {
        borderTop: {},
        borderRight: {},
      },
    ],
    top_left_and_bottom_right: [
      {
        borderTop: {},
        borderLeft: {},
      },
      {
        borderBottom: {},
        borderRight: {},
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

${text}
`);
    }
  });
});
