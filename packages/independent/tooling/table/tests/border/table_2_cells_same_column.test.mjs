import { renderNamedSections } from "@jsenv/humanize";
import { BORDER_COLORS, renderTable } from "@jsenv/table";
import { snapshotTableTests } from "@jsenv/table/tests/snapshot_table_tests.mjs";

const run = ({
  borderBold,
  borderCollapse,
  borderColors,
  ansi = borderColors,
}) => {
  const borderLeft = {
    color: borderColors ? BORDER_COLORS.RED : null,
    bold: borderBold,
  };
  const borderTop = {
    color: borderColors ? BORDER_COLORS.BLUE : null,
    bold: borderBold,
  };
  const borderBottom = {
    color: borderColors ? BORDER_COLORS.GREEN : null,
    bold: borderBold,
  };
  const borderRight = {
    color: borderColors ? BORDER_COLORS.YELLOW : null,
    bold: borderBold,
  };
  const render = (grid) => renderTable(grid, { borderCollapse, ansi });

  const bottom_and_top = render([
    [{ value: "a", borderBottom }],
    [{ value: "b", borderTop }],
  ]);
  const bottom_left_and_top_left = render([
    [{ value: "a", borderBottom, borderLeft }],
    [{ value: "b", borderTop, borderLeft }],
  ]);
  const left_bottom_and_left = render([
    [{ value: "a", borderLeft, borderBottom }],
    [{ value: "b", borderLeft }],
  ]);
  const left_and_top_left = render([
    [{ value: "a", borderLeft }],
    [{ value: "b", borderLeft, borderTop }],
  ]);
  const bottom_right_and_top_right = render([
    [{ value: "a", borderBottom, borderRight }],
    [{ value: "b", borderTop, borderRight }],
  ]);
  const right_bottom_and_right = render([
    [{ value: "a", borderRight, borderBottom }],
    [{ value: "b", borderRight }],
  ]);
  const right_and_top_right = render([
    [{ value: "a", borderRight }],
    [{ value: "b", borderTop, borderRight }],
  ]);
  const top_left_and_bottom_right = render([
    [{ value: "a", borderTop, borderLeft }],
    [{ value: "b", borderBottom, borderRight }],
  ]);
  const bottom_right_and_top_left = render([
    [{ value: "a", borderBottom, borderRight }],
    [{ value: "b", borderTop, borderLeft }],
  ]);
  const left_bottom_right = render([
    [{ value: "a", borderLeft, borderBottom }],
    [{ value: "b", borderRight }],
  ]);
  const left_and_top_right = render([
    [{ value: "a", borderLeft }],
    [{ value: "b", borderTop, borderRight }],
  ]);
  const all_but_bottom_and_all_but_top = render([
    [{ value: "a", borderLeft, borderRight, borderTop }],
    [{ value: "b", borderLeft, borderRight, borderBottom }],
  ]);
  const all_but_bottom_and_all = render([
    [{ value: "a", borderLeft, borderRight, borderTop }],
    [{ value: "b", borderLeft, borderRight, borderBottom, borderTop }],
  ]);
  const all_and_all_but_top = render([
    [{ value: "a", borderLeft, borderRight, borderBottom, borderTop }],
    [{ value: "b", borderLeft, borderRight, borderBottom }],
  ]);
  const all = render([
    [{ value: "a", borderLeft, borderRight, borderBottom, borderTop }],
    [{ value: "b", borderLeft, borderRight, borderBottom, borderTop }],
  ]);
  console.log(
    renderNamedSections({
      bottom_and_top,
      bottom_left_and_top_left,
      left_bottom_and_left,
      left_and_top_left,
      bottom_right_and_top_right,
      right_bottom_and_right,
      right_and_top_right,
      top_left_and_bottom_right,
      bottom_right_and_top_left,
      left_bottom_right,
      left_and_top_right,
      all_but_bottom_and_all_but_top,
      all_but_bottom_and_all,
      all_and_all_but_top,
      all,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run({}));

  test(`1_border_collapse`, () => run({ borderCollapse: true }));

  test("2_border_colors", () => run({ borderColors: true }));
});
