/**
 *
 */

import { renderNamedSections } from "@jsenv/humanize";
import { BORDER_COLORS, renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

const run = () => {
  const render = (grid) => renderTable(grid, { ansi: true });
  const borderLeft = { color: BORDER_COLORS.RED };
  const borderTop = { color: BORDER_COLORS.BLUE };
  const borderBottom = { color: BORDER_COLORS.GREEN };
  const borderRight = { color: BORDER_COLORS.YELLOW };

  const border_top_left = render([
    // prettier-force-multiline
    [{ value: "a", borderLeft, borderTop }],
  ]);

  const castle_inverted = render([
    [
      { value: "a", borderBottom, borderRight },
      { value: "b", borderTop, borderRight },
      { value: "c", borderBottom },
    ],
  ]);

  console.log(
    renderNamedSections({
      border_top_left,
      castle_inverted,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));
});
