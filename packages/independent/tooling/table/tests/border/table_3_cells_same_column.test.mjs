import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

const run = ({ borderCollapse }) => {
  const render = (grid) => renderTable(grid, { borderCollapse });

  const none = render([
    [{ value: "a", border: null }],
    [{ value: "b", border: null }],
    [{ value: "c", border: null }],
  ]);
  const left_and_right = render([
    [{ value: "a", borderLeft: {}, borderRight: {} }],
    [{ value: "b", borderLeft: {}, borderRight: {} }],
    [{ value: "c", borderLeft: {}, borderRight: {} }],
  ]);
  const top_and_bottom = render([
    [{ value: "a", borderTop: {}, borderBottom: {} }],
    [{ value: "b", borderTop: {}, borderBottom: {} }],
    [{ value: "c", borderTop: {}, borderBottom: {} }],
  ]);
  const castle = render([
    [{ value: "a", border: {}, borderLeft: null }],
    [{ value: "b", borderLeft: {} }],
    [{ value: "c", border: {}, borderLeft: null }],
  ]);
  const castle_inverted = render([
    [{ value: "a", border: {}, borderRight: null }],
    [{ value: "b", borderRight: {} }],
    [{ value: "c", border: {}, borderRight: null }],
  ]);
  const around = render([
    [{ value: "a", border: {}, borderBottom: null }],
    [{ value: "b", border: {} }],
    [{ value: "c", border: {}, borderTop: null }],
  ]);
  const all = render([
    [{ value: "a", border: {} }],
    [{ value: "b", border: {} }],
    [{ value: "c", border: {} }],
  ]);
  console.log(
    renderNamedSections({
      none,
      left_and_right,
      top_and_bottom,
      castle,
      castle_inverted,
      around,
      all,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run({}));

  test(`1_border_collapse`, () => run({ borderCollapse: true }));
});
