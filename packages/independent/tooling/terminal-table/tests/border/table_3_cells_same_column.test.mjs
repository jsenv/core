import { renderNamedSections } from "@jsenv/humanize";
import { COLORS, renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = ({
  borderLeftBold,
  borderRightBold,
  borderTopBold,
  borderBottomBold,
  borderLeftStyle,
  borderRightStyle,
  borderTopStyle,
  borderBottomStyle,
  borderCollapse,
  borderColors,
  ansi = borderColors,
}) => {
  const borderLeft = {
    color: borderColors ? COLORS.RED : null,
    bold: borderLeftBold,
    style: borderLeftStyle,
  };
  const borderRight = {
    color: borderColors ? COLORS.YELLOW : null,
    bold: borderRightBold,
    style: borderRightStyle,
  };
  const borderTop = {
    color: borderColors ? COLORS.BLUE : null,
    bold: borderTopBold,
    style: borderTopStyle,
  };
  const borderBottom = {
    color: borderColors ? COLORS.GREEN : null,
    bold: borderBottomBold,
    style: borderBottomStyle,
  };
  const render = (grid) => renderTable(grid, { borderCollapse, ansi });

  const none = render([
    [{ value: "a", border: null }],
    [{ value: "b", border: null }],
    [{ value: "c", border: null }],
  ]);
  const left_and_right = render([
    [{ value: "a", borderLeft, borderRight }],
    [{ value: "b", borderLeft, borderRight }],
    [{ value: "c", borderLeft, borderRight }],
  ]);
  const top_and_bottom = render([
    [{ value: "a", borderTop, borderBottom }],
    [{ value: "b", borderTop, borderBottom }],
    [{ value: "c", borderTop, borderBottom }],
  ]);
  const castle = render([
    [{ value: "a", borderRight, borderBottom, borderTop }],
    [{ value: "b", borderLeft }],
    [{ value: "c", borderRight, borderBottom, borderTop }],
  ]);
  const castle_inverted = render([
    [{ value: "a", borderLeft, borderBottom, borderTop }],
    [{ value: "b", borderRight }],
    [{ value: "c", borderLeft, borderBottom, borderTop }],
  ]);
  const around = render([
    [{ value: "a", borderLeft, borderRight, borderTop }],
    [{ value: "b", borderLeft, borderRight, borderBottom, borderTop }],
    [{ value: "c", borderLeft, borderRight, borderBottom }],
  ]);
  const all = render([
    [{ value: "a", borderLeft, borderRight, borderBottom, borderTop }],
    [{ value: "b", borderLeft, borderRight, borderBottom, borderTop }],
    [{ value: "c", borderLeft, borderRight, borderBottom, borderTop }],
  ]);
  console.log(
    renderNamedSections({
      none,
      left_and_right,
      top_and_bottom,
      castle,
      castle_inverted,
      around,
      all,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run({}));

  test(`1_border_collapse`, () =>
    run({
      borderCollapse: true,
    }));

  test("2_COLORS", () =>
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

  test("5_border_double", () =>
    run({
      borderLeftStyle: "double",
      borderRightStyle: "double",
      borderTopStyle: "double",
      borderBottomStyle: "double",
    }));

  test("6_border_double_x", () =>
    run({
      borderLeftStyle: "double",
      borderRightStyle: "double",
    }));

  test("7_border_double_y", () =>
    run({
      borderTopStyle: "double",
      borderBottomStyle: "double",
    }));
});
