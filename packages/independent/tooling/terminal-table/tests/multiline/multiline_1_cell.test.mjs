import { renderNamedSections } from "@jsenv/humanize";
import { COLORS, renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = ({ backgroundColor, color }) => {
  const render = (grid) => renderTable(grid, { ansi: true });

  const a_b_c = render([
    [
      {
        value: `a
b
c`,
        border: {},
        backgroundColor,
        color,
      },
    ],
  ]);

  console.log(
    renderNamedSections({
      a_b_c,
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
