import { renderNamedSections } from "@jsenv/humanize";
import { renderTable } from "@jsenv/terminal-table";
import { snapshotTableTests } from "@jsenv/terminal-table/tests/snapshot_table_tests.mjs";

const run = ({ backgroundColor, color }) => {
  const render = (grid) => renderTable(grid, { ansi: true });

  const text = `abc`;

  const cell = {
    value: text,
    border: {},
    backgroundColor,
    color,
  };

  const a_b_c = render([
    // prettier-multiline
    [cell],
  ]);

  const a_b_c_max_width_1 = render([
    // prettier-multiline
    [{ ...cell, maxWidth: 1 }],
  ]);

  const a_b_c_max_width_2 = render([
    // prettier-multiline
    [{ ...cell, maxWidth: 2 }],
  ]);

  const a_b_c_max_width_3 = render([
    // prettier-multiline
    [{ ...cell, maxWidth: 3 }],
  ]);

  console.log(
    renderNamedSections({
      a_b_c,
      a_b_c_max_width_1,
      a_b_c_max_width_2,
      a_b_c_max_width_3,
    }),
  );
};

await snapshotTableTests(import.meta.url, ({ test }) => {
  test(`0_basic`, () => run({}));
});
