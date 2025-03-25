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

  const right_and_left = render([
    [
      { value: "a", borderRight },
      { value: "b", borderLeft },
    ],
  ]);
  const top_right_and_bottom_left = render([
    [
      { value: "a", borderTop, borderRight },
      { value: "b", borderBottom, borderLeft },
    ],
  ]);
  const bottom_right_and_top_left = render([
    [
      { value: "a", borderBottom, borderRight },
      { value: "b", borderTop, borderLeft },
    ],
  ]);
  const bottom_left_and_top_right = render([
    [
      { value: "a", borderBottom, borderLeft },
      { value: "b", borderTop, borderRight },
    ],
  ]);
  const left_bottom_right_and_top_right = render([
    [
      { value: "a", borderLeft, borderBottom, borderRight },
      { value: "b", borderTop, borderRight },
    ],
  ]);
  const top_right_bottom_right = render([
    [
      { value: "a", borderTop, borderRight },
      { value: "b", borderBottom, borderRight },
    ],
  ]);
  const top_left_bottom_right = render([
    [
      { value: "a", borderTop },
      { value: "b", borderLeft, borderBottom, borderRight },
    ],
  ]);
  const all_but_bottom_all_but_top = render([
    [
      { value: "a", borderLeft, borderRight, borderTop },
      { value: "b", borderLeft, borderRight, borderBottom },
    ],
  ]);
  const all_but_right_all_but_left = render([
    [
      { value: "a", borderLeft, borderBottom, borderTop },
      { value: "b", borderRight, borderBottom, borderTop },
    ],
  ]);
  const all_but_right_all = render([
    [
      { value: "a", borderLeft, borderBottom, borderTop },
      { value: "b", borderLeft, borderRight, borderBottom, borderTop },
    ],
  ]);
  const all_all_but_left = render([
    [
      { value: "a", borderLeft, borderRight, borderBottom, borderTop },
      { value: "b", borderRight, borderBottom, borderTop },
    ],
  ]);
  const all = render([
    [
      { value: "a", borderLeft, borderRight, borderBottom, borderTop },
      { value: "b", borderLeft, borderRight, borderBottom, borderTop },
    ],
  ]);
  console.log(
    renderNamedSections({
      right_and_left,
      top_right_and_bottom_left,
      bottom_right_and_top_left,
      bottom_left_and_top_right,
      left_bottom_right_and_top_right,
      top_right_bottom_right,
      top_left_bottom_right,
      all_but_bottom_all_but_top,
      all_but_right_all_but_left,
      all_but_right_all,
      all_all_but_left,
      all,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));

  test(`1_border_collapse`, () => run({ borderCollapse: true }));

  test("2_border_colors", () => run({ borderColors: true }));
});
