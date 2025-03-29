/**
 * TODO: the most classic table:
 *
 * a head row with data
 *
 * we'll test many styling options
 *
 * (bold, double, dashed, etc)
 *
 * with border at different locations
 *
 *
 * then we'll also try the rounded corners
 * the table should include a string, a number and an emoji
 *
 * then in an other file we'll try with thead + tfoot
 *
 */

import { renderNamedSections } from "@jsenv/humanize";
import { BORDER_COLORS, renderTable } from "@jsenv/terminal-table";
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
    color: borderColors ? BORDER_COLORS.RED : null,
    bold: borderLeftBold,
    style: borderLeftStyle,
    rounded: borderLeftRounded,
  };
  const borderRight = {
    color: borderColors ? BORDER_COLORS.YELLOW : null,
    bold: borderRightBold,
    style: borderRightStyle,
    rounded: borderRightRounded,
  };
  const borderTop = {
    color: borderColors ? BORDER_COLORS.BLUE : null,
    bold: borderTopBold,
    style: borderTopStyle,
    rounded: borderTopRounded,
  };
  const borderBottom = {
    color: borderColors ? BORDER_COLORS.GREEN : null,
    bold: borderBottomBold,
    style: borderBottomStyle,
    rounded: borderBottomRounded,
  };
  const renderTableWithHead = ([head, ...body]) => {
    for (const cell of head) {
      cell.borderLeft = borderLeft;
      cell.borderRight = borderRight;
      cell.borderTop = borderTop;
      cell.borderBottom = borderBottom;
      cell.bold = true;
    }
    for (const bodyRow of body) {
      for (const bodyCell of bodyRow) {
        bodyCell.borderLeft = borderLeft;
        bodyCell.borderRight = borderRight;
      }
    }
    const lastBodyRow = body[body.length - 1];
    for (const bodyCell of lastBodyRow) {
      bodyCell.borderBottom = borderBottom;
    }
    return renderTable([head, ...body], { ansi, borderCollapse: true });
  };

  const main = renderTableWithHead([
    [{ value: "name" }, { value: "age" }],
    [{ value: "dam" }, { value: 35 }],
    [{ value: "flore" }, { value: 30 }],
  ]);

  console.log(
    renderNamedSections({
      main,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));
});
