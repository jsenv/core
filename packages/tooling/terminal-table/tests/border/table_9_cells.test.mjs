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
    [
      { value: "a", border: null },
      { value: "b", border: null },
      { value: "c", border: null },
    ],
    [
      { value: "d", border: null },
      { value: "e", border: null },
      { value: "f", border: null },
    ],
    [
      { value: "g", border: null },
      { value: "h", border: null },
      { value: "i", border: null },
    ],
  ]);
  const center_only = render([
    [
      { value: "a", border: null },
      { value: "b", border: null },
      { value: "c", border: null },
    ],
    [
      { value: "d", border: null },
      { value: "e", borderLeft, borderRight, borderBottom, borderTop },
      { value: "f", border: null },
    ],
    [
      { value: "g", border: null },
      { value: "h", border: null },
      { value: "i", border: null },
    ],
  ]);
  const bottom_right_only = render([
    [
      { value: "a", border: null },
      { value: "b", border: null },
      { value: "c", border: null },
    ],
    [
      { value: "d", border: null },
      { value: "e", border: null },
      { value: "f", border: null },
    ],
    [
      { value: "g", border: null },
      { value: "h", border: null },
      { value: "i", borderLeft, borderRight, borderBottom, borderTop },
    ],
  ]);
  const inner_only = render([
    [
      { value: "a", borderRight, borderBottom },
      { value: "b", borderBottom },
      { value: "c", borderLeft, borderBottom },
    ],
    [
      { value: "d", borderRight, borderBottom },
      { value: "e", borderBottom },
      { value: "f", borderLeft, borderBottom },
    ],
    [
      { value: "g", borderRight },
      { value: "h", border: null },
      { value: "i", borderLeft },
    ],
  ]);
  const head = render([
    [
      { value: "a", borderLeft, borderRight, borderBottom, borderTop },
      { value: "b", borderTop, borderBottom },
      { value: "c", borderLeft, borderRight, borderBottom, borderTop },
    ],
    [
      { value: "d", borderLeft, borderRight },
      { value: "e", border: null },
      { value: "f", borderLeft, borderRight },
    ],
    [
      { value: "g", borderLeft, borderBottom, borderRight },
      { value: "h", border: null, borderBottom },
      { value: "i", borderLeft, borderRight, borderBottom },
    ],
  ]);
  const foot = render([
    [
      { value: "a", borderLeft, borderTop, borderRight },
      { value: "b", border: null, borderTop },
      { value: "c", borderLeft, borderRight, borderTop },
    ],
    [
      { value: "d", borderLeft, borderRight },
      { value: "e", border: null },
      { value: "f", borderLeft, borderRight },
    ],
    [
      { value: "g", borderLeft, borderRight, borderBottom, borderTop },
      { value: "h", borderTop, borderBottom },
      { value: "i", borderLeft, borderRight, borderBottom, borderTop },
    ],
  ]);
  const all = render([
    [
      { value: "a", borderLeft, borderRight, borderBottom, borderTop },
      { value: "b", borderLeft, borderRight, borderBottom, borderTop },
      { value: "c", borderLeft, borderRight, borderBottom, borderTop },
    ],
    [
      { value: "d", borderLeft, borderRight, borderBottom, borderTop },
      { value: "e", borderLeft, borderRight, borderBottom, borderTop },
      { value: "f", borderLeft, borderRight, borderBottom, borderTop },
    ],
    [
      { value: "g", borderLeft, borderRight, borderBottom, borderTop },
      { value: "h", borderLeft, borderRight, borderBottom, borderTop },
      { value: "i", borderLeft, borderRight, borderBottom, borderTop },
    ],
  ]);

  console.log(
    renderNamedSections({
      none,
      center_only,
      bottom_right_only,
      inner_only,
      head,
      foot,
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
