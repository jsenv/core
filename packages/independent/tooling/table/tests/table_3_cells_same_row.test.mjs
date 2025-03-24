import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

const run = ({ borderCollapse }) => {
  const render = (grid) => renderTable(grid, { borderCollapse });

  const none = render([
    [
      { value: "a", border: null },
      { value: "b", border: null },
      { value: "c", border: null },
    ],
  ]);
  const left = render([
    [
      { value: "a", borderLeft: {} },
      { value: "b", borderLeft: {} },
      { value: "c", borderLeft: {} },
    ],
  ]);
  const left_and_right = render([
    [
      { value: "a", borderLeft: {}, borderRight: {} },
      { value: "b", borderLeft: {}, borderRight: {} },
      { value: "c", borderLeft: {}, borderRight: {} },
    ],
  ]);
  const top_and_bottom = render([
    [
      { value: "a", borderTop: {}, borderBottom: {} },
      { value: "b", borderTop: {}, borderBottom: {} },
      { value: "c", borderTop: {}, borderBottom: {} },
    ],
  ]);
  const first_only = render([
    [
      { value: "a", border: {} },
      { value: "b", border: null },
      { value: "c", border: null },
    ],
  ]);
  const middle_none = render([
    [
      { value: "a", border: {} },
      { value: "b", border: null },
      { value: "c", border: {} },
    ],
  ]);
  const last_only = render([
    [
      { value: "a", border: null },
      { value: "b", border: null },
      { value: "c", border: {} },
    ],
  ]);
  const castle = render([
    [
      { value: "a", borderTop: {}, borderRight: {} },
      { value: "b", borderBottom: {} },
      { value: "c", borderLeft: {}, borderTop: {} },
    ],
  ]);
  const castle_inverted = render([
    [
      { value: "a", borderBottom: {}, borderRight: {} },
      { value: "b", borderTop: {}, borderRight: {} },
      { value: "c", borderBottom: {} },
    ],
  ]);
  const around = render([
    [
      { value: "a", borderTop: {}, borderBottom: {}, borderLeft: {} },
      { value: "b", border: {} },
      { value: "c", borderTop: {}, borderBottom: {}, borderRight: {} },
    ],
  ]);
  const all = render([
    [
      { value: "a", border: {} },
      { value: "b", border: {} },
      { value: "c", border: {} },
    ],
  ]);
  console.log(
    renderNamedSections({
      none,
      left,
      left_and_right,
      top_and_bottom,
      first_only,
      middle_none,
      last_only,
      castle,
      castle_inverted,
      around,
      all,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));

  // test(`1_border_collapse`, () => run({ borderCollapse: true }));
});
