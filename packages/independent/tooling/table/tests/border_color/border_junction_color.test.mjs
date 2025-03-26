/**
 * des test de couleurs avec les 3 way, 4 ways
 */

import { renderNamedSections } from "@jsenv/humanize";
import { BORDER_COLORS, renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

const run = () => {
  const gridWhereBottomAndTopColorAreDifferent = [
    [
      {
        value: "a",
        borderBottom: { color: BORDER_COLORS.RED },
        borderLeft: { color: BORDER_COLORS.YELLOW },
      },
    ],
    [
      {
        value: "b",
        borderTop: { color: BORDER_COLORS.GREEN },
        borderLeft: { color: BORDER_COLORS.BLUE },
      },
    ],
  ];
  const main = renderTable(gridWhereBottomAndTopColorAreDifferent, {
    ansi: true,
  });

  console.log(
    renderNamedSections({
      main,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));
});
