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

  test("2_border_colors", () =>
    run({
      borderColors: true,
    }));
});
