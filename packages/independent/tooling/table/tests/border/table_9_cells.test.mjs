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
});
