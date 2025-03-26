import { renderNamedSections } from "@jsenv/humanize";
import { BORDER_COLORS, renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

const run = ({
  borderLeftBold,
  borderRightBold,
  borderTopBold,
  borderBottomBold,
  borderCollapse,
  borderColors,
  ansi = borderColors,
}) => {
  const borderLeft = {
    color: borderColors ? BORDER_COLORS.RED : null,
    bold: borderLeftBold,
  };
  const borderTop = {
    color: borderColors ? BORDER_COLORS.BLUE : null,
    bold: borderTopBold,
  };
  const borderBottom = {
    color: borderColors ? BORDER_COLORS.GREEN : null,
    bold: borderBottomBold,
  };
  const borderRight = {
    color: borderColors ? BORDER_COLORS.YELLOW : null,
    bold: borderRightBold,
  };
  const render = (grid) => renderTable(grid, { borderCollapse, ansi });

  const none = render([
    [
      { value: "a", border: null },
      { value: "b", border: null },
    ],
    [
      { value: "c", border: null },
      { value: "d", border: null },
    ],
  ]);
  const around_strange = render([
    [
      { value: "a", borderLeft, borderRight, borderBottom, borderTop },
      { value: "b", borderRight, borderBottom, borderTop },
    ],
    [
      { value: "c", borderLeft, borderRight, borderBottom },
      { value: "d", borderRight, borderBottom, borderTop },
    ],
  ]);
  const around_strange_2 = render([
    [
      { value: "a", borderLeft, borderRight, borderBottom, borderTop },
      { value: "b", borderRight, borderBottom, borderTop },
    ],
    [
      { value: "c", borderLeft, borderBottom, borderTop },
      { value: "d", borderLeft, borderRight, borderBottom },
    ],
  ]);
  const around_strange_3 = render([
    [
      { value: "a", borderLeft, borderRight, borderBottom, borderTop },
      { value: "b", borderRight, borderTop },
    ],
    [
      { value: "c", borderLeft, borderRight, borderBottom },
      { value: "d", borderRight, borderBottom, borderTop },
    ],
  ]);
  const strange_2 = render([
    [
      { value: "a", borderLeft, borderRight, borderBottom, borderTop },
      { value: "b", borderRight, borderBottom, borderTop },
    ],
    [
      { value: "c", borderLeft, borderBottom },
      { value: "d", borderLeft, borderRight, borderBottom },
    ],
  ]);
  const left_column_full_right_column_split = render([
    [
      { value: "a", borderLeft, borderTop },
      { value: "b", borderLeft, borderRight, borderTop },
    ],
    [
      { value: "c", borderLeft, borderBottom },
      { value: "d", borderLeft, borderRight, borderBottom, borderTop },
    ],
  ]);
  const left_column_split_right_column_full = render([
    [
      { value: "a", borderLeft, borderBottom, borderTop },
      { value: "b", borderLeft, borderRight, borderTop },
    ],
    [
      { value: "c", borderLeft, borderBottom },
      { value: "d", borderLeft, borderRight, borderBottom },
    ],
  ]);
  const first_row_full_second_row_split = render([
    [
      { value: "a", borderLeft, borderBottom, borderTop },
      { value: "b", borderRight, borderBottom, borderTop },
    ],
    [
      { value: "c", borderLeft, borderBottom },
      { value: "d", borderLeft, borderRight, borderBottom },
    ],
  ]);
  const first_row_split_second_row_full = render([
    [
      { value: "a", borderLeft, borderRight, borderBottom, borderTop },
      { value: "b", borderRight, borderBottom, borderTop },
    ],
    [
      { value: "c", borderLeft, borderBottom },
      { value: "d", borderRight, borderBottom },
    ],
  ]);
  const first_row_right_second_row_left = render([
    [
      { value: "a", borderRight },
      { value: "b", borderRight },
    ],
    [
      { value: "c", borderLeft },
      { value: "d", borderLeft },
    ],
  ]);
  const first_column_top_second_column_bottom = render([
    [
      { value: "a", borderTop },
      { value: "b", borderBottom },
    ],
    [
      { value: "c", borderTop },
      { value: "d", borderBottom },
    ],
  ]);
  const four_way_junction_bottom_right = render([
    [
      { value: "a", borderLeft, borderRight, borderBottom, borderTop },
      { value: "b", borderRight, borderBottom, borderTop },
    ],
    [
      { value: "c", borderLeft, borderRight, borderBottom },
      { value: "d", borderRight, borderBottom },
    ],
  ]);
  const four_way_junction_bottom_left = render([
    [
      { value: "a", borderLeft, borderBottom, borderTop },
      { value: "b", borderLeft, borderRight, borderBottom, borderTop },
    ],
    [
      { value: "c", borderLeft, borderBottom },
      { value: "d", borderLeft, borderRight, borderBottom },
    ],
  ]);
  const four_way_junction_top_left = render([
    [
      { value: "a", borderLeft, borderTop },
      { value: "b", borderLeft, borderRight, borderTop },
    ],
    [
      { value: "c", borderLeft, borderBottom, borderTop },
      { value: "d", borderLeft, borderRight, borderBottom, borderTop },
    ],
  ]);
  const four_way_junction_top_right = render([
    [
      { value: "a", borderLeft, borderRight, borderTop },
      { value: "b", borderRight, borderTop },
    ],
    [
      { value: "c", borderLeft, borderRight, borderBottom, borderTop },
      { value: "d", borderRight, borderBottom, borderTop },
    ],
  ]);
  const all = render([
    [
      { value: "a", borderLeft, borderRight, borderBottom, borderTop },
      { value: "b", borderLeft, borderRight, borderBottom, borderTop },
    ],
    [
      { value: "c", borderLeft, borderRight, borderBottom, borderTop },
      { value: "d", borderLeft, borderRight, borderBottom, borderTop },
    ],
  ]);

  console.log(
    renderNamedSections({
      none,
      around_strange,
      around_strange_2,
      around_strange_3,
      strange_2,
      left_column_full_right_column_split,
      left_column_split_right_column_full,
      first_row_full_second_row_split,
      first_row_split_second_row_full,
      first_row_right_second_row_left,
      first_column_top_second_column_bottom,
      four_way_junction_bottom_right,
      four_way_junction_bottom_left,
      four_way_junction_top_left,
      four_way_junction_top_right,
      all,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));

  test(`1_border_collapse`, () =>
    run({
      borderCollapse: true,
    }));

  test(`2_border_colors`, () =>
    run({
      borderColors: true,
    }));

  test(`3_border_bold_x`, () =>
    run({
      borderLeftBold: true,
      borderRightBold: true,
    }));

  test(`4_border_bold_y`, () =>
    run({
      borderTopBold: true,
      borderBottomBold: true,
    }));
});
