// way more "castle" tests where the border are not collapsed from the same cell

import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

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

  test("1_two_cell_two_line", () => {
    const bottom_and_top = renderTable([
      [{ value: "a", borderBottom: {} }],
      [{ value: "b", borderTop: {} }],
    ]);
    const bottom_left_and_top_left = renderTable([
      [{ value: "a", borderBottom: {}, borderLeft: {} }],
      [{ value: "b", borderTop: {}, borderLeft: {} }],
    ]);
    const bottom_right_and_top_right = renderTable([
      [{ value: "a", borderBottom: {}, borderRight: {} }],
      [{ value: "b", borderTop: {}, borderRight: {} }],
    ]);
    const top_left_and_bottom_right = renderTable([
      [{ value: "a", borderTop: {}, borderLeft: {} }],
      [{ value: "b", borderBottom: {}, borderRight: {} }],
    ]);
    const bottom_right_and_top_left = renderTable([
      [{ value: "a", borderBottom: {}, borderRight: {} }],
      [{ value: "b", borderTop: {}, borderLeft: {} }],
    ]);
    const all = renderTable([
      [{ value: "a", border: {} }],
      [{ value: "b", border: {} }],
    ]);
    console.log(
      renderNamedSections({
        bottom_and_top,
        bottom_left_and_top_left,
        bottom_right_and_top_right,
        top_left_and_bottom_right,
        bottom_right_and_top_left,
        all,
      }),
    );
  });
});
