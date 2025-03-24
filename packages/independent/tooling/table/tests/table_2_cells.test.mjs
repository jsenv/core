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
        { value: "a", borderBottom: {}, borderRight: {} },
        { value: "b", borderTop: {}, borderLeft: {} },
      ],
    ]);
    const bottom_left_and_top_right = renderTable([
      [
        { value: "a", borderBottom: {}, borderLeft: {} },
        { value: "b", borderTop: {}, borderRight: {} },
      ],
    ]);
    const left_bottom_right_and_top_right = renderTable([
      [
        { value: "a", borderLeft: {}, borderBottom: {}, borderRight: {} },
        { value: "b", borderTop: {}, borderRight: {} },
      ],
    ]);
    const top_right_bottom_right = renderTable([
      [
        { value: "a", borderTop: {}, borderRight: {} },
        { value: "b", borderBottom: {}, borderRight: {} },
      ],
    ]);
    const top_left_bottom_right = renderTable([
      [
        { value: "a", borderTop: {} },
        { value: "b", borderLeft: {}, borderBottom: {}, borderRight: {} },
      ],
    ]);
    const all_but_bottom_all_but_top = renderTable([
      [
        { value: "a", border: {}, borderBottom: null },
        { value: "b", border: {}, borderTop: null },
      ],
    ]);
    const all_but_right_all_but_left = renderTable([
      [
        { value: "a", border: {}, borderRight: null },
        { value: "b", border: {}, borderLeft: null },
      ],
    ]);
    const all_but_right_all = renderTable([
      [
        { value: "a", border: {}, borderRight: null },
        { value: "b", border: {} },
      ],
    ]);
    const all_all_but_left = renderTable([
      [
        { value: "a", border: {} },
        { value: "b", border: {}, borderLeft: null },
      ],
    ]);
    const all = renderTable([
      [
        { value: "a", border: {} },
        { value: "b", border: {} },
      ],
    ]);

    console.log(
      renderNamedSections({
        right_and_left,
        top_right_and_bottom_left,
        bottom_right_and_top_left,
        bottom_left_and_top_right,
        left_bottom_right_and_top_right,
        top_right_bottom_right,
        top_left_bottom_right,
        all_but_bottom_all_but_top,
        all_but_right_all_but_left,
        all_but_right_all,
        all_all_but_left,
        all,
      }),
    );
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
    const left_bottom_and_left = renderTable([
      [{ value: "a", borderLeft: {}, borderBottom: {} }],
      [{ value: "b", borderLeft: {} }],
    ]);
    const left_and_top_left = renderTable([
      [{ value: "a", borderLeft: {} }],
      [{ value: "b", borderLeft: {}, borderTop: {} }],
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
    const left_bottom_right = renderTable([
      [{ value: "a", borderLeft: {}, borderBottom: {} }],
      [{ value: "b", borderRight: {} }],
    ]);
    const left_and_top_right = renderTable([
      [{ value: "a", borderLeft: {} }],
      [{ value: "b", borderTop: {}, borderRight: {} }],
    ]);
    const all_but_bottom_and_all_but_top = renderTable([
      [{ value: "a", border: {}, borderBottom: null }],
      [{ value: "b", border: {}, borderTop: null }],
    ]);
    const all_but_bottom_and_all = renderTable([
      [{ value: "a", border: {}, borderBottom: null }],
      [{ value: "b", border: {} }],
    ]);
    const all_and_all_but_top = renderTable([
      [{ value: "a", border: {} }],
      [{ value: "b", border: {}, borderTop: null }],
    ]);
    const all = renderTable([
      [{ value: "a", border: {} }],
      [{ value: "b", border: {} }],
    ]);
    console.log(
      renderNamedSections({
        bottom_and_top,
        bottom_left_and_top_left,
        left_bottom_and_left,
        left_and_top_left,
        bottom_right_and_top_right,
        top_left_and_bottom_right,
        bottom_right_and_top_left,
        left_bottom_right,
        left_and_top_right,
        all_but_bottom_and_all_but_top,
        all_but_bottom_and_all,
        all_and_all_but_top,
        all,
      }),
    );
  });
});
