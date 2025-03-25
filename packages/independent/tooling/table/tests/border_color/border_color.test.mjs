/**
 * TODO:
 * - the svg generator seems to fail on the castle, the spacing is incorrect
 *   it happens for the last row so we can just take that line, feed it to the svg generator
 *   and see how it's parsed and rendered to fix
 * - for castle inverted the top left of "b" must be yellow
 */

import { renderNamedSections } from "@jsenv/humanize";
import { BORDER_COLORS, renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

const run = () => {
  const render = (grid) => renderTable(grid, { ansi: true });
  const borderLeft = { color: BORDER_COLORS.RED };
  const borderTop = { color: BORDER_COLORS.BLUE };
  const borderBottom = { color: BORDER_COLORS.GREEN };
  const borderRight = { color: null };

  //   const border_top_left = render([
  //     // prettier-force-multiline
  //     [{ value: "a", borderLeft, borderTop }],
  //   ]);

  const castle_inverted = render([
    [
      {
        value: "a",
        borderBottom: { color: BORDER_COLORS.GREEN },
        borderRight: { color: BORDER_COLORS.BLUE },
      },
      {
        value: "b",
        borderTop: { color: null },
        borderRight: { color: BORDER_COLORS.BLUE },
      },
      { value: "c", borderBottom: { color: BORDER_COLORS.GREEN } },
    ],
  ]);

  console.log(
    renderNamedSections({
      // border_top_left,
      castle_inverted,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));
});
