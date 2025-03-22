import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

await snapshotTableTests(import.meta.url, ({ test }) => {
  const none = renderTable([[{ value: "a", border: null }]]);
  const top = renderTable([[{ value: "a", borderTop: {} }]]);
  const left = renderTable([[{ value: "a", borderLeft: {} }]]);
  const right = renderTable([[{ value: "a", borderRight: {} }]]);
  const bottom = renderTable([[{ value: "a", borderBottom: {} }]]);
  const top_left = renderTable([
    [{ value: "a", borderTop: {}, borderLeft: {} }],
  ]);
  const top_right = renderTable([
    [{ value: "a", borderTop: {}, borderRight: {} }],
  ]);
  const bottom_right = renderTable([
    [{ value: "a", borderRight: {}, borderBottom: {} }],
  ]);
  const bottom_left = renderTable([
    [{ value: "a", borderLeft: {}, borderBottom: {} }],
  ]);
  const left_and_right = renderTable([
    [{ value: "a", borderLeft: {}, borderRight: {} }],
  ]);
  const top_and_bottom = renderTable([
    [{ value: "a", borderTop: {}, borderBottom: {} }],
  ]);
  const all_but_top = renderTable([
    [{ value: "a", borderLeft: {}, borderRight: {}, borderBottom: {} }],
  ]);
  const all_but_right = renderTable([
    [{ value: "a", borderTop: {}, borderLeft: {}, borderBottom: {} }],
  ]);
  const all_but_left = renderTable([
    [{ value: "a", borderTop: {}, borderRight: {}, borderBottom: {} }],
  ]);
  const all_but_bottom = renderTable([
    [{ value: "a", borderTop: {}, borderLeft: {}, borderRight: {} }],
  ]);
  const all = renderTable([[{ value: "a", border: {} }]]);

  test(`0_single_cell_borders`, () => {
    console.log(
      renderNamedSections({
        none,
        top,
        left,
        bottom,
        right,
        top_left,
        top_right,
        bottom_right,
        bottom_left,
        left_and_right,
        top_and_bottom,
        all_but_top,
        all_but_right,
        all_but_left,
        all_but_bottom,
        all,
      }),
    );
  });
});
