import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

const run = ({ ansi, boldBorders }) => {
  const border = { bold: boldBorders };
  const render = (grid) => renderTable(grid, { ansi });

  const none = render([
    // prettier-force-multiline
    [{ value: "a", border: null }],
  ]);
  const top = render([
    // prettier-force-multiline
    [{ value: "a", borderTop: border }],
  ]);
  const left = render([
    // prettier-force-multiline
    [{ value: "a", borderLeft: border }],
  ]);
  const right = render([
    // prettier-force-multiline
    [{ value: "a", borderRight: border }],
  ]);
  const bottom = render([
    // prettier-force-multiline
    [{ value: "a", borderBottom: border }],
  ]);
  const top_left = render([
    [{ value: "a", borderTop: border, borderLeft: border }],
  ]);
  const top_right = render([
    [{ value: "a", borderTop: border, borderRight: border }],
  ]);
  const bottom_right = render([
    [{ value: "a", borderRight: border, borderBottom: border }],
  ]);
  const bottom_left = render([
    [{ value: "a", borderLeft: border, borderBottom: border }],
  ]);
  const left_and_right = render([
    [{ value: "a", borderLeft: border, borderRight: border }],
  ]);
  const top_and_bottom = render([
    [{ value: "a", borderTop: border, borderBottom: border }],
  ]);
  const all_but_top = render([
    // prettier-force-multiline
    [{ value: "a", border, borderTop: null }],
  ]);
  const all_but_right = render([
    // prettier-force-multiline
    [{ value: "a", border, borderRight: null }],
  ]);
  const all_but_left = render([
    // prettier-force-multiline
    [{ value: "a", border, borderLeft: null }],
  ]);
  const all_but_bottom = render([
    // prettier-force-multiline
    [{ value: "a", border, borderBottom: null }],
  ]);
  const all = render([
    // prettier-force-multiline
    [{ value: "a", border }],
  ]);

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
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_single_cell`, () => run({}));

  test(`1_single_cell_bold`, () => run({ boldBorders: true }));

  // test(`3_single_cell_ansi`, () => run({ ansi: true }));
});
