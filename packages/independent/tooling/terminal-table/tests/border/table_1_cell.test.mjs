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
  borderLeftRounded,
  borderRightRounded,
  borderTopRounded,
  borderBottomRounded,
  borderColors,
  ansi = borderColors,
}) => {
  const borderLeft = {
    color: borderColors ? COLORS.RED : null,
    bold: borderLeftBold,
    style: borderLeftStyle,
    rounded: borderLeftRounded,
  };
  const borderRight = {
    color: borderColors ? COLORS.YELLOW : null,
    bold: borderRightBold,
    style: borderRightStyle,
    rounded: borderRightRounded,
  };
  const borderTop = {
    color: borderColors ? COLORS.BLUE : null,
    bold: borderTopBold,
    style: borderTopStyle,
    rounded: borderTopRounded,
  };
  const borderBottom = {
    color: borderColors ? COLORS.GREEN : null,
    bold: borderBottomBold,
    style: borderBottomStyle,
    rounded: borderBottomRounded,
  };
  const render = (grid) => renderTable(grid, { ansi });

  const none = render([
    // prettier-force-multiline
    [{ value: "a", border: null }],
  ]);
  const top = render([
    // prettier-force-multiline
    [{ value: "a", borderTop }],
  ]);
  const left = render([
    // prettier-force-multiline
    [{ value: "a", borderLeft }],
  ]);
  const right = render([
    // prettier-force-multiline
    [{ value: "a", borderRight }],
  ]);
  const bottom = render([
    // prettier-force-multiline
    [{ value: "a", borderBottom }],
  ]);
  const top_left = render([[{ value: "a", borderTop, borderLeft }]]);
  const top_right = render([[{ value: "a", borderTop, borderRight }]]);
  const bottom_right = render([[{ value: "a", borderRight, borderBottom }]]);
  const bottom_left = render([[{ value: "a", borderLeft, borderBottom }]]);
  const left_and_right = render([[{ value: "a", borderLeft, borderRight }]]);
  const top_and_bottom = render([[{ value: "a", borderTop, borderBottom }]]);
  const all_but_top = render([
    // prettier-force-multiline
    [{ value: "a", borderLeft, borderRight, borderBottom }],
  ]);
  const all_but_right = render([
    // prettier-force-multiline
    [{ value: "a", borderLeft, borderTop, borderBottom }],
  ]);
  const all_but_left = render([
    // prettier-force-multiline
    [{ value: "a", borderRight, borderTop, borderBottom }],
  ]);
  const all_but_bottom = render([
    // prettier-force-multiline
    [{ value: "a", borderRight, borderTop, borderLeft }],
  ]);
  const all = render([
    // prettier-force-multiline
    [{ value: "a", borderLeft, borderRight, borderBottom, borderTop }],
  ]);

  console.log(
    renderNamedSections({
      none,
      top,
      left,
      bottom,
      right,
      top_left,
      top_right,
      bottom_right,
      bottom_left,
      left_and_right,
      top_and_bottom,
      all_but_top,
      all_but_right,
      all_but_left,
      all_but_bottom,
      all,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));

  test(`1_COLORS`, () =>
    run({
      borderColors: true,
    }));

  test(`2_border_bold_all`, () =>
    run({
      borderLeftBold: true,
      borderRightBold: true,
      borderTopBold: true,
      borderBottomBold: true,
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

  test("8_rounded_corners", () =>
    run({
      borderLeftRounded: true,
      borderRightRounded: true,
      borderTopRounded: true,
      borderBottomRounded: true,
    }));

  test("9_top_corners_rounded", () =>
    run({
      borderLeftRounded: true,
      borderRightRounded: true,
      borderTopRounded: true,
    }));

  // rounded and bold are not compatible (the output will use regular bold corners)
  test("10_corners_rounded_and_bold", () =>
    run({
      borderLeftRounded: true,
      borderRightRounded: true,
      borderTopRounded: true,
      borderBottomRounded: true,
      borderLeftBold: true,
      borderRightBold: true,
      borderTopBold: true,
      borderBottomBold: true,
      ansi: true,
    }));
});
