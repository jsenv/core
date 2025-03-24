import { renderNamedSections } from "@jsenv/humanize";
import { BORDER_COLORS, renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

const run = () => {
  const render = (grid) => renderTable(grid, { ansi: true });

  const border_left_red_and_top_blue = render([
    // prettier-force-multiline
    [
      {
        value: "a",
        borderLeft: { color: BORDER_COLORS.RED },
        borderTop: { color: BORDER_COLORS.BLUE },
      },
    ],
  ]);

  console.log(
    renderNamedSections({
      border_left_red_and_top_blue,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));
});
