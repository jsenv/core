/**
 * des test de couleurs avec les 3 way, 4 ways
 */

import { renderNamedSections } from "@jsenv/humanize";
import { BORDER_COLORS, renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

const run = () => {
  // const border_top_left = render([
  //   // prettier-force-multiline
  //   [{ value: "a", borderLeft, borderTop }],
  // ]);
  // const castle = render([
  //   [
  //     { value: "a", borderTop, borderRight },
  //     { value: "b", borderBottom },
  //     { value: "c", borderLeft, borderTop },
  //   ],
  // ]);
  // const castle_inverted = render([
  //   [
  //     { value: "a", borderBottom, borderRight },
  //     { value: "b", borderTop, borderRight },
  //     { value: "c", borderBottom },
  //   ],
  // ]);

  const gridWhereBottomAndTopColorAreDifferent = [
    [{ value: "a", borderBottom: { color: BORDER_COLORS.RED } }],
    [{ value: "b", borderTop: { color: BORDER_COLORS.GREEN } }],
  ];

  const color_conflict = renderTable(gridWhereBottomAndTopColorAreDifferent, {
    ansi: true,
  });
  const color_conflict_collapse = renderTable(
    gridWhereBottomAndTopColorAreDifferent,
    {
      ansi: true,
      borderCollapse: true,
    },
  );
  const color_conflict_collapse_ignore_mistmatch = renderTable(
    gridWhereBottomAndTopColorAreDifferent,
    {
      ansi: true,
      borderCollapse: true,
      preventBorderJunctionsWhenColorMismatch: true,
    },
  );

  console.log(
    renderNamedSections({
      color_conflict,
      color_conflict_collapse,
      color_conflict_collapse_ignore_mistmatch,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));
});
