/**
 * des test de couleurs avec les 3 way, 4 ways
 */

import { renderNamedSections } from "@jsenv/humanize";
import { COLORS, renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = () => {
  const gridWhereBottomAndTopColorAreDifferent = [
    [
      {
        value: "a",
        borderBottom: { color: COLORS.RED },
        borderLeft: { color: COLORS.YELLOW },
      },
    ],
    [
      {
        value: "b",
        borderTop: { color: COLORS.GREEN },
        borderLeft: { color: COLORS.BLUE },
      },
    ],
  ];

  const main = renderTable(gridWhereBottomAndTopColorAreDifferent, {
    ansi: true,
  });
  const border_collapse = renderTable(gridWhereBottomAndTopColorAreDifferent, {
    ansi: true,
    borderCollapse: true,
  });
  const border_collapse_but_separated_if_conflict = renderTable(
    gridWhereBottomAndTopColorAreDifferent,
    {
      ansi: true,
      borderCollapse: true,
      borderSeparatedOnColorConflict: true,
    },
  );

  console.log(
    renderNamedSections({
      main,
      border_collapse,
      border_collapse_but_separated_if_conflict,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));
});
