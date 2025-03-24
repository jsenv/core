import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

const run = ({ borderCollapse }) => {
  const render = (grid) => renderTable(grid, { borderCollapse });

  const right_and_left = render([
    [
      { value: "a", borderRight: {} },
      { value: "b", borderLeft: {} },
    ],
  ]);
  const top_right_and_bottom_left = render([
    [
      { value: "a", borderTop: {}, borderRight: {} },
      { value: "b", borderBottom: {}, borderLeft: {} },
    ],
  ]);
  const bottom_right_and_top_left = render([
    [
      { value: "a", borderBottom: {}, borderRight: {} },
      { value: "b", borderTop: {}, borderLeft: {} },
    ],
  ]);
  const bottom_left_and_top_right = render([
    [
      { value: "a", borderBottom: {}, borderLeft: {} },
      { value: "b", borderTop: {}, borderRight: {} },
    ],
  ]);
  const left_bottom_right_and_top_right = render([
    [
      { value: "a", borderLeft: {}, borderBottom: {}, borderRight: {} },
      { value: "b", borderTop: {}, borderRight: {} },
    ],
  ]);
  const top_right_bottom_right = render([
    [
      { value: "a", borderTop: {}, borderRight: {} },
      { value: "b", borderBottom: {}, borderRight: {} },
    ],
  ]);
  const top_left_bottom_right = render([
    [
      { value: "a", borderTop: {} },
      { value: "b", borderLeft: {}, borderBottom: {}, borderRight: {} },
    ],
  ]);
  const all_but_bottom_all_but_top = render([
    [
      { value: "a", border: {}, borderBottom: null },
      { value: "b", border: {}, borderTop: null },
    ],
  ]);
  const all_but_right_all_but_left = render([
    [
      { value: "a", border: {}, borderRight: null },
      { value: "b", border: {}, borderLeft: null },
    ],
  ]);
  const all_but_right_all = render([
    [
      { value: "a", border: {}, borderRight: null },
      { value: "b", border: {} },
    ],
  ]);
  const all_all_but_left = render([
    [
      { value: "a", border: {} },
      { value: "b", border: {}, borderLeft: null },
    ],
  ]);
  const all = render([
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
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));

  // test(`1_border_collapse`, () => run({ borderCollapse: true }));
});
