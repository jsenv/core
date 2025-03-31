import { renderNamedSections } from "@jsenv/humanize";
import { COLORS, renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = ({ backgroundColor, color }) => {
  const render = (grid) => renderTable(grid, { ansi: true });

  const text = `a
b
c`;

  const cell = {
    value: text,
    border: {},
    backgroundColor,
    color,
  };

  const a_b_c = render([
    // prettier-multiline
    [cell],
  ]);

  const a_b_c_max_height_1 = render([
    // prettier-multiline
    [{ ...cell, maxHeight: 1 }],
  ]);

  const a_b_c_max_height_2 = render([
    // prettier-multiline
    [{ ...cell, maxHeight: 2 }],
  ]);

  const a_b_c_max_height_3 = render([
    // prettier-multiline
    [{ ...cell, maxHeight: 3 }],
  ]);

  console.log(
    renderNamedSections({
      a_b_c,
      a_b_c_max_height_1,
      a_b_c_max_height_2,
      a_b_c_max_height_3,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));

  test(`1_background_cyan`, () =>
    run({
      backgroundColor: COLORS.CYAN,
      color: COLORS.BLACK,
    }));
});
